import {Bot} from "grammy";
import {prisma} from "../../index.js";
import {formatFullOrderText, formatOrderText} from "../../utils/formatters.js";
import {parseOrder} from "../../utils/parsers.js";
import {waitingForEditUsers} from "./createOrder.js";
import {updateGoogleCalendarEvent} from "../../../googleCalendar.js";

export function setupEditOrder(bot: Bot) {
    bot.command("editorder", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const host = await prisma.host.findUnique({
            where: {telegramId: String(userId)},
        });

        if (!host?.isAdmin) {
            return ctx.reply("У тебя нет прав на редактирование заказов 🔒");
        }
        if (!ctx.message?.text) return;
        const args = ctx.message.text.split(" ").slice(1);
        if (args.length === 0) {
            return ctx.reply("Использование: /editorder <id заказа>\n\nПример: /editorder 5");
        }

        const orderId = Number(args[0]);
        const order = await prisma.order.findUnique({
            where: {id: orderId},
        });

        if (!order) {
            return ctx.reply("Заказ не найден ❌");
        }

        waitingForEditUsers.set(userId, orderId);
        await ctx.reply(
            `Редактирование заказа №${orderId}\n\nТекущие данные:\n${formatOrderText(order)}\n\nОтправь новые данные (можно только изменяемые поля):`
        );
    });

    bot.on("message:text", async (ctx, next) => {
        const userId = ctx.from?.id;
        if (!userId) return next();

        const editOrderId = waitingForEditUsers.get(userId);
        if (!editOrderId) return next();

        const text = ctx.message.text;
        const oldOrder = await prisma.order.findUnique({
            where: {id: editOrderId},
            include: {hosts: {include: {host: true}}},
        });

        if (!oldOrder) {
            waitingForEditUsers.delete(userId);
            return ctx.reply("Заказ не найден ❌");
        }

        const newData = parseOrder(text);
        const updatedData: any = {};
        if (newData.date) updatedData.date = newData.date;
        if (newData.time) updatedData.time = newData.time;
        if (newData.address) updatedData.address = newData.address;
        if (newData.price) updatedData.price = newData.price;
        if (newData.comment) updatedData.comment = newData.comment;
        if (newData.tariff) updatedData.tariff = newData.tariff;
        if (newData.clientContact) updatedData.clientContact = newData.clientContact;
        if (newData.people) updatedData.people = newData.people;
        if (newData.totalCost) updatedData.totalCost = newData.totalCost;
        if (newData.remainingPayment) updatedData.remainingPayment = newData.remainingPayment;
        if (newData.advancePayment) updatedData.advancePayment = newData.advancePayment;
        if (newData.extension) updatedData.extension = newData.extension;

        const mergedOrder = {...oldOrder, ...updatedData};
        const order = await prisma.order.update({
            where: {id: editOrderId},
            data: {
                ...updatedData,
                text: formatOrderText(mergedOrder),
            },
            include: {hosts: {include: {host: true}}},
        });

        waitingForEditUsers.delete(userId);

        if (oldOrder.googleEventId) {
            await updateGoogleCalendarEvent(oldOrder.googleEventId, {
                date: order.date,
                time: order.time,
                address: order.address,
                tariff: order.tariff,
                comment: order.comment,
                clientContact: order.clientContact,
                people: order.people,
                totalCost: order.totalCost,
                advancePayment: order.advancePayment as number | null | undefined,
                remainingPayment: order.remainingPayment as number | null | undefined,
                extension: order.extension,
            });
        }

        const googleMsg = oldOrder.googleEventId ? " и в Google Calendar ✅" : "";
        await ctx.reply(`Заказ обновлён${googleMsg}`);

        for (const oh of order.hosts) {
            await ctx.api.sendMessage(
                oh.host.telegramId,
                `📝 Заказ №${editOrderId} был изменён:\n\n${formatFullOrderText(order)}`
            );
        }
    });
}
