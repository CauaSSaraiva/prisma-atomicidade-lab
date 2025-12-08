import { Router } from "express"

import { prisma } from "../prisma";
import type { PrismaClient } from "@prisma/client";
const router = Router()

router.post("/comprar-ruim", async (req, res) => {
    const {eventoId} = req.body;

    const evento = await prisma.evento.findUnique({ where: { id: eventoId } });

    if (!evento) return res.status(404).json({ error: "Evento não encontrado" });

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

      return res.json({ message: "Ingresso comprado!" });
    } else {
      return res.status(400).json({ error: "Esgotado!" });
    }
})


router.post("/comprar-bom", async (req, res) => {
  const { eventoId } = req.body;

  try {
    // Usando Transaction para garantir integridade
    await prisma.$transaction(async (tx: PrismaClient) => {
      // Troca verificação em memória do TS para where do próprio banco
      // e uso do updateMany para verificar quantidade de linhas alteradas
      const evento = await tx.evento.updateMany({
        where: {
          id: eventoId,
          ingressosDisponiveis: { gt: 0 }, // A barreira direta e simples, Row Locking
        },
        data: {
          ingressosDisponiveis: { decrement: 1 }, // Atomicidade (decrement)
        },
      });

      if (evento.count === 0) {
        // Se ninguém foi atualizado, significa que não existia ingresso suficiente
        // e invéz de erro silencioso, lançamos erro e a transaction vai dar rollback
        // evitando de chegar na criação de reservas fantasmas (zombie transaction)
        throw new Error("Não há ingressos suficientes (Rollback forçado)");
      }

      // Se chegou aqui, garantiu o ingresso. Cria a reserva.
      await tx.reserva.create({ data: { eventoId } });
    });

    return res.status(200).json({ message: "Comprado com segurança!" });
  } catch (error) {
    return res
      .status(409)
      .json({ error: "Falha na compra: Esgotado ou Concorrência." });
  }
})










export default router;