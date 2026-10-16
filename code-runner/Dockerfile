FROM node:20-alpine

# docker-cli: só o cliente — este container fala com o daemon do host através do
# socket montado em /var/run/docker.sock (padrão "Docker fora do Docker").
# openssl: exigido pelo Prisma no Alpine. Ver README.md desta pasta para a
# discussão de segurança dessa escolha.
RUN apk add --no-cache docker-cli openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npx prisma generate

CMD ["npm", "run", "dev"]
