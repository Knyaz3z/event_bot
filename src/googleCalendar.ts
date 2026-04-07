import {google} from "googleapis";
import {PrismaClient} from "@prisma/client";
import crypto from "crypto";
import https from "https";

const prisma = new PrismaClient();

let GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY || "";
const GOOGLE_PRIVATE_KEY_ONLY = process.env.GOOGLE_PRIVATE_KEY_ONLY || "";

if (GOOGLE_PRIVATE_KEY_ONLY) {
    GOOGLE_PRIVATE_KEY = GOOGLE_PRIVATE_KEY_ONLY;
}

if (GOOGLE_PRIVATE_KEY.includes("\\n")) {
    GOOGLE_PRIVATE_KEY = GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
}

const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL || "";
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || "primary";

const SCOPES = [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/calendar.events",
];

function base64UrlEncode(data: string | Buffer): string {
    const buffer = typeof data === "string" ? Buffer.from(data) : data;
    return buffer.toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");
}

async function getAccessToken(): Promise<string | null> {
    if (!GOOGLE_PRIVATE_KEY || !GOOGLE_CLIENT_EMAIL) {
        console.log("Google Calendar: missing credentials");
        return null;
    }

    return new Promise((resolve) => {
        const now = Math.floor(Date.now() / 1000);
        
        const header = {
            alg: "RS256",
            typ: "JWT",
        };
        
        const payload = {
            iss: GOOGLE_CLIENT_EMAIL,
            sub: GOOGLE_CLIENT_EMAIL,
            scope: SCOPES.join(" "),
            aud: "https://oauth2.googleapis.com/token",
            iat: now,
            exp: now + 3600,
        };
        
        const encodedHeader = base64UrlEncode(JSON.stringify(header));
        const encodedPayload = base64UrlEncode(JSON.stringify(payload));
        
        const signatureInput = `${encodedHeader}.${encodedPayload}`;
        
        try {
            const sign = crypto.createSign("RSA-SHA256");
            sign.update(signatureInput);
            
            let key = GOOGLE_PRIVATE_KEY;
            if (key.includes("-----BEGIN PRIVATE KEY-----")) {
                key = key.replace("-----BEGIN PRIVATE KEY-----", "-----BEGIN RSA PRIVATE KEY-----")
                         .replace("-----END PRIVATE KEY-----", "-----END RSA PRIVATE KEY-----");
            }
            
            const signature = sign.sign(key, "base64");
            const encodedSignature = signature.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
            
            const token = `${signatureInput}.${encodedSignature}`;
            
            const postData = JSON.stringify({
                grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
                assertion: token,
            });
            
            const options = {
                hostname: "oauth2.googleapis.com",
                port: 443,
                path: "/token",
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(postData),
                },
            };
            
            const req = https.request(options, (res) => {
                let body = "";
                res.on("data", (chunk) => body += chunk);
                res.on("end", () => {
                    try {
                        const result = JSON.parse(body);
                        if (result.access_token) {
                            console.log("Google Calendar: access token received");
                            resolve(result.access_token);
                        } else {
                            console.log("Google Calendar: no access token in response");
                            resolve(null);
                        }
                    } catch (e) {
                        console.log("Google Calendar: failed to parse response");
                        resolve(null);
                    }
                });
            });
            
            req.on("error", (e) => {
                console.log("Google Calendar: request error -", e.message);
                resolve(null);
            });
            
            req.write(postData);
            req.end();
        } catch (e) {
            console.log("Google Calendar: error creating JWT -", e);
            resolve(null);
        }
    });
}

