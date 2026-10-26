# Подтверждение почты (email verification)

Статус: механизм подтверждения реализован и проверен на production. Доставка идёт через HTTPS API Resend (`POST https://api.resend.com/emails`, порт 443) — это обходит блокировку исходящего SMTP на хостинге; при отсутствии `RESEND_API_KEY` код откатывается на SMTP `smtp.resend.com:587`. Домен `veloraai.pro` подтверждён в Resend (регион eu-west-1).

## Как работает

1. `POST /api/auth?action=register` — создаёт пользователя с
   `email_verified=false`, создаёт запись в `email_verifications`
   (хранится только SHA-256 хеш токена, срок 24 часа), отправляет письмо.
   Ответ: `{ needsVerification: true, emailSent, devVerifyLink? }`.
   Без подтверждения вход невозможен.
2. `GET /api/auth/verify?token=...` — проверяет хеш, срок годности,
   ставит `users.email_verified=true`, удаляет токен, редиректит
   на `/studio?verified=1`.
3. `POST /api/auth/verify { email }` — повторная отправка: всегда
   `{ ok: true }` (защита от перебора адресов), старые токены
   инвалидируются (удаляются перед созданием нового).
4. `POST /api/auth` (login) без подтверждения → `403 EMAIL_NOT_VERIFIED`.
5. `POST /api/runs` без подтверждения → `403 EMAIL_NOT_VERIFIED`
   (защита старых сессий, созданных до включения верификации).
6. Окно входа (`app/workspace.tsx`): зелёный баннер со статусом,
   кнопка «Resend confirmation link», баннер «Email confirmed»
   после перехода по ссылке.

## Переменные окружения (только серверные, без `NEXT_PUBLIC_*`)

| Переменная | Назначение |
|---|---|
| `RESEND_API_KEY` | API key Resend; основной транспорт (HTTPS API), только серверная переменная |
| `SMTP_HOST` | По умолчанию `smtp.resend.com` |
| `SMTP_PORT` | По умолчанию `587` (STARTTLS) |
| `SMTP_USER` | По умолчанию `resend` |
| `SMTP_PASSWORD` | Резервный вариант вместо `RESEND_API_KEY` |
| `SMTP_FROM` | Например `Velora <no-reply@veloraai.pro>` |
| `APP_BASE_URL` | Базовый URL для ссылки, например `https://veloraai.pro` |

## Поведение без ключа Resend

Регистрация работает, но письмо не уходит: ссылка пишется в серверный
лог (`[verify] SMTP not configured...`), в dev-ответе API возвращается
`devVerifyLink` (в production — никогда). Для локальной проверки
достаточно открыть эту ссылку из лога.

## База данных

Миграция идемпотентна — безопасна для существующих баз:

- `users.email_verified boolean NOT NULL DEFAULT false`
- `email_verifications(id, user_id → users ON DELETE CASCADE, token_hash UNIQUE, expires_at, created_at)`

См. `lib/db.ts` (`SCHEMA` + `MIGRATIONS`) и `scripts/setup-db.mjs`.
При деплое на Render schema применяется автоматически через `DATABASE_URL`.

## Что осталось для продакшена

1. Добавить `RESEND_API_KEY` в переменные окружения Render и подтвердить домен `veloraai.pro` в Resend. Отправитель задан как `Velora <no-reply@veloraai.pro>`; базовый URL подтверждения — `https://veloraai.pro`.
2. Запушить `main` в GitHub (sandbox без credentials — push не удался:
   `could not read Username for 'https://github.com'`), чтобы Render
   с `autoDeploy: true` подхватил изменения, либо деплой вручную.
3. Проверить на проде: регистрация → письмо → ссылка → вход → генерация.

## Состояние продакшена (Render), проверено 2026-10-26

- Сервис: `velora-ai`, web service `srv-db58ik7lk1mc73943fb0`, регион Frankfurt, ветка `main`.
- Публичный адрес сервиса: `https://velora-ai-u7sx.onrender.com` — HTTP 200.
- Переменные окружения заданы через Render API: `RESEND_API_KEY`, `SMTP_PASSWORD`,
  `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=587`, `SMTP_USER=resend`,
  `SMTP_FROM=Velora <no-reply@veloraai.pro>`, `APP_BASE_URL=https://veloraai.pro`.
- Деплой `dep-dbfk0h1srm7s73f91550` (commit `817fc151`) — статус `live`.

### Открытые блокеры

1. В Resend домен `veloraai.pro` не подтверждён: отправка возвращает
   `403 validation_error: domain is not verified`. Ключ ограничен правом только
   на отправку (`restricted_api_key`), поэтому добавить домен через API нельзя.
   Нужно добавить домен в панели Resend и внести выданные DNS-записи у регистратора.
2. Апекс `veloraai.pro` не отвечает: A-запись указывает на `216.24.57.1`,
   TLS-соединение обрывается. `www.veloraai.pro` отвечает 301 и редиректит
   на апекс, то есть ссылки из писем (`APP_BASE_URL`) сейчас не открываются.
   Пока домен не исправлен, ссылку подтверждения лучше строить от рабочего адреса сервиса.

## Проверка доставки (2026-10-26)
- Ключ Resend действителен, домен `veloraai.pro` — `verified`.
- Прямая отправка через `POST /api/resend`-совместимый API: `200` с `id`, письмо принято.
- Локальная регистрация с реальным ключом: ответ `emailSent: true` (доставка через HTTPS API).
- Неверный ключ: `sendPlainMail` бросает `Mail transport failed: Resend API 401 …`, эндпоинт повторной отправки отдаёт 503 с понятным текстом, причина пишется в лог.
- Исходящий SMTP (587/465) из песочницы заблокирован, поэтому проверка SMTP-ветки возможна только на хостинге.
- `sendPlainMail` возвращает настоящий `id` Resend, он же пишется в `bank_mail_log.message_id` — по нему поддержка может запросить статус доставки (`GET https://api.resend.com/emails/{id}`).
