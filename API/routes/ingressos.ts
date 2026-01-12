import { Router } from "express"
import { comprarIngressoRuim } from "../services/ingresso.service";
import { comprarIngressoBom } from "../services/ingresso.service";

const router = Router()


router.post("/comprar-ruim", async (req, res) => {
  const { eventoId } = req.body;

  const resultado = await comprarIngressoRuim(eventoId);

  if (resultado.ok) {
    return res.status(200).json({
       message: "Comprado sem segurança.",
       data: resultado.data 
      });
  } 
 
  const status = resultado.erro === "EVENTO_NAO_ENCONTRADO" ? 404 : 400;
  return res.status(status).json({ error: "Erro: " + resultado.erro });
})

router.post("/comprar-bom", async (req, res) => {
  const { eventoId } = req.body;

  const resultado = await comprarIngressoBom(eventoId)

  if (resultado.ok) {
    return res.status(200).json({
      message: "Comprado com segurança!",
      data: resultado.data
    })
  } 

  return res.status(409).json({error: "Erro: " + resultado.erro})
})










export default router;