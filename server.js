const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Если фронтенд лежит на другом домене (например, GitHub Pages),
// укажите его в переменной окружения ALLOWED_ORIGIN,
// например: https://username.github.io
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";

app.use(express.json({ limit: "10kb" }));

// CORS (нужен только если сайт и сервер на разных адресах)
app.use((req, res, next) => {
    if (ALLOWED_ORIGIN) {
        res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    }

    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }

    next();
});

// Отдаём только файлы сайта (server.js и package.json остаются закрытыми)
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/style.css", (req, res) => {
    res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/script.js", (req, res) => {
    res.sendFile(path.join(__dirname, "script.js"));
});

// Проверка, что сервер жив
app.get("/api/health", (req, res) => {
    res.json({ ok: true });
});

// Проверка данных заявки на стороне сервера
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
app.post("/api/bookings", (req, res) => {
    const { errors, data } = validateBooking(req.body || {});

    if (errors.length > 0) {
        return res.status(400).json({ ok: false, errors });
    }

    const booking = {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        ...data
    };

    // Пока заявка просто выводится в консоль сервера.
    // Здесь позже можно добавить отправку в Telegram или запись в базу данных.
    console.log("Новая заявка:", booking);

    res.status(201).json({
        ok: true,
        id: booking.id,
        message: "Заявка принята"
    });
});

// Ответ на неизвестные адреса API
app.use("/api", (req, res) => {
    res.status(404).json({ ok: false, errors: ["Не найдено."] });
});

app.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});
