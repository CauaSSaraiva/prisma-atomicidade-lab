// Import the http module to make HTTP requests. From this point, you can use `http` methods to make HTTP requests.
import http from 'k6/http';
// Import the sleep function to introduce delays. From this point, you can use the `sleep` function to introduce delays in your test script.
import { sleep, check } from 'k6';

export const options = {
  // Define the number of iterations for the test
  iterations: 20,
  vus: 20, // 20 usuários virtuais
};

const ROTA = __ENV.ROTA || '/ingressos/comprar-ruim';
const BASE_URL = 'http://api:3004'

export default function() {
    const url = `${BASE_URL}${ROTA}`; 
    
    const payload = JSON.stringify({
        eventoId: '55555555-5555-5555-5555-555555555555',
    });

    const params = {
        headers: { 'Content-Type': 'application/json' },
    };

    const res = http.post(url, payload, params);

    check(res, {
        'status ok': (r) => r.status === 200 || r.status === 201,
        'falha concorrência': (r) => r.status >= 400,
    });
}


export function teardown(data) {
  const res = http.get(`${BASE_URL}/eventos/log`);
  
  if (res.status !== 200) {
    console.error('Erro ao ler log da API');
    return;
  }

  const json = res.json(); 

  const disponiveis = json.data.evento.evento[0].ingressosDisponiveis;
  const totalReservas = json.data.reservas.totalReservas;

  console.log("=".repeat(30));
  console.log(` RESULTADO FINAL (Log do Banco)`);
  console.log("=".repeat(30));
  console.log(` Disponíveis    : ${disponiveis}`);
  console.log(` Reservas Feitas: ${totalReservas}`);
  
// Opcional
//   if (disponiveis < 0 || totalReservas > 10) { 
//       console.error("ERRO GRAVE: Inconsistência detectada no banco!");
//   } else {
//       console.log("Banco consistente.");
//   }
}