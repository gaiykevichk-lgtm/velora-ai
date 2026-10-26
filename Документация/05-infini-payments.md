# Infini: разовые покупки токенов

## Задача и границы
Подключить Hosted Checkout к существующему Next.js / PostgreSQL проекту, сохранив отдельную оплату по счёту. Только пакеты EUR 20/2000 и EUR 100/10000, без подписок и изменения ставок генерации. Не менять production, юридическое лицо и инфраструктуру. Реальных списаний на этапе разработки нет.

## Архитектура и безопасность
Серверный HMAC-SHA256 клиент (Date, Digest), отдельные payment_orders/payment_events, уникальный request_id и provider_order_id. Суммы и токены определяет сервер. Checkout требует авторизацию, Origin same-origin и постоянную PostgreSQL. Webhook проверяется по исходным байтам, timestamp и event id; перед начислением сервер сверяет заказ через Infini GET. Начисление в одной транзакции на выделенном pg client с блокировкой заказа. Возврат с checkout не является доказательством оплаты. Пользователь видит только собственные онлайн-заказы. Повтор POST с прежним requestId восстанавливает тот же заказ.

## Конфигурация (без секретных значений)
DATABASE_URL, INFINI_ENABLED, INFINI_KEY_ID, INFINI_SECRET_KEY, INFINI_WEBHOOK_SECRET, INFINI_API_BASE_URL, INFINI_CHECKOUT_ORIGIN, APP_BASE_URL. INFINI_ENABLED по умолчанию false. APP_BASE_URL — доверенный HTTPS origin сайта. API base и checkout origin задаются владельцем для целевой среды; ключи только серверные. Без всех обязательных настроек checkout отвечает 503. Не включать коммерческий приём до проверки реквизитов, merchant permissions, возвратов и срока токенов.

## Routes и команды
POST /api/payments/checkout — packageId + requestId (UUID). GET /api/payments — свои заказы и конфигурационный статус. GET /api/payments?orderId=UUID — сверка собственного заказа. POST /api/payments/webhook — публичный HTTPS webhook для Infini.
`npm test`, `npm run build`, `npm run dev -- --hostname 0.0.0.0 --port 5175`; отдельный VELORA_DIST_DIR для параллельного dev/build. Миграции create-if-not-exists входят в lib/db.ts и scripts/setup-db.mjs.

## Источники
https://developer.infini.money/docs/en/6-api-ducumentation
https://developer.infini.money/docs/en/4-authorization
https://developer.infini.money/docs/en/7-webhook
https://developer.infini.money/docs/en/12-automatic-refund
В документации встречаются устаревшие примеры: используем обязательный request_id, expires_in, order_desc и Digest из раздела Authentication, а не неполный Python checkout sample.

## Текущий статус / обязательные ограничения
Реализация готова: ключи и webhook настроены в окружении Render, checkout включается переменной INFINI_ENABLED. Тестовое списание не проводилось — нужен подтверждённый домен для success_url. В payment_orders сохраняется дата окончания 12 месяцев, но расходование/истечение партий токенов пока не реализовано в существующей генерации; это обязательный блокер коммерческого запуска, не исключение требования. Refund/chargeback требуют отдельного согласованного процесса; аномальные платежи не приводят к автоматическому начислению. Юридическое лицо не менять до подтверждения (код Omnix21, старый brief ORIA). Существующий invoice crediting и генерационные списания имеют отдельные ограничения конкуренции — не считать их исправленными интеграцией Infini.
