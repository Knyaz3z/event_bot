import {Bot, InlineKeyboard} from "grammy";
import {prisma} from "../index.js";
import { waitingForOrderUsers, waitingForEditUsers } from "./createOrder.js";

const MANAGER_ID = Number(process.env.MANAGER_ID);

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

function buildShortOrderText(order: any): string {
    const parts = [`№${order.id}`];
    if (order.tariff) parts.push(order.tariff);
    if (order.date) parts.push(order.date);
    if (order.time) parts.push(order.time);
    return parts.join(" | ");
}

async function getUpcomingOrders(limit = 6) {
    const now = new Date();
    return prisma.order.findMany({
        where: {
            date: { not: null },
        },
        orderBy: [
            { date: "asc" },
            { time: "asc" },
        ],
        take: limit,
    });
}

function buildMainMenuKeyboard() {
    return new InlineKeyboard()
        .text("📋 Ближайшие заказы", "menu_upcoming")
        .row()
        .text("➕ Создать новый заказ", "menu_neworder")
        .row()
        .text("✏️ Редактировать заказ", "menu_editorder");
}

function buildUpcomingOrdersKeyboard(orders: any[]) {
    const keyboard = new InlineKeyboard();
    for (const order of orders) {
        keyboard.text(buildShortOrderText(order), `order_${order.id}`).row();
    }
    keyboard.text("🔙 Назад", "menu_back");
    return keyboard;
}

function buildOrderActionsKeyboard(orderId: number) {
    return new InlineKeyboard()
        .text("🗑️ Удалить", `delete_${orderId}`)
        .row()
        .text("✏️ Редактировать", `edit_${orderId}`)
        .row()
        .text("👤 Назначить ведущего", `assign_${orderId}`)
        .row()
        .text("🔙 Назад", "back_orders");
}

function buildHostsKeyboard(orderId: number) {
    return new InlineKeyboard();
}

function buildEditByIdKeyboard() {
    return new InlineKeyboard()
        .text("🔙 Назад", "menu_editorder");
}

type MenuState = "main" | "upcoming" | "order_actions" | "assign_host" | "edit_by_id";

const menuStates = new Map<number, MenuState>();
const pendingEditById = new Set<number>();

