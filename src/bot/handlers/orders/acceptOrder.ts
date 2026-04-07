import {Bot} from "grammy";
import {prisma} from "../../index.js";
import {formatFullOrderText} from "../../utils/formatters.js";

const MANAGER_ID = Number(process.env.MANAGER_ID);

export function setupAcceptOrder(bot: Bot) {
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

        const existingHost = order.hosts.find((h: any) => h.hostId === host.id);
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

        const hostNames = order.hosts.map((h: any) => h.host.name).concat(host.name).join(", ");
        await ctx.editMessageText(
            `📦 Заказ №${orderId} принят (${newCount}/${order.slots}): ${hostNames}`
        );

        await ctx.api.sendMessage(
            host.telegramId,
            `✅ Заказ №${orderId} принят (${newCount}/${order.slots})\n\n${formatFullOrderText(order)}`
        );

        if (isFull) {
            await ctx.api.sendMessage(
                MANAGER_ID,
                `🎉 Заказ №${orderId} полностью заполнен ведущими!\n\n👤 Ведущие: ${hostNames}\n\n${formatFullOrderText(order)}`
            );
        } else {
            await ctx.api.sendMessage(
                MANAGER_ID,
                `📦 Заказ №${orderId} принят (${newCount}/${order.slots})\n\n👤 Ведущий: ${host.name}\n\n${formatFullOrderText(order)}`
            );
        }
    });

    bot.callbackQuery(/^reject_(\d+)$/, async (ctx) => {
        await ctx.answerCallbackQuery("Отклонено");
    });
}
