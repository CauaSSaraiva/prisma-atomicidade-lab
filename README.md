# Rest API: Estudo de Concorrência e Atomicidade

Este projeto é um laboratório prático que demonstra como o padrão **Read-Modify-Write** realizado na camada de aplicação pode gerar **Race Conditions**, mesmo em ambientes **single-thread como o Node.js**.

A falha ocorre por **falta de atomicidade** entre leitura e escrita sob concorrência, resultando em **Lost Updates** e inconsistência de dados. A solução correta é delegar **atomicidade e isolamento** ao banco de dados, utilizando **operações atômicas dentro de transações**.

## O Problema: "Lost Update" e Overselling

Quando múltiplos usuários tentam comprar o último ingresso simultaneamente, sistemas sem tratamento de concorrência falham duplamente.

1. **Lost Update (Estoque Incorreto):** Múltiplas requisições concorrentes leem o saldo inicial (10), subtraem 1 e salvam 9. O banco termina dizendo que ainda sobram ingressos (ex: 7), ignorando as outras vendas.

2. **Overselling (Vendas Excedentes):** Como todas as 20 threads "acharam" que havia estoque, a aplicação cria **20 reservas confirmadas** para apenas 10 assentos reais.

**Resultado:** Inconsistência financeira e de dados severa.

## A Solução: Atomicidade e Locking
Foi Implementado uma abordagem utilizando `updateMany` do Prisma com **Guard Clauses** (`ingressos > 0`) executadas diretamente no motor do MySQL. Isso delega a responsabilidade para o banco (ACID), que utiliza **Row Locking** para enfileirar as requisições, garantindo que apenas a primeira venda passe e as subsequentes sejam rejeitadas.

##  Tecnologias
- **Node.js 22** & **TypeScript**
- **Prisma ORM** (Com Transactions e Atomic Operations)
- **MySQL 8** (Containerizado)
- **Docker & Docker Compose** (Infraestrutura como Código)
- **K6** (Testes de Carga e Simulação de Concorrência)



##  Como Rodar (Zero Configuração)

Este projeto de exemplo utiliza Docker.

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/CauaSSaraiva/prisma-atomicidade-lab.git
2. **Suba o ambiente:**
   ```bash
   docker-compose up --build
*Aguarde até aparecer a mensagem "Servidor rodando na porta: 3004". O banco será criado, migrado e populado automaticamente.*



##  Testando a Concorrência (Laboratório Automatizado com K6)

Este laboratório utiliza o **K6** (rodando via Docker) para simular alta concorrência real.

> **ℹ️ Premissa do Teste:** O banco de dados é resetado automaticamente antes de cada cenário contendo sempre **10 Ingressos Disponíveis**.

Os comandos abaixo realizam automaticamente o ciclo completo: **Reset do Banco** ➔ **Ataque de Carga** ➔ **Validação de Logs**.

Abra um **novo terminal** na raiz do projeto e execute os cenários:

### Cenário 1: Testar Vulnerabilidade (Race Condition)

Simula 20 usuários tentando comprar o mesmo ingresso simultaneamente na rota sem tratamento.

```bash
npm run test:vulnerable
```

**O que observar no output:**

  - **Checks (`✓ status ok`):** Você verá 20 sucessos neste check. Isso significa que todos os 20 usuários receberam confirmação de compra (Status 200), o que é errado.

  - **Log Final (O Bug):**
      - `Reservas Feitas: 20` (O sistema vendeu o dobro do permitido).

      - `Disponíveis: 7` (Bug do **Lost Update**: Várias threads leram o saldo ao mesmo tempo e sobrescreveram o decremento das outras. Apenas 3 ingressos foram efetivamente debitados, apesar de 20 vendas confirmadas em "Reservas Feitas").

### Cenário 2: Testar Correção (Atomicidade)

Simula o mesmo ataque na rota protegida por transações atômicas e Row Locking.

```bash
npm run test:safe
```

**O que observar no output:**

  - **Checks:** O K6 mostrará `50%` de falha nos checks. **Isso é o esperado\!** Significa que metade dos usuários conseguiu (Status 200) e a outra metade foi barrada corretamente pelo banco (Status 409).

  - **Log Final:** O banco mostrará integridade perfeita:
    ```text
    Disponíveis   : 0
    Reservas Feitas: 10
    ```


##  Arquitetura da Solução

### Rota Insegura (`/comprar-ruim`)
Esta rota simula o padrão vulnerável **Read-Modify-Write** feito na memória:
1.  **Read:** Busca o evento. Todas as requisições leem `total: 10`.
    ```typescript
    const evento = await prisma.evento.findUnique({ where: { id } });
    ```

2.  **Modify:** O Node.js verifica `if (10 > 0)` e calcula `10 - 1 = 9`.

3.  **Write:** Todas as requisições que entraram no `if` tentam salvar o **mesmo valor**.
    ```typescript
    await prisma.evento.update({
      where: { id: eventoId },
      data: { ingressosDisponiveis: evento.ingressosDisponiveis - 1 } // Todas salvam "9", cálculo na memória
    });
    ```
4.  **A Falha (Lost Update):** Como não há bloqueio (**Lock**) entre a leitura e a escrita, múltiplas requisições entram no `if` simultaneamente. Elas "atropelam" umas as outras enviando exatamente o mesmo comando (`SET ingressos = 9`) para o banco. Resultando em apenas 1 decremento efetivo no saldo final.

5.  **O Impacto (Overselling):** O pior acontece depois: como o `if` passou, a aplicação segue fluxo e cria o registro na tabela `Reserva`. Resultado: **20 reservas criadas** para um banco que diz ter 7 ingressos sobrando (totalmente inconsistente).

### Rota Segura (`/comprar-bom`)
Esta rota delega a responsabilidade para o banco de dados (ACID), dentro de uma transaction:

1.  Usa `prisma.$transaction`.

2.  Executa um **Atomic Update com Guard Clause**:
    ```typescript
      const evento = await tx.evento.updateMany({
        where: {
          id: eventoId,
          ingressosDisponiveis: { gt: 0 }, // Guard Clause
        },
        data: {
          ingressosDisponiveis: { decrement: 1 }, // Atomicidade (decrement)
        },
      });
    ```
3.  **Validação de Resultado:**
    Usa o retorno do `updateMany` para confirmar se a operação foi aceita. Se o banco retornar `count: 0`, significa que a cláusula `gt: 0` falhou (estoque esgotado).
    ```typescript
    if (evento.count === 0) {
        throw new Error("Não há ingressos suficientes"); // Dispara o rollback
    }
    ```
    Isso cancela a transação imediatamente, impedindo a criação de reservas fantasmas.

4.  **Como funciona nos Bastidores (Row Locking):**
    Ao receber o comando do **passo 2**, o banco de dados trava a linha do evento.
    * **Fila:** Se 20 requisições chegarem juntas, a primeira trava a linha e as outras 19 ficam em espera (fila).
    * **Execução:** Quando a primeira termina (decrementa para 9), a segunda assume, lê 9 e decrementa para 8.
    * **Barreira:** Quando o saldo chega a 0, a condição `{ gt: 0 }` falha para as restantes. O banco não atualiza nada (`count: 0`) e a aplicação dispara o erro do **passo 3**.
