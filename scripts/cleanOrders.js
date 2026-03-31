import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
    await prisma.order.deleteMany();
    console.log("Все заказы удалены");
}
main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
