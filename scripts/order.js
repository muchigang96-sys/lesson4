// Поля маршрута и расчёта.
const fromInput = document.getElementById('from');
const toInput = document.getElementById('to');
const calcButton = document.getElementById('calc');
const submitButton = document.getElementById('submit');
const distanceValue = document.getElementById('distanceValue');
const durationValue = document.getElementById('durationValue');
const rateValue = document.getElementById('rateValue');
const totalValue = document.getElementById('totalValue');
const baseCostValue = document.getElementById('baseCostValue');
const tollValue = document.getElementById('tollValue');
const speedValue = document.getElementById('speedValue');
const deliveryNotice = document.getElementById('deliveryNotice');

// Переключатели скорости и ручное подтверждение платного участка.
const speedInputs = document.querySelectorAll('input[name="deliverySpeed"]');
const tollOptions = document.getElementById('tollOptions');
const tollSectionInput = document.getElementById('tollSection');
const tollCategoryInput = document.getElementById('tollCategory');
const tollCategoryField = document.getElementById('tollCategoryField');

const orderForm = document.getElementById('orderForm');
const nameInput = document.getElementById('customerName');
const phoneInput = document.getElementById('customerPhone');
const commentInput = document.getElementById('comment');
const orderSuccessBlock = document.getElementById('orderSuccess');
const orderIdValue = document.getElementById('orderId');
const sizes = document.querySelectorAll('.main-size-card');

const RATES = { xs: 9, s: 13, m: 20, l: 27, xl: 35, max: 70 };
const MIN_BY_SIZE = { xs: 149, s: 199, m: 249, l: 349, xl: 499, max: 999 };
// Максимальные суммы, предоставленные владельцем проекта.
// Применяются только к подтверждённому участку, не ко всем платным дорогам.
const TOLL_SECTION = 'ПК-5 — М-10 «Россия»';
const TOLL_MAX_BY_CATEGORY = { '1': 2278, '2': 3189, '3': 4262, '4': 6513 };

let map;
let mapRoute;
let calculation = null;
let routeData = null;
let routeVersion = 0;

function getDeliverySpeed() {
    return document.querySelector('input[name="deliverySpeed"]:checked').value;
}

function getTollCategory() {
    return getDeliverySpeed() === 'priority' && tollSectionInput.checked
        ? tollCategoryInput.value
        : null;
}

function hasValidDeliveryOptions() {
    return getDeliverySpeed() !== 'priority' || !tollSectionInput.checked ||
        Object.hasOwn(TOLL_MAX_BY_CATEGORY, tollCategoryInput.value);
}

function money(value) {
    return `${value.toLocaleString('ru-RU')} ₽`;
}

// Чистый расчёт: доплата прибавляется к базовой доставке ровно один раз.
function calculateDelivery(km, size, speed, tollCategory = null) {
    if (!Number.isFinite(km) || km < 0 || !Object.hasOwn(RATES, size) ||
        !['regular', 'priority'].includes(speed)) {
        throw new Error('Некорректные параметры доставки');
    }
    const hasToll = speed === 'priority' && tollCategory !== null;
    if (hasToll && !Object.hasOwn(TOLL_MAX_BY_CATEGORY, tollCategory)) {
        throw new Error('Выберите категорию транспортного средства');
    }
    const baseCost = Math.max(MIN_BY_SIZE[size], Math.ceil(km * RATES[size]));
    const tollCost = hasToll ? TOLL_MAX_BY_CATEGORY[tollCategory] : 0;
    return {
        size,
        speed,
        distance: km.toFixed(1),
        // Сохраняем существующую оценку срока. Ускорение не задавалось.
        duration: Math.min(30, 1 + Math.ceil(km / 80)),
        rate: RATES[size],
        baseCost,
        tollCost,
        total: baseCost + tollCost,
        toll: hasToll ? {
            section: TOLL_SECTION,
            vehicleCategory: tollCategory,
            maximumCost: tollCost,
            confirmation: 'manual'
        } : null
    };
}

function renderInfo() {
    const info = calculation;
    distanceValue.textContent = info ? `${info.distance} км` : '—';
    durationValue.textContent = info ? `${info.duration} дн.` : '—';
    rateValue.textContent = info ? `${info.rate} ₽/км` : '—';
    speedValue.textContent = info ? (info.speed === 'priority' ? 'Приоритетная' : 'Обычная') : '—';
    baseCostValue.textContent = info ? money(info.baseCost) : '—';
    tollValue.textContent = info ? money(info.tollCost) : '—';
    totalValue.textContent = info ? money(info.total) : '—';
    submitButton.disabled = !info;
}

