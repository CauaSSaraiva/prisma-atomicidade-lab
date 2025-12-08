import express from 'express'
import cors from 'cors'

import ingressosRoutes from './routes/ingressos'
import eventosRoutes from './routes/eventos'

const app = express()
const port = 3004

app.use(express.json())
app.use(cors())

app.use("/ingressos", ingressosRoutes)
app.use("/eventos", eventosRoutes)



app.get('/', (req, res) => {
  res.send('Rest API: Exemplo de Atomicidade')
})

app.listen(port, () => {
  console.log(`Servidor rodando na porta: ${port}`)
})


