import {Bot} from "grammy";
import {prisma} from "../../index.js";
import {formatFullOrderText, formatOrderText, formatPublicOrderText} from "../../utils/formatters.js";
import {parseOrder} from "../../utils/parsers.js";
import {createGoogleCalendarEvent} from "../../../googleCalendar.js";

const MANAGER_ID = Number(process.env.MANAGER_ID);

export const waitingForOrderUsers = new Set<number>();
export const waitingForEditUsers = new Map<number, number>();

export function setupCreateOrder(bot: Bot) {
    bot.command("neworder", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const host = await prisma.host.findUnique({
            where: {telegramId: String(userId)},
        });

        if (!host?.isAdmin) {
            return ctx.reply("У тебя нет прав на создание заказов 🔒");
        }

        waitingForOrderUsers.add(userId);
        await ctx.reply("Отправь заказ одним сообщением 👇");
    });

    bot.on("message:text", async (ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) return next();

        if (!waitingForOrderUsers.has(userId)) return next();

        const text = ctx.message.text;
        const data = parseOrder(text);

        const googleEventId = await createGoogleCalendarEvent({
            date: data.date,
            time: data.time,
            address: data.address,
            tariff: data.tariff,
            comment: data.comment,
            clientContact: data.clientContact,
            people: data.people,
            totalCost: data.totalCost,
            advancePayment: data.advancePayment,
            remainingPayment: data.remainingPayment,
            extension: data.extension,
        });

        const order = await prisma.order.create({
            data: {
                ...data,
                text: formatOrderText(data),
                googleEventId: googleEventId,
            },
        });

        waitingForOrderUsers.delete(userId);

        const googleMsg = googleEventId ? " и в Google Calendar ✅" : "";
        await ctx.reply(`Заказ сохранён${googleMsg}`);

        const hosts = await prisma.host.findMany();

        for (const host of hosts) {
            const {InlineKeyboard} = await import("grammy");
            const keyboard = new InlineKeyboard()
                .text("✅ Принять", `accept_${order.id}`)
                .text("❌ Отказаться", `reject_${order.id}`);

            await ctx.api.sendMessage(
                host.telegramId,
                `📢 Новый заказ №${order.id}:\n\n${formatPublicOrderText(order)}`,
                { reply_markup: keyboard }
            );
        }

        await ctx.reply("Заказ отправлен ведущим ✅");
        return next();
    });
}
