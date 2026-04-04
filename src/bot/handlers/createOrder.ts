import {Bot, InlineKeyboard} from "grammy";
import {prisma} from "../index.js";

const MANAGER_ID = Number(process.env.MANAGER_ID);

// простой парсер
function parseOrder(text: string) {
    const get = (key: string) => {
        const regex = new RegExp(`${key}:\\s*(.*)`, "i");
        return text.match(regex)?.[1]?.trim();
    };

    const getNumber = (key: string) => {
        const val = get(key);
        return val ? parseFloat(val.replace(/[^\d.]/g, "")) : null;
    };

    const slotsVal = getNumber("Ведущих") || 1;

    return {
        date: get("Дата"),
        time: get("Время"),
        address: get("Адрес"),
        price: get("Бюджет"),
        comment: get("Комментарий"),
        tariff: get("Тариф"),
        clientContact: get("Контакт"),
        people: get("Кол-во"),
        totalCost: getNumber("Стоимость"),
        remainingPayment: getNumber("Остаток"),
        advancePayment: getNumber("Предоплата"),
        extension: get("Продление"),
        slots: slotsVal >= 1 ? slotsVal : 1,
    };
}

export const waitingForOrderUsers = new Set<number>();
export const waitingForEditUsers = new Map<number, number>();

function buildOrderText(order: any): string {
    const parts = [];
    if (order.tariff) parts.push(`Тариф: ${order.tariff}`);
    if (order.date) parts.push(`Дата: ${order.date}`);
    if (order.time) parts.push(`Время: ${order.time}`);
    if (order.address) parts.push(`Адрес: ${order.address}`);
    if (order.people) parts.push(`Кол-во: ${order.people}`);
    if (order.comment) parts.push(`Комментарий: ${order.comment}`);
    if (order.clientContact) parts.push(`Контакт клиента: ${order.clientContact}`);
    if (order.totalCost) parts.push(`Стоимость: ${order.totalCost}`);
    if (order.advancePayment) parts.push(`Предоплата: ${order.advancePayment}`);
    if (order.remainingPayment) parts.push(`Остаток: ${order.remainingPayment}`);
    if (order.extension) parts.push(`Продление: ${order.extension}`);
    return parts.join("\n");
}

function buildPublicOrderText(order: any): string {
    const parts = [];
    if (order.tariff) parts.push(`Тариф: ${order.tariff}`);
    if (order.date) parts.push(`Дата: ${order.date}`);
    if (order.time) parts.push(`Время: ${order.time}`);
    if (order.address) parts.push(`Адрес: ${order.address}`);
    if (order.people) parts.push(`Кол-во: ${order.people}`);
    if (order.comment) parts.push(`Комментарий: ${order.comment}`);
    return parts.join("\n");
}

function buildFullOrderText(order: any): string {
    const parts = [];
    if (order.tariff) parts.push(`Тариф: ${order.tariff}`);
    if (order.date) parts.push(`Дата: ${order.date}`);
    if (order.time) parts.push(`Время: ${order.time}`);
    if (order.address) parts.push(`Адрес: ${order.address}`);
    if (order.people) parts.push(`Кол-во: ${order.people}`);
    if (order.comment) parts.push(`Комментарий: ${order.comment}`);
    if (order.clientContact) parts.push(`Контакт клиента: ${order.clientContact}`);
    if (order.totalCost) parts.push(`Стоимость: ${order.totalCost}`);
    if (order.remainingPayment) parts.push(`Остаток оплаты: ${order.remainingPayment}`);
    return parts.join("\n");
}

