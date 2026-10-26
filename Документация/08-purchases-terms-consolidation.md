# Consolidated purchase flow, limits and final texts (2026-10-26)

## Что изменилось

### 1. Единый лимит €2–€2 500
- `BANK_MIN_EUR = 2`, `BANK_MAX_EUR = 2500` (`lib/bank-transfer.ts`) — единый источник для сервера и UI.
- `app/api/bank-transfer/config` отдаёт `minEur/maxEur` из этих констант; лимиты видны на Pricing, в эстиматоре и в студии.
- Старый блок «Custom amount (invoice order)» с лимитом €10 000 удалён, эстиматор на Pricing переведён на €2–€2 500.
- В `bank_orders` добавлено именованное ограничение `bank_orders_eur_amount_range CHECK (eur_amount BETWEEN 2 AND 2500) NOT VALID`: старые строки не ломаются, новые заказы проверяются базой. Миграция идемпотентна, ошибка миграции не останавливает приложение.

### 2. Один процесс покупки
Удалены legacy-роут `app/api/orders/route.ts` и весь UI «Custom amount / My invoice orders». Остался единственный путь:
заказ банковского перевода → счёт с реквизитами → проверка поступления администратором → начисление токенов.
Оплата картой (Infini) — параллельный автоматический способ для тех же токенов.

### 3. Причина ошибки «Something went wrong. Please try again.»
`GET /api/bank-transfer/orders` вызывал `bankConfig()` до всего остального. Если банковские реквизиты не были
настроены в окружении (так было на Render), функция бросала `BankConfigError`, роут отдавал 500, а студия
показывала общий текст ошибки. Теперь роут возвращает `200 {orders: [], configured: false, reason: …}`,
а панель банковского перевода показывает понятное предупреждение и не даёт оформить заказ.

### 4. Срок действия токенов реализован
- Новая таблица `token_lots`: каждая покупка — отдельная партия со своим `expires_at` (12 месяцев).
- `lib/tokens.ts`: `grantTokens` (начисление партии + перенос старого баланса), `syncTokenBalance`
  (списание истёкших партий и пересчёт баланса), `spendTokens` (списание из самых ранних партий).
- Начисление Infini (`lib/infini.mjs`) и ручное начисление по банковскому переводу
  (`app/api/bank-transfer/admin`) идут через `grantTokens`.
- Генерация (`app/api/runs`) и баланс (`app/api/tokens`) пересчитывают партии перед списанием/показом,
  `/api/tokens` отдаёт `tokensExpireAt` и `expiryTrackingEnabled: true`.
- Баланс, начисленный до появления партий, переносится отдельной партией при первом новом начислении.

### 5. Документы и тексты
- Terms и Privacy — финальные опубликованные версии без «Release draft», «будет подтверждено» и «не реализовано».
- Политика возврата: 14 дней с даты начисления на неиспользованные токены, возврат на счёт оплаты;
  далее неиспользованные токены действуют до своего срока, использованные не возвращаются.
- FAQ переписан: лимиты, скорость начисления, срок 12 месяцев, подтверждение email (ссылка 24 часа).
- Из интерфейса убраны «Local preview», «legacy rates», упоминание тарифа Vidorya и сообщения
  о незавершённых проверке email и сроке токенов. Ставки указаны фактические: 5 / 25 / 100 токенов.

## Проверка
- `npm test` — 42 теста (добавлены `tests/tokens.test.mjs`: FIFO-списание, истечение, перенос старого баланса).
- `next build` — успешно.
- Локально: `GET /api/bank-transfer/orders` → 200, `GET /api/tokens` → 200 с `expiryTrackingEnabled: true`.
- Скриншоты `/pricing` и `/studio?mode=video&topup=open` проверены: дублирующей формы нет, лимит €2–€2 500.

## Остаётся согласовать
- Подтверждение домена `veloraai.pro` в Resend (письма реальным пользователям пока не уходят).
- A-запись апекса `veloraai.pro` (сейчас TLS-обрыв), из-за чего ссылки из писем и возврат с checkout не открываются.

## Статус выкладки (2026-10-26, 12:40 UTC)
- Переменные Render для банковского перевода и Infini выставлены, сервис перезапущен:
  `BANK_TRANSFER_ENABLED=true`, `BANK_SELLER_*`, `BANK_TERMS_VERSION=2026-10-26-v1`,
  `INFINI_ENABLED=true`, `INFINI_KEY_ID`, `INFINI_SECRET_KEY`, `INFINI_WEBHOOK_SECRET`,
  `APP_BASE_URL=https://velora-ai-u7sx.onrender.com` (временно, пока апекс домена не работает).
- Проверено на проде: `/api/bank-transfer/config` → `enabled:true, configured:true`;
  `/api/bank-transfer/orders` → 401 вместо прежнего 500; `/api/payments/webhook` → 401 по подписи
  (значит секрет и маршрут живы); `/api/payments/checkout` с корректным Origin → 401 (конфигурация принята).
- Код с этими изменениями **не выложен**: push в GitHub отклонён (репозиторий не подключён к рабочему столу),
  поэтому на проде пока предыдущий коммит `817fc151` с лимитом €1 и старыми текстами.

### Диагноз домена (2026-10-26, проверено)
- Апекс `veloraai.pro` → A `216.24.57.1`: TCP открывается, но ни 80, ни 443 не отвечают, TLS не поднимается.
- `216.24.57.16` (адрес `www.veloraai.pro` и `velora-ai-u7sx.onrender.com`) отдаёт валидный сертификат `CN=veloraai.pro`.
- Проверка с подменой адреса: `curl --resolve veloraai.pro:443:216.24.57.16 https://veloraai.pro/` → 200 (52604 байта, заголовок «Velora AI — Automated AI Video & Image Generation»), `/api/health` → `{"db":true}`.
- Вывод: в Render домен верифицирован и сертификат выдан; неверна только A-запись апекса. Нужно заменить `216.24.57.1` на `216.24.57.16` (второй адрес `216.24.57.18`). После этого вернуть `APP_BASE_URL=https://veloraai.pro`.

### Выложено на прод (2026-10-26, 13:05 UTC)
- Push в `main` прошёл коммитами `d090f55` и `b15b8a9` (в этом окружении нужен `GIT_CONFIG_COUNT=10`, иначе git берёт устаревший заголовок прокси и получает 401).
- Автоматический деплой по пушу не сработал; деплой запущен через Render API: `dep-dbfks6qvcj2c738hgpmg` (d090f55) и `dep-dbfku6e7bikc73dv7srg` (b15b8a9), оба `live`.
- Проверено на `https://velora-ai-u7sx.onrender.com`: `/api/bank-transfer/config` → `minEur: 2, maxEur: 2500, configured: true`; на `/`, `/pricing`, `/faq`, `/terms-and-conditions` нет `Release draft`, `€10,000`, `Vidorya`, `Local preview`, `to be confirmed`; `/api/bank-transfer/orders` → 401, `/api/payments/webhook` → 401 по подписи.
- Гостю в панели пополнения теперь показывается «Sign in to pay by card» вместо ложного «Card payments are temporarily unavailable»; состояние «временно недоступно» осталось только для авторизованного пользователя при выключенном приёме карт.
- Домен: проверка через внешний сервис Promto (не из песочницы) — `example.com` открывается, `https://veloraai.pro` и `https://www.veloraai.pro` недоступны, значит проблема не в сети песочницы. `APP_BASE_URL` остаётся на адресе onrender до подтверждения работы апекса.
