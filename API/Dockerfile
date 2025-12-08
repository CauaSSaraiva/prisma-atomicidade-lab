FROM node:22-alpine

# instala dependências necessárias
RUN apk add --no-cache openssl

# Define a pasta de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de configuração 
COPY package*.json ./

# Copia a pasta prisma para gerar o cliente antes do código
COPY prisma ./prisma/

# Instala as dependências
RUN npm install

# Gera o binário do Prisma (Crucial!)
RUN npx prisma generate

# Copia o restante do código fonte
COPY . .

# Expõe a porta que a API usa
EXPOSE 3004

# 1. Cria as tabelas (migrate deploy)
# 2. Popula o banco para o teste (db seed)
# 3. Inicia a API (npm run dev)
CMD ["sh", "-c", "echo '⏳ Esperando o MySQL iniciar...' && sleep 10 && npx prisma migrate deploy && npx prisma db seed && npm run dev"]