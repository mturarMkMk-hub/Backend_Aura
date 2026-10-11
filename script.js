// Состояние формы записи
let currentStep = 1;
let selectedTime = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const bookingModal = $("#bookingModal");
const dateInput = $("#bookingDateInput");

// Формируем дату по местному времени, без UTC-смещения
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

function setMinimumDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const minDate = formatLocalDate(tomorrow);

    dateInput.min = minDate;

    if (!dateInput.value || dateInput.value < minDate) {
        dateInput.value = minDate;
    }
}

// Мобильное меню
function toggleMobileMenu() {
    $("#mobileMenu").classList.toggle("hidden");
}

$("#mobileMenuBtn").addEventListener("click", toggleMobileMenu);

// Закрываем мобильное меню после выбора раздела
$$("#mobileMenu a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => {
        $("#mobileMenu").classList.add("hidden");
    });
});

// Фильтрация услуг
function filterServices(category) {
    $$(".service-tab").forEach((tab) => {
        const isActive = tab.dataset.cat === category;

        tab.classList.toggle("bg-aura-gold", isActive);
        tab.classList.toggle("text-white", isActive);
        tab.classList.toggle("border-aura-gold", isActive);

        tab.classList.toggle("border-gray-200", !isActive);
        tab.classList.toggle("text-aura-dark", !isActive);

        tab.setAttribute("aria-pressed", String(isActive));
    });

    $$(".service-card").forEach((card) => {
        const visible =
            category === "all" ||
            card.dataset.category === category;

        card.style.display = visible ? "flex" : "none";
    });
}

// Работа с модальным окном
function openBookingModal() {
    bookingModal.classList.remove("hidden");
    document.body.classList.add("modal-active");

    setMinimumDate();
    updateStepView();
}

function closeBookingModal() {
    bookingModal.classList.add("hidden");
    document.body.classList.remove("modal-active");

    resetBookingForm();
}

// Закрытие клавишей Escape
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" &&
        !bookingModal.classList.contains("hidden")) {
        closeBookingModal();
    }
});

// Закрытие при нажатии на затемнённый фон
bookingModal.addEventListener("click", (event) => {
    if (event.target === bookingModal) {
        closeBookingModal();
    }
});

// Быстрая запись на услугу из карточки
function quickBook(serviceName) {
    const serviceAliases = {
        "Сложное окрашивание (Airtouch / Balayage)":
            "Сложное окрашивание (Airtouch)"
    };

    const targetService =
        serviceAliases[serviceName] || serviceName;

    openBookingModal();

    const radios = $$('input[name="booking_service"]');

    const matchingRadio = Array.from(radios).find(
        (item) => item.value === targetService
    );

    if (matchingRadio) {
        matchingRadio.checked = true;
    }

    currentStep = 1;
    updateStepView();
}

// Запись к конкретному мастеру
function bookWithMaster(masterName) {
    openBookingModal();

    const radio = Array.from(
        $$('input[name="booking_master"]')
    ).find((item) => item.value === masterName);

    if (radio) {
        radio.checked = true;
        currentStep = 2;
    } else {
        alert("Этот мастер пока не добавлен в список онлайн-записи.");
        currentStep = 1;
    }

    updateStepView();
}

// Выбор времени
function selectTimeSlot(button) {
    $$(".time-slot-btn").forEach((item) => {
        item.classList.remove(
            "bg-aura-gold",
            "text-white",
            "border-aura-gold"
        );

        item.setAttribute("aria-pressed", "false");
    });

    button.classList.add(
        "bg-aura-gold",
        "text-white",
        "border-aura-gold"
    );

    button.setAttribute("aria-pressed", "true");
    selectedTime = button.textContent.trim();
}

// Проверка текущего шага
function validateCurrentStep() {
    if (currentStep === 1) {
        if (!$('input[name="booking_service"]:checked')) {
            alert("Пожалуйста, выберите услугу.");
            return false;
        }
    }

    if (currentStep === 2) {
        if (!$('input[name="booking_master"]:checked')) {
            alert("Пожалуйста, выберите мастера.");
            return false;
        }
    }

    if (currentStep === 3) {
        setMinimumDate();

        if (!dateInput.value ||
            dateInput.value < dateInput.min) {
            alert("Пожалуйста, выберите допустимую дату.");
            return false;
        }

        if (!selectedTime) {
            alert("Пожалуйста, выберите время записи.");
            return false;
        }
    }

    return true;
}

// Переход между шагами
function changeStep(delta) {
    if (delta > 0 && !validateCurrentStep()) {
        return;
    }

    if (currentStep === 4 && delta > 0) {
        submitBooking();
        return;
    }

    currentStep += delta;
    currentStep = Math.max(1, Math.min(4, currentStep));

    updateStepView();
}

