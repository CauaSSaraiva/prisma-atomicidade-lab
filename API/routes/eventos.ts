import { Router } from "express"
// import { verificaAutenticacao } from "../middlewares/verificaToken";



import { prisma } from "../prisma";
const router = Router()



router.post("/", async (req, res) => {
    try {
      const { nome, totalIngressos } = req.body;

      const evento = await prisma.evento.create({
        data: {
          nome: nome,
          totalIngressos: Number(totalIngressos),
          ingressosDisponiveis: Number(totalIngressos)
        }
      });

      res.status(201).json({
        message: "Evento Criado com Sucesso",
        data: evento,
      });
    } catch (error) {
      console.error("Erro ao adicionar evento:", error);
      res.status(500).json({ error: "Erro ao processar a solicitação" });
    }
  });

router.get("/log", async (req, res) => {
    try {

      const evento = await prisma.evento.findMany({ });

      const totalReservas = await prisma.reserva.count({
        where: { eventoId: "55555555-5555-5555-5555-555555555555" },
      });

      const log = {
        evento: {evento},
        reservas: {totalReservas}
      }

      res.status(201).json({
        message: "Log do teste gerado com sucesso",
        data: log,
      });
    } catch (error) {
      console.error("Erro ao processar log:", error);
      res.status(500).json({ error: "Erro ao processar a solicitação" });
    }
  });






export default router;