function updateCalcButton() {
    calcButton.disabled = !map || !fromInput.value.trim() || !toInput.value.trim() ||
        !hasValidDeliveryOptions();
}

function refreshCalculation() {
    calculation = null;
    deliveryNotice.textContent = hasValidDeliveryOptions()
        ? '' : 'Выберите категорию ТС для расчёта платного участка.';
    if (routeData && hasValidDeliveryOptions()) {
        const size = document.querySelector('.main-size-card.is-active').dataset.value;
        calculation = {
            ...calculateDelivery(routeData.km, size, getDeliverySpeed(), getTollCategory()),
            from: routeData.from,
            to: routeData.to
        };
    }
    renderInfo();
    updateCalcButton();
}

function updateDeliveryOptions() {
    const priority = getDeliverySpeed() === 'priority';
    const useToll = priority && tollSectionInput.checked;
    tollOptions.hidden = !priority;
    tollSectionInput.disabled = !priority;
    tollCategoryField.hidden = !useToll;
    tollCategoryInput.disabled = !useToll;
    refreshCalculation();
}

speedInputs.forEach(input => input.addEventListener('change', updateDeliveryOptions));
tollSectionInput.addEventListener('change', updateDeliveryOptions);
tollCategoryInput.addEventListener('change', refreshCalculation);

sizes.forEach(element => {
    element.addEventListener('click', () => {
        sizes.forEach(card => card.classList.toggle('is-active', card === element));
        refreshCalculation();
    });
});

// При изменении адреса прежний расчёт больше нельзя отправить.
function invalidateRoute() {
    routeVersion += 1;
    routeData = null;
    if (mapRoute) {
        map.geoObjects.remove(mapRoute);
        mapRoute = null;
    }
    refreshCalculation();
}
[fromInput, toInput].forEach(input => {
    input.addEventListener('input', invalidateRoute);
    input.addEventListener('change', invalidateRoute);
});

updateDeliveryOptions();
ymaps.ready(() => {
    map = new ymaps.Map('map', {
        center: [55.751244, 37.618423],
        zoom: 5,
        controls: ['zoomControl']
    });
    new ymaps.SuggestView('from');
    new ymaps.SuggestView('to');
    updateCalcButton();
});

calcButton.addEventListener('click', () => {
    if (!map || !fromInput.value.trim() || !toInput.value.trim() || !hasValidDeliveryOptions()) {
        return;
    }
    invalidateRoute();
    const version = routeVersion;
    const from = fromInput.value.trim();
    const to = toInput.value.trim();
    const route = new ymaps.multiRouter.MultiRoute({
        referencePoints: [from, to]
    }, { boundsAutoApply: false });
    mapRoute = route;
    map.geoObjects.add(route);

    function readActiveRoute() {
        // Игнорируем ответ старого запроса после изменения адресов.
        if (version !== routeVersion || route !== mapRoute) return;
        try {
            const activeRoute = route.getActiveRoute();
            if (!activeRoute) throw new Error('Нет активного маршрута');
            const km = activeRoute.properties.get('distance').value / 1000;
            if (!Number.isFinite(km) || km < 0) throw new Error('Некорректная дистанция');
            routeData = { from, to, km };
            refreshCalculation();
        } catch (error) {
            failedCalculation(version);
        }
    }
    route.model.events.add('requestsuccess', readActiveRoute);
    route.events.add('activeroutechange', readActiveRoute);
    route.model.events.add('requestfail', () => failedCalculation(version));
});

function failedCalculation(version) {
    if (version !== routeVersion) return;
    routeData = null;
    calculation = null;
    renderInfo();
    deliveryNotice.textContent = 'Не удалось построить маршрут. Проверьте адреса и повторите расчёт.';
}

// Демо-заявка: реального запроса к серверу пока нет.
submitButton.addEventListener('click', () => {
    if (!calculation || !hasValidDeliveryOptions()) {
        alert('Сначала рассчитайте стоимость, чтобы оформить заявку.');
        return;
    }
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const comment = commentInput.value.trim();
    if (!name) {
        alert('Введите имя');
        return;
    }
    if (!phone) {
        alert('Введите телефон');
        return;
    }
    const payload = {
        id: Math.floor(Math.random() * 90000) + 10000,
        customer: { name, phone, comment },
        delivery: { ...calculation },
        createdAt: new Date().toISOString()
    };
    console.log('Заказ: ' + payload.id, payload);
    orderIdValue.textContent = payload.id;
    orderForm.style.display = 'none';
    orderSuccessBlock.classList.add('is-visible');
});