// Обновление интерфейса формы
function updateStepView() {
    for (let i = 1; i <= 4; i++) {
        const step = $(`#bookingStep${i}`);

        if (step) {
            step.classList.toggle("hidden", i !== currentStep);
        }

        const indicator = $(`#stepIndicator${i}`);

        if (indicator) {
            const circle = indicator.querySelector("span:first-child");
            const active = i <= currentStep;

            indicator.classList.toggle("opacity-50", !active);

            circle.classList.toggle("bg-aura-gold", active);
            circle.classList.toggle("text-white", active);
            circle.classList.toggle("bg-gray-200", !active);
            circle.classList.toggle("text-aura-dark", !active);
        }
    }

    $("#bookingSuccess").classList.add("hidden");
    $("#modalControls").classList.remove("hidden");

    const prevButton = $("#prevBtn");
    const nextButton = $("#nextBtn");

    prevButton.disabled = currentStep === 1;

    nextButton.textContent =
        currentStep === 4
            ? "Подтвердить заявку"
            : "Далее";
}

// Защита от вставки пользовательского текста как HTML
function escapeHTML(value) {
    const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    };

    return String(value).replace(/[&<>"']/g, (char) => entities[char]);
}

// Адрес бэкенда. Пустая строка — сайт и сервер на одном адресе.
// Если сайт на GitHub Pages, а сервер на Render, укажите адрес сервера,
// например: "https://aura-beauty.onrender.com"
const API_URL = "";

let isSubmitting = false;

// Проверка контактов и отправка заявки на сервер
async function submitBooking() {
    if (isSubmitting) return;

    const name = $("#clientName").value.trim();
    const phone = $("#clientPhone").value.trim();

    if (!name) {
        alert("Пожалуйста, укажите ваше имя.");
        $("#clientName").focus();
        return;
    }

    const phoneDigits = phone.replace(/\D/g, "");

    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
        alert("Пожалуйста, проверьте номер телефона.");
        $("#clientPhone").focus();
        return;
    }

    if (!validateCurrentStep()) {
        return;
    }

    const service = $('input[name="booking_service"]:checked').value;
    const master = $('input[name="booking_master"]:checked').value;
    const date = dateInput.value;
    const notes = $("#clientNotes").value.trim();

    const request = {
        name,
        phone,
        service,
        master,
        date,
        time: selectedTime,
        notes
    };

    const nextButton = $("#nextBtn");
    const defaultLabel = nextButton.textContent;

    isSubmitting = true;
    nextButton.disabled = true;
    nextButton.textContent = "Отправляем...";

    try {
        const response = await fetch(`${API_URL}/api/bookings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(request)
        });

        const result = await response.json().catch(() => ({}));

        if (!response.ok || !result.ok) {
            const message = Array.isArray(result.errors)
                ? result.errors.join("\n")
                : "Не удалось отправить заявку. Попробуйте позже.";

            alert(message);
            return;
        }
    } catch (error) {
        alert("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
        return;
    } finally {
        isSubmitting = false;
        nextButton.disabled = false;
        nextButton.textContent = defaultLabel;
    }

    for (let i = 1; i <= 4; i++) {
        $(`#bookingStep${i}`).classList.add("hidden");
    }

    const success = $("#bookingSuccess");

    success.innerHTML = `
        <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl">
            <i class="fa-solid fa-check" aria-hidden="true"></i>
        </div>

        <h4 class="font-serif text-3xl font-bold text-aura-dark">
            Заявка принята!
        </h4>

        <p class="text-sm text-aura-muted max-w-sm mx-auto">
            Мы свяжемся с вами по телефону, чтобы подтвердить запись.
        </p>

        <div class="text-sm text-left bg-aura-base rounded-xl p-4 space-y-2 max-w-md mx-auto">
            <p><strong>Имя:</strong> ${escapeHTML(name)}</p>
            <p><strong>Услуга:</strong> ${escapeHTML(service)}</p>
            <p><strong>Мастер:</strong> ${escapeHTML(master)}</p>
            <p><strong>Дата:</strong> ${escapeHTML(date)}</p>
            <p><strong>Время:</strong> ${escapeHTML(selectedTime)}</p>
        </div>
    `;

    success.classList.remove("hidden");
    $("#modalControls").classList.add("hidden");
}

// Полный сброс формы
function resetBookingForm() {
    currentStep = 1;
    selectedTime = null;

    const firstService = $('input[name="booking_service"]');
    if (firstService) firstService.checked = true;

    const defaultMaster = $('input[name="booking_master"][value="Любой свободный мастер"]');
    if (defaultMaster) {
        defaultMaster.checked = true;
    }

    $("#clientName").value = "";
    $("#clientPhone").value = "";
    $("#clientNotes").value = "";

    $$(".time-slot-btn").forEach((button) => {
        button.classList.remove(
            "bg-aura-gold",
            "text-white",
            "border-aura-gold"
        );
        button.setAttribute("aria-pressed", "false");
    });

    setMinimumDate();
    updateStepView();
}

// Начальная настройка
document.addEventListener("DOMContentLoaded", () => {
    setMinimumDate();
    updateStepView();
    filterServices("all");
});