export function setupCreateOrder(bot: Bot) {

    // редактирование заказа
    bot.command("editorder", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const host = await prisma.host.findUnique({
            where: {telegramId: String(userId)},
        });

        if (!host?.isAdmin) {
            return ctx.reply("У тебя нет прав на редактирование заказов 🔒");
        }
        if (!ctx.message?.text) return
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
            `Редактирование заказа №${orderId}\n\nТекущие данные:\n${buildOrderText(order)}\n\nОтправь новые данные (можно только изменяемые поля):`
        );
    });

    // создание заказа
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

        const text = ctx.message.text;

        // редактирование заказа
        const editOrderId = waitingForEditUsers.get(userId);
        if (editOrderId) {
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

            const mergedOrder = {...oldOrder, ...updatedData};
            const order = await prisma.order.update({
                where: {id: editOrderId},
                data: {
                    ...updatedData,
                    text: buildOrderText(mergedOrder),
                },
                include: {hosts: {include: {host: true}}},
            });

            waitingForEditUsers.delete(userId);
            await ctx.reply("Заказ обновлён ✅");

            for (const oh of order.hosts) {
                await ctx.api.sendMessage(
                    oh.host.telegramId,
                    `📝 Заказ №${editOrderId} был изменён:\n\n${buildFullOrderText(order)}`
                );
            }
            return;
        }

        // создание заказа
        if (!waitingForOrderUsers.has(userId)) return next();

        const data = parseOrder(text);

        const order = await prisma.order.create({
            data: {
                ...data,
                text: buildOrderText(data),
            },
        });

        waitingForOrderUsers.delete(userId);

        await ctx.reply("Заказ сохранён ✅");

        const hosts = await prisma.host.findMany();

        for (const host of hosts) {
            const keyboard = new InlineKeyboard()
                .text("✅ Принять", `accept_${order.id}`)
                .text("❌ Отказаться", `reject_${order.id}`);

            await ctx.api.sendMessage(
                host.telegramId,
                `📢 Новый заказ №${order.id}:\n\n${buildPublicOrderText(order)}`,
                {
                    reply_markup: keyboard,
                }
            );
        }

        await ctx.reply("Заказ отправлен ведущим ✅");
        return next();
    });

    // принять заказ
    bot.callbackQuery(/^accept_(\d+)$/, async (ctx) => {
        const orderId = Number(ctx.match[1]);

        const order = await prisma.order.findUnique({
            where: {id: orderId},
            include: {hosts: {include: {host: true}}},
        });

        if (!order) return;

        const host = await prisma.host.findUnique({
            where: {telegramId: String(ctx.from?.id)},
        });

        if (!host) {
            return ctx.answerCallbackQuery({
                text: "Ты не зарегистрирован как ведущий",
                show_alert: true,
            });
        }

        const existingHost = order.hosts.find(h => h.hostId === host.id);
        if (existingHost) {
            return ctx.answerCallbackQuery({
                text: "Ты уже принял этот заказ",
                show_alert: true,
            });
        }

        const currentHosts = order.hosts.length;
        if (currentHosts >= order.slots) {
            return ctx.answerCallbackQuery({
                text: "Все слоты уже заняты",
                show_alert: true,
            });
        }

        await prisma.orderHost.create({
            data: {
                orderId,
                hostId: host.id,
            },
        });

        const newCount = currentHosts + 1;
        const isFull = newCount >= order.slots;

        if (isFull) {
            await prisma.order.update({
                where: {id: orderId},
                data: {status: "full"},
            });
        }

        await ctx.answerCallbackQuery("Ты принял заказ ✅");

        const hostNames = order.hosts.map(h => h.host.name).concat(host.name).join(", ");
        await ctx.editMessageText(
            `📦 Заказ №${orderId} принят (${newCount}/${order.slots}): ${hostNames}`
        );

        await ctx.api.sendMessage(
            host.telegramId,
            `✅ Заказ №${orderId} принят (${newCount}/${order.slots})\n\n${buildFullOrderText(order)}`
        );

        if (isFull) {
            await ctx.api.sendMessage(
                MANAGER_ID,
                `🎉 Заказ №${orderId} полностью заполнен ведущими!\n\n👤 Ведущие: ${hostNames}\n\n${buildFullOrderText(order)}`
            );
        } else {
            await ctx.api.sendMessage(
                MANAGER_ID,
                `📦 Заказ №${orderId} принят (${newCount}/${order.slots})\n\n👤 Ведущий: ${host.name}\n\n${buildFullOrderText(order)}`
            );
        }
    });

    // отказ
    bot.callbackQuery(/^reject_(\d+)$/, async (ctx) => {
        await ctx.answerCallbackQuery("Отклонено");
    });

}