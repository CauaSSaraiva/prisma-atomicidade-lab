import { prisma } from "../prisma";
import type { PrismaClient } from "@prisma/client";
import { type Reserva } from "@prisma/client";
import { type ServiceResult } from "../utils/types/service-result";


export type ReservaPublica = Pick<Reserva, "id" | "criadoEm">;

export type ResultadoCompra = ServiceResult<
  ReservaPublica, 
  "EVENTO_NAO_ENCONTRADO" | "ESGOTADO" | "ERRO_CONCORRENCIA"
>;

// exemplo de implementação problemática e com más práticas
export const comprarIngressoRuim = async (
    eventoId: string,
): Promise<ServiceResult<string, "EVENTO_NAO_ENCONTRADO" | "ESGOTADO">> => {

    const evento = await prisma.evento.findUnique({ where: { id: eventoId } });

    if (!evento) return {ok: false, erro: "EVENTO_NAO_ENCONTRADO"}

    //  Processamento Lógico (na memória do TS)
    if (evento.ingressosDisponiveis > 0) {
      
    //  ** O Problema é aqui **
    // Se dois ou mais requests chegarem aqui ao mesmo tempo,
    // ambos viram que tinha ingresso > 0 e executam.
    // e pra piorar, todos fazem o mesmo cálculo como "10 - 1" e todos definem como 9
    // resultando no total de 9, como se somente 1 tivesse sido 'comprado'
    await prisma.evento.update({
      where: { id: eventoId },
      data: { ingressosDisponiveis: evento.ingressosDisponiveis - 1 }
    });

    // e ainda por cima, ele vai criar todas as reservas "fantasmas" 
    await prisma.reserva.create({
      data: { eventoId }
    });

    return {ok: true, data: "Ingresso Comprado!"}
    } else {
      return {ok: false, erro: "ESGOTADO"}
    }
}

// exemplo de melhor implementação e melhoras práticas
export const comprarIngressoBom = async (
  eventoId: string
): Promise<ResultadoCompra> => {

    try {
      // Usando Transaction para garantir integridade
      const novaReserva = await prisma.$transaction(async (tx: PrismaClient) => {
        // Troca verificação em memória do TS para where do próprio banco
        // e uso do updateMany para verificar quantidade de linhas alteradas
        const evento = await tx.evento.updateMany({
          where: {
            id: eventoId,
            ingressosDisponiveis: { gt: 0 }, // Guard Clause
          },
          data: {
            ingressosDisponiveis: { decrement: 1 }, // Atomicidade (decrement)
          },
        });

        if (evento.count === 0) {
          // Se ninguém foi atualizado, significa que não existia ingresso suficiente
          // e invéz de erro silencioso, lançamos erro e a transaction vai dar rollback
          // evitando de chegar na criação de reservas fantasmas (zombie transaction)
          throw new Error("ROLLBACK_TRIGGER"); // Dispara o rollback
        }

        // Se chegou aqui, garantiu o ingresso. Cria a reserva.
        await tx.reserva.create({ data: { eventoId } });
      });

      return {
        ok: true,
        data: { id: novaReserva.id, criadoEm: novaReserva.criadoEm },
      };

    } catch (error: unknown) {
        if (error instanceof Error && error.message === "ROLLBACK_TRIGGER") {
        return { ok: false, erro: "ESGOTADO" };
        }

        console.error(error);

        return { ok: false, erro: "ERRO_CONCORRENCIA" };
    }
}