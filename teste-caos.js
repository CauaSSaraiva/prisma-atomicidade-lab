// teste-caos.js

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);


const PORTA = 3004;
const BASE_URL = `http://localhost:${PORTA}`;
const EVENTO_ID = '55555555-5555-5555-5555-555555555555';
const REQUISICOES = 20;

// Log para exibição
async function verificarLog() {
  try {
    const res = await fetch(`${BASE_URL}/eventos/log`);
    const json = await res.json();

    const disponiveis = json.data.evento.evento[0].ingressosDisponiveis;
    const totalReservas = json.data.reservas.totalReservas;

    const width = 30;
    console.log(`[BANCO DE DADOS]`.padStart(width));
    console.log(`Disponíveis: ${disponiveis}`.padStart(width));
    console.log(`Reservas Feitas: ${totalReservas}`.padStart(width));
    
  } catch (e) {
    console.log('\n Erro ao ler log (API offline?)');
  }
}

// Resetar banco para testes entre diferentes rotas (boa e ruim)
async function resetarBanco() {
  process.stdout.write('\nResetando banco de dados (Seed)... ');
  try {
    // Comando que entra no container e roda o seed
    await execPromise('docker-compose exec api npx prisma db seed'); 
    console.log('Banco Limpo.');
  } catch (e) {
    console.error('\n Erro ao rodar seed. O Docker está rodando?');
    process.exit(1);
  }
}

// Função de ataque
async function atacar(nome, rota) {
  console.log("\n" + "=".repeat(30));
  console.log(` CENÁRIO: ${nome}`);
  console.log("\n" + "=".repeat(30));

  const url = `${BASE_URL}${rota}`;
  const payload = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventoId: EVENTO_ID }),
  };

  const requests = [];
  for (let i = 0; i < REQUISICOES; i++) {
    requests.push(fetch(url, payload).then(res => res.status));
  }

  // Espera todas as requisições terminarem
  const statusCodes = await Promise.all(requests);

  // Contagem
  const sucessos = statusCodes.filter(c => c === 200 || c === 201).length;
  const falhas = statusCodes.filter(c => c >= 400).length;

  console.log(` HTTP: ${sucessos} Sucessos \n ${falhas} Falhas`);
  
  // Confere o banco e exibe Log/detalhes
  await verificarLog();
}

async function main() {
  console.log(` INICIANDO LAB DE CONCORRENCIA`);
  console.log(`O script irá resetar o banco automaticamente via Docker.`);


  // 1. Teste Vulnerável (Lost Update, Zombie Transaction...)
  await resetarBanco();
  await atacar('ROTA RUIM (Vulnerável)', '/ingressos/comprar-ruim');

  // 2. Teste Seguro (Atomicidade)
  await resetarBanco();
  await atacar('ROTA BOA (Segura)', '/ingressos/comprar-bom');
}

main();