function parseGoogleEvent(event: any) {
    const summary = event.summary || "";
    const description = event.description || "";
    const location = event.location || "";
    
    const start = event.start?.dateTime || event.start?.date;
    const end = event.end?.dateTime || event.end?.date;
    
    const dateMatch = start?.match(/(\d{4})-(\d{2})-(\d{2})/);
    const timeMatch = start?.match(/(\d{2}):(\d{2})/);
    const endTimeMatch = end?.match(/(\d{2}):(\d{2})/);
    
    const date = dateMatch ? `${dateMatch[3]}.${dateMatch[2]}.${dateMatch[1]}` : null;
    const time = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : null;
    const endTime = endTimeMatch ? `${endTimeMatch[1]}:${endTimeMatch[2]}` : null;
    
    const address = location || extractField(description, "Адрес");
    const tariff = extractField(description, "Тариф") || extractField(summary, "Тариф");
    const comment = extractField(description, "Комментарий");
    const people = extractField(description, "Кол-во");
    const clientContact = extractField(description, "Контакт");
    const totalCost = parseFloat(extractField(description, "Стоимость")?.replace(/[^\d.]/g, "") || "0") || null;
    const advancePayment = parseFloat(extractField(description, "Предоплата")?.replace(/[^\d.]/g, "") || "0") || null;
    const remainingPayment = parseFloat(extractField(description, "Остаток")?.replace(/[^\d.]/g, "") || "0") || null;
    const extension = extractField(description, "Продление");
    const slots = parseInt(extractField(description, "Ведущих") || "1") || 1;
    
    return {
        googleEventId: event.id,
        summary,
        date,
        time,
        endTime,
        address,
        tariff,
        comment,
        people,
        clientContact,
        totalCost,
        advancePayment,
        remainingPayment,
        extension,
        slots,
        text: buildOrderText({
            date,
            time,
            endTime,
            address,
            tariff,
            comment,
            people,
            clientContact,
            totalCost,
            advancePayment,
            remainingPayment,
            extension,
        }),
    };
}

function extractField(text: string, field: string): string | null {
    const regex = new RegExp(`${field}:\\s*(.+)`, "i");
    const match = text.match(regex);
    return match ? match[1].trim() : null;
}

function buildOrderText(data: any): string {
    const parts = [];
    if (data.tariff) parts.push(`Тариф: ${data.tariff}`);
    if (data.date) parts.push(`Дата: ${data.date}`);
    if (data.time) parts.push(`Время: ${data.time}`);
    if (data.endTime) parts.push(`- ${data.endTime}`);
    if (data.address) parts.push(`Адрес: ${data.address}`);
    if (data.people) parts.push(`Кол-во: ${data.people}`);
    if (data.comment) parts.push(`Комментарий: ${data.comment}`);
    if (data.clientContact) parts.push(`Контакт клиента: ${data.clientContact}`);
    if (data.totalCost) parts.push(`Стоимость: ${data.totalCost}`);
    if (data.advancePayment) parts.push(`Предоплата: ${data.advancePayment}`);
    if (data.remainingPayment) parts.push(`Остаток: ${data.remainingPayment}`);
    if (data.extension) parts.push(`Продление: ${data.extension}`);
    return parts.join("\n");
}

