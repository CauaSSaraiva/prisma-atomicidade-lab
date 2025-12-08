import { prisma } from "../prisma";

async function main() {
  // ID fixo usado no script de teste
  const ID_FIXO = "55555555-5555-5555-5555-555555555555";

  // Limpa o banco antes (garantir estado limpo)
  await prisma.reserva.deleteMany({});
  await prisma.evento.deleteMany({});

  const evento = await prisma.evento.upsert({
    where: { id: ID_FIXO },
    update: {
      totalIngressos: 10,
      ingressosDisponiveis: 10,
    },
    create: {
      id: ID_FIXO, 
      nome: "Show do Caos (Teste Automatizado)",
      totalIngressos: 10,
      ingressosDisponiveis: 10,
    },
  });

  console.log(`Evento criado com ID Fixo: ${evento.id}`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
