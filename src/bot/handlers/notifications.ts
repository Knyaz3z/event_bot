import {Bot} from "grammy";
import {prisma} from "../index.js";

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

function getTomorrowDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toLocaleDateString("ru-RU");
    return dateStr.substring(0, 5);
}

export function startNotifications(bot: any) {
    setInterval(async () => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        
        if (currentHour === 15 && currentMinute === 0) {
            await sendReminders(bot);
        }
    }, 60000);
}

export function setupReminders(bot: Bot) {
    bot.command("remind", async (ctx) => {
        try {
            const userId = ctx.from?.id;
            if (!userId) return;

            const host = await prisma.host.findUnique({
                where: { telegramId: String(userId) },
            });

            if (!host?.isAdmin) {
                return ctx.reply("У тебя нет прав на эту команду 🔒");
            }

            await ctx.reply("Отправляю напоминания...");
            const sent = await sendReminders(bot);
            await ctx.reply(`Напоминания отправлены ${sent} ведущим ✅`);
        } catch (e) {
            ctx.reply("Произошла ошибка");
        }
    });
}

async function sendReminders(bot: any): Promise<number> {
    const tomorrowDate = getTomorrowDate();
    
    const orders = await prisma.order.findMany({
        where: {
            date: tomorrowDate,
            status: { in: ["taken", "full"] },
        },
        include: {
            hosts: { include: { host: true } },
        },
    });
    
    const hostOrders = new Map<number, typeof orders>();
    
    for (const order of orders) {
        for (const oh of order.hosts) {
            if (!hostOrders.has(oh.hostId)) {
                hostOrders.set(oh.hostId, []);
            }
            hostOrders.get(oh.hostId)!.push(order);
        }
    }
    
    let sent = 0;
    
    for (const [hostId, hostOrdersList] of hostOrders) {
        const host = hostOrdersList[0].hosts.find((h: any) => h.hostId === hostId)?.host;
        if (!host) continue;
        
        const message = `🔔 Напоминание о завтрашних заказах:\n\n`;
        const ordersText = hostOrdersList.map(order => 
            `📦 Заказ №${order.id}\n${buildFullOrderText(order)}`
        ).join("\n\n----------------\n\n");
        
        try {
            await bot.api.sendMessage(
                host.telegramId,
                message + ordersText
            );
            sent++;
        } catch (e) {
            // silently skip failed sends
        }
    }
    
    return sent;
}