export async function syncFromGoogleCalendar(): Promise<number> {
    if (!GOOGLE_PRIVATE_KEY || !GOOGLE_CLIENT_EMAIL) {
        console.log("Google Calendar: not configured");
        return 0;
    }

    try {
        console.log("Google Calendar: getting access token...");
        const accessToken = await getAccessToken();
        
        if (!accessToken) {
            console.log("Google Calendar: failed to get access token");
            return 0;
        }
        
        console.log("Google Calendar: fetching events...");
        
        const calendar = google.calendar({ version: "v3" });
        const now = new Date();
        const future = new Date();
        future.setFullYear(future.getFullYear() + 1);

        const response = await calendar.events.list({
            calendarId: GOOGLE_CALENDAR_ID,
            timeMin: now.toISOString(),
            timeMax: future.toISOString(),
            singleEvents: true,
            orderBy: "startTime",
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        const events = response.data.items || [];
        console.log(`Google Calendar: found ${events.length} events`);
        
        let synced = 0;

        for (const event of events) {
            if (!event.id || !event.summary) continue;
            
            const existingOrder = await prisma.order.findFirst({
                where: { googleEventId: event.id },
            });

            if (existingOrder) continue;

            const orderData = parseGoogleEvent(event);
            
            if (!orderData.date && !orderData.time) continue;

            await prisma.order.create({
                data: {
                    googleEventId: event.id,
                    text: orderData.text,
                    date: orderData.date,
                    time: orderData.time,
                    address: orderData.address,
                    price: null,
                    comment: orderData.comment,
                    tariff: orderData.tariff,
                    clientContact: orderData.clientContact,
                    totalCost: orderData.totalCost,
                    advancePayment: orderData.advancePayment,
                    remainingPayment: orderData.remainingPayment,
                    extension: orderData.extension,
                    slots: orderData.slots,
                    status: "open",
                },
            });

            synced++;
        }

        console.log(`Google Calendar: synced ${synced} events`);
        return synced;
    } catch (error) {
        console.error("Google Calendar: sync error -", error);
        return 0;
    }
}

export async function createGoogleCalendarEvent(orderData: {
    date: string | null | undefined;
    time: string | null | undefined;
    address: string | null | undefined;
    tariff: string | null | undefined;
    comment: string | null | undefined;
    clientContact: string | null | undefined;
    people: string | null | undefined;
    totalCost: number | null | undefined;
    advancePayment: number | null | undefined;
    remainingPayment: number | null | undefined;
    extension: string | null | undefined;
}): Promise<string | null> {
    if (!GOOGLE_PRIVATE_KEY || !GOOGLE_CLIENT_EMAIL) {
        console.log("Google Calendar: not configured for writing");
        return null;
    }

    try {
        const accessToken = await getAccessToken();
        
        if (!accessToken) {
            console.log("Google Calendar: failed to get access token for writing");
            return null;
        }

        const calendar = google.calendar({ version: "v3" });

        let dateMatch = orderData.date?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        
        if (!dateMatch) {
            dateMatch = orderData.date?.match(/(\d{2})\.(\d{2})/);
            if (dateMatch) {
                dateMatch[3] = String(new Date().getFullYear());
            }
        }
        
        const timeMatch = orderData.time?.match(/^(\d{2}):(\d{2})/);
        
        console.log("Creating event - date:", orderData.date, "time:", orderData.time);
        
        if (!dateMatch || !timeMatch) {
            console.log("Google Calendar: invalid date/time format");
            return null;
        }

        const startDateTime = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T${timeMatch[1]}:${timeMatch[2]}:00`;
        
        const timeEndMatch = orderData.time?.match(/-(\d{2}):(\d{2})/);
        const endHour = timeEndMatch ? timeEndMatch[1] : String(Number(timeMatch[1]) + 1);
        const endDateTime = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T${endHour}:${timeEndMatch ? timeEndMatch[2] : timeMatch[2]}:00`;

        const description = [
            orderData.date ? `Дата: ${orderData.date}` : null,
            orderData.time ? `Время: ${orderData.time}` : null,
            orderData.tariff ? `Тариф: ${orderData.tariff}` : null,
            orderData.people ? `Кол-во: ${orderData.people}` : null,
            orderData.comment ? `Комментарий: ${orderData.comment}` : null,
            orderData.clientContact ? `Контакт: ${orderData.clientContact}` : null,
            orderData.totalCost ? `Стоимость: ${orderData.totalCost}` : null,
            orderData.advancePayment ? `Предоплата: ${orderData.advancePayment}` : null,
            orderData.remainingPayment ? `Остаток: ${orderData.remainingPayment}` : null,
            orderData.extension ? `Продление: ${orderData.extension}` : null,
        ].filter(Boolean).join("\n");

        const response = await calendar.events.insert({
            calendarId: GOOGLE_CALENDAR_ID,
            requestBody: {
                summary: orderData.tariff || "Мероприятие",
                description: description,
                location: orderData.address || "",
                start: {
                    dateTime: startDateTime,
                    timeZone: "Europe/Moscow",
                },
                end: {
                    dateTime: endDateTime,
                    timeZone: "Europe/Moscow",
                },
            },
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        console.log(`Google Calendar: created event ${response.data.id}`);
        return response.data.id || null;
    } catch (error) {
        console.error("Google Calendar: error creating event -", error);
        return null;
    }
}

export async function updateGoogleCalendarEvent(googleEventId: string, orderData: {
    date: string | null | undefined;
    time: string | null | undefined;
    address: string | null | undefined;
    tariff: string | null | undefined;
    comment: string | null | undefined;
    clientContact: string | null | undefined;
    people: string | null | undefined;
    totalCost: number | null | undefined;
    advancePayment: number | null | undefined;
    remainingPayment: number | null | undefined;
    extension: string | null | undefined;
}): Promise<boolean> {
    if (!GOOGLE_PRIVATE_KEY || !GOOGLE_CLIENT_EMAIL || !googleEventId) {
        console.log("Google Calendar: not configured or no event ID for update");
        return false;
    }

    try {
        const accessToken = await getAccessToken();
        
        if (!accessToken) {
            console.log("Google Calendar: failed to get access token for update");
            return false;
        }

        const calendar = google.calendar({ version: "v3" });

        let dateMatch = orderData.date?.match(/(\d{2})\.(\d{2})\.(\d{4})/);
        
        if (!dateMatch) {
            dateMatch = orderData.date?.match(/(\d{2})\.(\d{2})/);
            if (dateMatch) {
                dateMatch[3] = String(new Date().getFullYear());
            }
        }
        
        const timeMatch = orderData.time?.match(/^(\d{2}):(\d{2})/);
        
        let startDateTime: string | undefined;
        let endDateTime: string | undefined;
        
        if (dateMatch && timeMatch) {
            startDateTime = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T${timeMatch[1]}:${timeMatch[2]}:00`;
            
            const timeEndMatch = orderData.time?.match(/-(\d{2}):(\d{2})/);
            const endHour = timeEndMatch ? timeEndMatch[1] : String(Number(timeMatch[1]) + 1);
            endDateTime = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}T${endHour}:${timeEndMatch ? timeEndMatch[2] : timeMatch[2]}:00`;
        }

        const description = [
            orderData.date ? `Дата: ${orderData.date}` : null,
            orderData.time ? `Время: ${orderData.time}` : null,
            orderData.tariff ? `Тариф: ${orderData.tariff}` : null,
            orderData.people ? `Кол-во: ${orderData.people}` : null,
            orderData.comment ? `Комментарий: ${orderData.comment}` : null,
            orderData.clientContact ? `Контакт: ${orderData.clientContact}` : null,
            orderData.totalCost ? `Стоимость: ${orderData.totalCost}` : null,
            orderData.advancePayment ? `Предоплата: ${orderData.advancePayment}` : null,
            orderData.remainingPayment ? `Остаток: ${orderData.remainingPayment}` : null,
            orderData.extension ? `Продление: ${orderData.extension}` : null,
        ].filter(Boolean).join("\n");

        await calendar.events.patch({
            calendarId: GOOGLE_CALENDAR_ID,
            eventId: googleEventId,
            requestBody: {
                summary: orderData.tariff || "Мероприятие",
                description: description,
                location: orderData.address || "",
                start: startDateTime ? { dateTime: startDateTime, timeZone: "Europe/Moscow" } : undefined,
                end: endDateTime ? { dateTime: endDateTime, timeZone: "Europe/Moscow" } : undefined,
            },
        }, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });

        console.log(`Google Calendar: updated event ${googleEventId}`);
        return true;
    } catch (error) {
        console.error("Google Calendar: error updating event -", error);
        return false;
    }
}