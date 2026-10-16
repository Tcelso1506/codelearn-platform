import { PrismaClient } from "@prisma/client";

// Uso: npm run make-admin -- email@exemplo.com
// Promove um usuário JÁ CADASTRADO a administrador.
const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Informe o e-mail: npm run make-admin -- email@exemplo.com");
    process.exit(1);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Nenhum usuário encontrado com o e-mail ${email}. Cadastre-se primeiro pelo site.`);
    process.exit(1);
  }

  await prisma.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
  console.log(`${email} agora é ADMIN.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
