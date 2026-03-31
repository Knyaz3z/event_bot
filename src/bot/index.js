import "dotenv/config";
import { Bot } from "grammy";
import { PrismaClient } from "@prisma/client";
import { setupCreateOrder } from "./handlers/createOrder.js";
import { setupMyOrders } from "./handlers/myOrders.js";
import { setupReminders, startNotifications } from "./handlers/notifications.js";
export const prisma = new PrismaClient();
const bot = new Bot(process.env.BOT_TOKEN);
bot.command("start", (ctx) => {
    ctx.reply("Бот запущен 🚀");
});
bot.command("register", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId)
        return;
    const existing = await prisma.host.findUnique({
        where: { telegramId: String(userId) },
    });
    if (existing) {
        return ctx.reply("Ты уже зарегистрирован");
    }
    if (!ctx.from)
        return;
    await prisma.host.create({
        data: {
            telegramId: String(userId),
            name: ctx.from.first_name || "Без имени",
        },
    });
    ctx.reply("Ты зарегистрирован как ведущий ✅");
});
setupReminders(bot);
setupMyOrders(bot);
setupCreateOrder(bot);
bot.start();
startNotifications(bot);
