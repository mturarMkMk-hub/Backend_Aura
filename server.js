// Чистый API-сервер: только принимает заявки с сайта.
// Файлы сайта (index.html, style.css, script.js) он НЕ отдаёт —
// сайт размещается отдельно (например, на GitHub Pages).

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Настройки Telegram берутся из переменных окружения (на Render: Environment).
// TELEGRAM_BOT_TOKEN — токен бота от @BotFather
// TELEGRAM_CHAT_ID   — ID чата или пользователя, куда приходят заявки
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";

// Нужно на Render: сервер стоит за прокси,
// иначе лимит запросов будет считать все заявки с одного IP.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// CORS: разрешаем запросы с любых сайтов (в том числе с GitHub Pages).
// Обрабатывает и предварительные OPTIONS-запросы браузера.
app.use(cors());

app.use(express.json({ limit: "10kb" }));

// Простой лимит запросов: не больше 10 заявок за 15 минут с одного IP
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 10;
const hits = new Map();

function rateLimit(req, res, next) {
    const now = Date.now();
    const entry = hits.get(req.ip);

    if (!entry || now > entry.resetAt) {
        hits.set(req.ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return next();
    }

    entry.count += 1;

    if (entry.count > RATE_MAX) {
        return res.status(429).json({
            ok: false,
            errors: ["Слишком много запросов. Попробуйте позже."]
        });
    }

    next();
}

// Очистка устаревших записей лимита
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits) {
        if (now > entry.resetAt) hits.delete(ip);
    }
}, RATE_WINDOW_MS).unref();

// Экранирование текста для Telegram (режим HTML)
function escapeTelegramHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Отправка уведомления о заявке в Telegram.
// Не бросает ошибок: если Telegram недоступен, заявка всё равно принимается.
async function sendTelegramNotification(booking) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn("Telegram не настроен: задайте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID.");
        return false;
    }

    const lines = [
        "💇‍♀️ <b>Новая заявка с сайта AURA Beauty</b>",
        "",
        `<b>Имя:</b> ${escapeTelegramHTML(booking.name)}`,
        `<b>Телефон:</b> ${escapeTelegramHTML(booking.phone)}`,
        `<b>Услуга:</b> ${escapeTelegramHTML(booking.service)}`,
        `<b>Мастер:</b> ${escapeTelegramHTML(booking.master)}`,
        `<b>Дата:</b> ${escapeTelegramHTML(booking.date)}`,
        `<b>Время:</b> ${escapeTelegramHTML(booking.time)}`
    ];

    if (booking.notes) {
        lines.push(`<b>Комментарий:</b> ${escapeTelegramHTML(booking.notes)}`);
    }

    try {
        const response = await fetch(
            `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: TELEGRAM_CHAT_ID,
                    text: lines.join("\n"),
                    parse_mode: "HTML"
                }),
                signal: AbortSignal.timeout(5000)
            }
        );

        if (!response.ok) {
            const details = await response.text().catch(() => "");
            console.error(`Telegram ответил ошибкой ${response.status}:`, details);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Не удалось отправить уведомление в Telegram:", error.message);
        return false;
    }
}

// Проверка, что сервер работает
app.get("/", (req, res) => {
    res.json({ ok: true, service: "aura-beauty-api" });
});

app.get("/api/health", (req, res) => {
    res.json({ ok: true });
});

// Проверка данных заявки
function validateBooking(body) {
    const errors = [];

    const name = String(body.name || "").trim();
    const phone = String(body.phone || "").trim();
    const service = String(body.service || "").trim();
    const master = String(body.master || "").trim();
    const date = String(body.date || "").trim();
    const time = String(body.time || "").trim();
    const notes = String(body.notes || "").trim();

    if (!name || name.length > 100) {
        errors.push("Укажите имя (до 100 символов).");
    }

    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        errors.push("Проверьте номер телефона.");
    }

    if (!service || service.length > 200) {
        errors.push("Выберите услугу.");
    }

    if (!master || master.length > 100) {
        errors.push("Выберите мастера.");
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) {
        errors.push("Некорректная дата.");
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
        errors.push("Некорректное время.");
    }

    if (notes.length > 500) {
        errors.push("Комментарий слишком длинный (до 500 символов).");
    }

    return {
        errors,
        data: { name, phone, service, master, date, time, notes }
    };
}

// Приём заявки
app.post("/api/bookings", rateLimit, async (req, res) => {
    const { errors, data } = validateBooking(req.body || {});

    if (errors.length > 0) {
        return res.status(400).json({ ok: false, errors });
    }

    const booking = {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        ...data
    };

    // Заявка выводится в консоль (на Render смотрите вкладку Logs).
    console.log("Новая заявка:", booking);

    // Уведомление в Telegram (ошибка отправки не отменяет заявку)
    await sendTelegramNotification(booking);

    res.status(201).json({
        ok: true,
        id: booking.id,
        message: "Заявка принята"
    });
});

// Неизвестные адреса
app.use((req, res) => {
    res.status(404).json({ ok: false, errors: ["Не найдено."] });
});

// Ошибки (например, битый JSON в запросе)
app.use((err, req, res, next) => {
    if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
        return res.status(400).json({ ok: false, errors: ["Некорректный запрос."] });
    }

    console.error(err);
    res.status(500).json({ ok: false, errors: ["Ошибка сервера."] });
});

app.listen(PORT, () => {
    console.log(`API запущен на порту ${PORT}`);

    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
        console.warn("TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы: уведомления в Telegram отключены.");
    }
});