export function setupMenu(bot: Bot) {
    bot.command("start", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const host = await prisma.host.findUnique({
            where: { telegramId: String(userId) },
        });

        const isAdmin = host?.isAdmin || userId === MANAGER_ID;

        const text = isAdmin
            ? "Меню менеджера 👇"
            : "Бот запущен 🚀\n\nТы зарегистрирован как ведущий.";

        await ctx.reply(text, {
            reply_markup: isAdmin ? buildMainMenuKeyboard() : undefined,
        });
    });

    bot.callbackQuery("menu_neworder", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        console.log("menu_neworder clicked by user:", userId);

        const host = await prisma.host.findUnique({
            where: { telegramId: String(userId) },
        });

        console.log("host found:", host, "isAdmin:", host?.isAdmin);

        if (!host?.isAdmin && userId !== MANAGER_ID) {
            return ctx.answerCallbackQuery({ text: "Нет доступа", show_alert: true });
        }

        await ctx.answerCallbackQuery();
        await ctx.editMessageText("Отправь заказ одним сообщением 👇");
        
        console.log("adding user to waitingForOrderUsers:", userId);
        waitingForOrderUsers.add(userId);
        console.log("waitingForOrderUsers now:", [...waitingForOrderUsers]);
    });

    bot.callbackQuery("menu_upcoming", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const host = await prisma.host.findUnique({
            where: { telegramId: String(userId) },
        });

        if (!host?.isAdmin && userId !== MANAGER_ID) {
            return ctx.answerCallbackQuery({ text: "Нет доступа", show_alert: true });
        }

        const orders = await getUpcomingOrders(6);
        
        if (orders.length === 0) {
            await ctx.editMessageText("Заказов пока нет", {
                reply_markup: new InlineKeyboard().text("🔙 Назад", "menu_back"),
            });
            return;
        }

        menuStates.set(userId, "upcoming");

        await ctx.editMessageText("📋 Ближайшие заказы:", {
            reply_markup: buildUpcomingOrdersKeyboard(orders),
        });
    });

    bot.callbackQuery(/^order_(\d+)$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const orderId = Number(ctx.match[1]);
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { hosts: { include: { host: true } } },
        });

        if (!order) {
            return ctx.answerCallbackQuery({ text: "Заказ не найден", show_alert: true });
        }

        menuStates.set(userId, "order_actions");

        const hostNames = order.hosts.length > 0 
            ? order.hosts.map(h => h.host.name).join(", ")
            : "не назначены";

        await ctx.editMessageText(
            `📦 Заказ №${orderId}\n\n${buildFullOrderText(order)}\n\n👤 Ведущие: ${hostNames}`,
            {
                reply_markup: buildOrderActionsKeyboard(orderId),
            }
        );
    });

    bot.callbackQuery(/^delete_(\d+)$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const orderId = Number(ctx.match[1]);
        
        await prisma.orderHost.deleteMany({ where: { orderId } });
        await prisma.order.delete({ where: { id: orderId } });

        await ctx.answerCallbackQuery("Заказ удалён ✅");
        await ctx.editMessageText("Заказ удалён ✅", {
            reply_markup: new InlineKeyboard().text("🔙 К заказам", "menu_upcoming"),
        });
    });

    bot.callbackQuery(/^edit_(\d+)$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const orderId = Number(ctx.match[1]);
        
        waitingForEditUsers.set(userId, orderId);
        
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        
        if (!order) {
            return ctx.answerCallbackQuery({ text: "Заказ не найден", show_alert: true });
        }

        await ctx.editMessageText(
            `Редактирование заказа №${orderId}\n\nТекущие данные:\n${order.text || buildFullOrderText(order)}\n\nОтправь новые данные (можно только изменяемые поля):`
        );
    });

    bot.callbackQuery(/^assign_(\d+)$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const orderId = Number(ctx.match[1]);
        
        const hosts = await prisma.host.findMany();
        
        if (hosts.length === 0) {
            return ctx.answerCallbackQuery({ text: "Нет ведущих", show_alert: true });
        }

        menuStates.set(userId, "assign_host");

        let keyboard = new InlineKeyboard();
        for (const host of hosts) {
            keyboard.text(host.name, `host_${host.id}_${orderId}`).row();
        }
        keyboard.text("🔙 Назад", `order_${orderId}`);

        await ctx.editMessageText("Выбери ведущего:", {
            reply_markup: keyboard,
        });
    });

    bot.callbackQuery(/^host_(\d+)_(\d+)$/, async (ctx) => {
        const hostId = Number(ctx.match[1]);
        const orderId = Number(ctx.match[2]);

        const host = await prisma.host.findUnique({ where: { id: hostId } });
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { hosts: { include: { host: true } } },
        });

        if (!host || !order) {
            return ctx.answerCallbackQuery({ text: "Ошибка", show_alert: true });
        }

        const keyboard = new InlineKeyboard()
            .text("✅ Принять", `confirm_accept_${host.id}_${orderId}`)
            .text("❌ Отказаться", `confirm_reject_${host.id}_${orderId}`);

        await ctx.api.sendMessage(
            host.telegramId,
            `📢 Вам назначен заказ №${orderId}\n\n${buildFullOrderText(order)}\n\nПодтвердите:`,
            { reply_markup: keyboard }
        );

        await ctx.answerCallbackQuery(`Ведущему ${host.name} отправлено уведомление ✅`);
        await ctx.editMessageText(
            `Ведущему ${host.name} отправлено уведомление ✅`,
            {
                reply_markup: new InlineKeyboard().text("🔙 К заказу", `order_${orderId}`),
            }
        );
    });

    bot.callbackQuery(/^confirm_accept_(\d+)_(\d+)$/, async (ctx) => {
        const hostId = Number(ctx.match[1]);
        const orderId = Number(ctx.match[2]);

        const host = await prisma.host.findUnique({ where: { id: hostId } });
        const order = await prisma.order.findUnique({
            where: { id: orderId },
            include: { hosts: { include: { host: true } } },
        });

        if (!host || !order) return;

        const existing = order.hosts.find(h => h.hostId === hostId);
        if (existing) {
            return ctx.answerCallbackQuery({ text: "Вы уже назначены", show_alert: true });
        }

        const currentHosts = order.hosts.length;
        if (currentHosts >= order.slots) {
            return ctx.answerCallbackQuery({ text: "Слоты заняты", show_alert: true });
        }

        await prisma.orderHost.create({
            data: { orderId, hostId },
        });

        const newCount = currentHosts + 1;
        const isFull = newCount >= order.slots;

        if (isFull) {
            await prisma.order.update({
                where: { id: orderId },
                data: { status: "full" },
            });
        }

        await ctx.answerCallbackQuery("Заказ принят ✅");
        
        const hostNames = order.hosts.map(h => h.host.name).concat(host.name).join(", ");
        
        try {
            await ctx.editMessageText(
                `✅ Заказ №${orderId} принят (${newCount}/${order.slots}): ${hostNames}`
            );
        } catch (e) {}

        await ctx.api.sendMessage(
            MANAGER_ID,
            `👤 Ведущий ${host.name} принял заказ №${orderId} (${newCount}/${order.slots})\n\n${buildFullOrderText(order)}`
        );
    });

    bot.callbackQuery(/^confirm_reject_(\d+)_(\d+)$/, async (ctx) => {
        await ctx.answerCallbackQuery("Отклонено");
        
        try {
            await ctx.editMessageText("Ведущий отказался от заказа ❌");
        } catch (e) {}
    });

    bot.callbackQuery("menu_editorder", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const host = await prisma.host.findUnique({
            where: { telegramId: String(userId) },
        });

        if (!host?.isAdmin && userId !== MANAGER_ID) {
            return ctx.answerCallbackQuery({ text: "Нет доступа", show_alert: true });
        }

        const orders = await getUpcomingOrders(6);
        
        if (orders.length === 0) {
            await ctx.editMessageText("Заказов пока нет", {
                reply_markup: new InlineKeyboard().text("🔙 Назад", "menu_back"),
            });
            return;
        }

        let keyboard = new InlineKeyboard();
        for (const order of orders) {
            keyboard.text(buildShortOrderText(order), `order_edit_${order.id}`).row();
        }
        keyboard.row();
        keyboard.text("📝 Редактировать по ID", "edit_by_id").row();
        keyboard.text("🔙 Назад", "menu_back");

        await ctx.editMessageText("✏️ Редактировать заказ:", {
            reply_markup: keyboard,
        });
    });

    bot.callbackQuery("edit_by_id", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        pendingEditById.add(userId);
        menuStates.set(userId, "edit_by_id");

        await ctx.editMessageText(
            "Введи ID заказа для редактирования:",
            { reply_markup: buildEditByIdKeyboard() }
        );
    });

    bot.callbackQuery(/^order_edit_(\d+)$/, async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const orderId = Number(ctx.match[1]);
        
        waitingForEditUsers.set(userId, orderId);
        
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        
        if (!order) {
            return ctx.answerCallbackQuery({ text: "Заказ не найден", show_alert: true });
        }

        await ctx.editMessageText(
            `Редактирование заказа №${orderId}\n\nТекущие данные:\n${order.text || buildFullOrderText(order)}\n\nОтправь новые данные:`
        );
    });

    bot.callbackQuery("back_orders", async (ctx) => {
        const userId = ctx.from?.id;
        if (!userId) return;

        const orders = await getUpcomingOrders(6);
        menuStates.set(userId, "upcoming");

        await ctx.editMessageText("📋 Ближайшие заказы:", {
            reply_markup: buildUpcomingOrdersKeyboard(orders),
        });
    });

    bot.callbackQuery("menu_back", async (ctx) => {
        menuStates.delete(ctx.from?.id || 0);
        
        await ctx.editMessageText("Меню менеджера 👇", {
            reply_markup: buildMainMenuKeyboard(),
        });
    });

    bot.on("message:text", async (ctx) => {
        console.log("menu message:text handler fired for user:", ctx.from?.id);
        const userId = ctx.from?.id;
        if (!userId) return;

        if (pendingEditById.has(userId)) {
            const text = ctx.message.text;
            const orderId = Number(text);

            if (isNaN(orderId)) {
                await ctx.reply("Введи корректный ID заказа");
                return;
            }

            const order = await prisma.order.findUnique({ where: { id: orderId } });
            
            if (!order) {
                await ctx.reply("Заказ не найден. Попробуй еще раз:");
                return;
            }

            pendingEditById.delete(userId);
            
            const { waitingForEditUsers } = await import("./createOrder.js");
            waitingForEditUsers.set(userId, orderId);

            await ctx.reply(
                `Редактирование заказа №${orderId}\n\nТекущие данные:\n${order.text || buildFullOrderText(order)}\n\nОтправь новые данные:`
            );
        }
    });
}
