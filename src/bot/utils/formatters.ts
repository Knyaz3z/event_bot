export function formatOrderText(order: any): string {
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

export function formatPublicOrderText(order: any): string {
    const parts = [];
    if (order.tariff) parts.push(`Тариф: ${order.tariff}`);
    if (order.date) parts.push(`Дата: ${order.date}`);
    if (order.time) parts.push(`Время: ${order.time}`);
    if (order.address) parts.push(`Адрес: ${order.address}`);
    if (order.people) parts.push(`Кол-во: ${order.people}`);
    if (order.comment) parts.push(`Комментарий: ${order.comment}`);
    return parts.join("\n");
}

export function formatFullOrderText(order: any): string {
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
