import "dotenv/config";
import {Bot} from "grammy";
import {PrismaClient} from "@prisma/client";
import {setupCreateOrder} from "./handlers/createOrder.js";
import {setupMyOrders} from "./handlers/myOrders.js";
import {setupReminders, startNotifications} from "./handlers/notifications.js";
import {setupMenu} from "./handlers/menu.js";
import {syncFromGoogleCalendar} from "../googleCalendar.js";

export const prisma = new PrismaClient();

const bot = new Bot(process.env.BOT_TOKEN!);

bot.command("register", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const existing = await prisma.host.findUnique({
        where: { telegramId: String(userId) },
    });

    if (existing) {
        return ctx.reply("Ты уже зарегистрирован");
    }
    if (!ctx.from) return;
    await prisma.host.create({
        data: {
            telegramId: String(userId),

            name: ctx.from.first_name || "Без имени",
        },
    });

    ctx.reply("Ты зарегистрирован как ведущий ✅");
});

setupMenu(bot);
setupReminders(bot);
setupMyOrders(bot);
setupCreateOrder(bot);

bot.command("sync", async (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const host = await prisma.host.findUnique({
        where: { telegramId: String(userId) },
    });

    if (!host?.isAdmin) {
        return ctx.reply("Нет доступа 🔒");
    }

    await ctx.reply("Синхронизирую с Google Calendar...");
    const synced = await syncFromGoogleCalendar();
    await ctx.reply(`Синхронизировано ${synced} событий ✅`);
});

bot.start();
startNotifications(bot);

syncFromGoogleCalendar().then(count => {
    if (count > 0) {
        console.log(`Google Calendar: synced ${count} events on startup`);
    }
});
