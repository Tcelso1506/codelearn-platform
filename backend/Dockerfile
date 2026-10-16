FROM node:20-alpine

# O Prisma precisa do OpenSSL no Alpine para carregar o query engine.
RUN apk add --no-cache openssl

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN npx prisma generate

EXPOSE 3333

# Desenvolvimento: sincroniza o schema com o banco (`db push`), popula o
# conteúdo de exemplo (o seed é idempotente) e sobe a API em modo watch.
#
# Para PRODUÇÃO, gere migrations versionadas (`npx prisma migrate dev --name init`),
# commite a pasta prisma/migrations e troque `db push` por `prisma migrate deploy`.
CMD ["sh", "-c", "npx prisma db push --skip-generate && npm run prisma:seed && npm run dev"]
