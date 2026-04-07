export function parseOrder(text: string): {
    date: string | null;
    time: string | null;
    address: string | null;
    price: string | null;
    comment: string | null;
    tariff: string | null;
    clientContact: string | null;
    people: string | null;
    totalCost: number | null;
    remainingPayment: number | null;
    advancePayment: number | null;
    extension: string | null;
    slots: number;
} {
    const get = (key: string): string | null => {
        const regex = new RegExp(`${key}:\\s*(.*)`, "i");
        return text.match(regex)?.[1]?.trim() ?? null;
    };

    const getNumber = (key: string): number | null => {
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
