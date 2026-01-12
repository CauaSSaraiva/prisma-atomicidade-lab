import { prisma } from "../prisma";
import { type Evento } from "@prisma/client"; 
import { type ServiceResult } from "../utils/types/service-result";

export type EventoPublico = Pick<Evento, "id" | "nome" | "totalIngressos">;

type ResultadoCriacao = ServiceResult<EventoPublico, "DADOS_INVALIDOS" | "ERRO_INTERNO">;

type DadosCriacao = Omit<
  Evento,
  "id" | "ingressosDisponiveis" | "criadoEm" | "atualizadoEm"
>;

// Logs Sistema 
export type LogSistema = {
  eventos: Evento[];       
  totalReservas: number;   
};

type LogResult = ServiceResult<LogSistema, "ERRO_LEITURA_LOG">;


export const criarEventoService = async (
  dados: DadosCriacao
): Promise<ResultadoCriacao> => {
  try {

    if (!dados.nome || dados.totalIngressos <= 0) {
      return { ok: false, erro: "DADOS_INVALIDOS" };
    }

    const novoEvento = await prisma.evento.create({
      data: {
        nome: dados.nome,
        totalIngressos: dados.totalIngressos,
        ingressosDisponiveis: dados.totalIngressos,
      },
    });

    // Sucesso
    return { ok: true, data: novoEvento };

  } catch (error: unknown) {
    if (error instanceof Error) {
        console.error("Erro no Service:", error.message);
    } else {
        console.error("Erro Desconhecido:", error);
    }

    return { ok: false, erro: "ERRO_INTERNO" };
  }
};

export const exibirEventoLog = async (): Promise<LogResult> => {
    try {
    const ID_TESTE = "55555555-5555-5555-5555-555555555555";

    const [listaEventos, contagemReservas] = await Promise.all([
        prisma.evento.findMany({}),
        prisma.reserva.count({
          where: { eventoId: ID_TESTE },
        }),
      ]);

      return {
        ok: true,
        data: {
            eventos: listaEventos,
            totalReservas: contagemReservas
        }
      }

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("Erro ao gerar log:", error.message);
        } else {
            console.error("Erro Desconhecido:", error);
        }
        return {ok: false, erro: "ERRO_LEITURA_LOG"}
    }
};

