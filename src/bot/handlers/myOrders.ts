import {Bot} from "grammy";
import {prisma} from "../index.js";

export function setupMyOrders(bot: Bot) {
    bot.command("myorders", async (ctx) => {

        
        const host = await prisma.host.findUnique({
            where: { telegramId: String(ctx.from?.id) },
        });

        if (!host) {
            return ctx.reply("Ты не зарегистрирован как ведущий");
        }

        const orders = await prisma.order.findMany({
            where: {
                hosts: {
                    some: { hostId: host.id }
                },
                status: { not: "open" },
            },
            include: {
                hosts: { include: { host: true } }
            },
            orderBy: {
                createdAt: "desc",
            },
        });
        
        if (orders.length === 0) {
            return ctx.reply("У тебя пока нет заказов");
        }

        const message = orders.map((order) => {
            return `📦 Заказ №${order.id}\n\n${order.text}`;
        }).join("\n\n----------------\n\n");

        await ctx.reply(message);
    });
}
