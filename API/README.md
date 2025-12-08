# Rest API: Estudo de Concorrência e Atomicidade

Este projeto é um laboratório prático demonstrando problemas de **Condição de Corrida (Race Conditions)** e como solucioná-los utilizando **Transações Atômicas** e **Locking** com Prisma ORM e MySQL.

##  O Problema: "Lost Update"
Quando múltiplos usuários tentam comprar o último ingresso simultaneamente, sistemas sem tratamento de concorrência sofrem do bug "Lost Update". Duas threads leem que o saldo é `1`, ambas vendem, e o saldo final vira `0` (mas foram feitas 2 vendas).

##  A Solução: Atomicidade no Banco
Implementei uma abordagem utilizando `updateMany` com cláusulas de guarda (`ingressos > 0`) executadas diretamente no motor do banco de dados (MySQL). Isso garante que o **Row Locking** do banco gerencie a fila de escrita, impedindo vendas excedentes.

##  Tecnologias
- **Node.js 22** & **TypeScript**
- **Prisma ORM** (Com Transactions e Atomic Operations)
- **MySQL 8** (Containerizado)
- **Docker & Docker Compose** (Infraestrutura como Código)

---

##  Como Rodar (Zero Configuração)

Este projeto de exemplo utiliza Docker.

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/CauaSSaraiva/prisma-atomicidade-lab.git
2. **Suba o ambiente:**
   ```bash
   docker-compose up --build

*Aguarde até aparecer a mensagem "Server running on port 3004". O banco será criado, migrado e populado automaticamente.*

-----

##  Testando a Concorrência (Laboratório Automatizado)

O projeto inclui um script de **Chaos Testing** (`teste-caos.js`) que simula 20 usuários comprando simultaneamente. O script gerencia automaticamente o reset do banco de dados via Docker entre os testes.

Para ver a mágica acontecer, abra um **novo terminal** na raiz do projeto e rode:

```bash
node teste-caos.js
```

O script executará a seguinte sequência:

### 1️ - Cenário Vulnerável (Rota `/comprar-ruim`)

  - **Ação:** Dispara 20 requisições simultâneas sem trava de segurança.
  - **Resultado Esperado:** Falha de integridade.
  - **Log:** `20 Sucessos` (Vendeu mais do que o estoque permitia).
  - **Observação:** O estoque final no banco pode variar (ex: 9, 7 ou 5) devido à natureza não determinística da Race Condition.

### 2️ - Cenário Seguro (Rota `/comprar-bom`)

  - **Ação:** Reseta o banco e dispara 20 requisições usando Transações Atômicas.
  - **Resultado Esperado:** Sucesso.
  - **Log:** `10 Sucessos` e `10 Falhas` (O sistema bloqueou corretamente o excesso via erro 409).
  - **Observação:** O estoque final será estritamente `0` e o total de reservas será `10`.

-----

##  Arquitetura da Solução

### Rota Insegura (`/comprar-ruim`)
Esta rota simula o padrão vulnerável **Read-Modify-Write** feito na memória:
1.  **Read:** Busca o evento (`SELECT *`). Todas as requisições leem `total: 10`.
2.  **Modify:** O Node.js verifica `if (10 > 0)` e calcula `10 - 1 = 9`.
3.  **Write:** Manda salvar o valor fixo (`UPDATE ... SET ingressos = 9`).
4.  **A Falha:** Como não há bloqueio (**Lock**) entre a leitura e a escrita, múltiplas requisições entram no `if` simultaneamente. Elas "atropelam" umas as outras enviando o mesmo valor final para o banco, resultando em apenas 1 decremento efetivo para N vendas (Lost Update).

### Rota Segura (`/comprar-bom`)
Esta rota delega a responsabilidade para o banco de dados (ACID):
1.  Usa `prisma.$transaction`.
2.  Executa um **Atomic Update com Guard Clause**:
    ```sql
    UPDATE Evento SET ingressos = ingressos - 1
    WHERE id = '...' AND ingressos > 0
    ```
3.  Usa `updateMany` para verificar o `count` de linhas afetadas.
4.  **O Sucesso:** O banco trava a linha (**Row Lock**) assim que a primeira requisição tenta alterar. As outras ficam na fila. Quando a primeira termina (saldo vira 9), a segunda executa, lê 9 e atualiza para 8. Se o saldo for 0, a condição falha, o banco não atualiza nada e a aplicação força o `ROLLBACK`.
