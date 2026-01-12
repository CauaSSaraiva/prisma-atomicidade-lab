import { Router } from "express"
import { criarEventoService } from "../services/evento.service";
import { exibirEventoLog } from "../services/evento.service";

const router = Router()


router.post("/", async (req, res) => {
  const { nome, totalIngressos } = req.body;

  const resultado = await criarEventoService({
    nome,
    totalIngressos: Number(totalIngressos)
  });

  if (resultado.ok) {
    return res.status(201).json(resultado.data);
  }

  return res.status(400).json({ error: "Erro " + resultado.erro });
});

router.get("/log", async (req, res) => {

    const resultado = await exibirEventoLog()

    if (resultado.ok) {
      return res.status(200).json({
        message: "Log Gerado",
        data: resultado.data
      })
    }
      
    return res.status(500).json({ error: "Erro " + resultado.erro });
});






export default router;