# Подтверждение почты (email verification)

Статус: реализовано в коде, проверено локально (`npm test` 23/23,
ручной e2e: регистрация → 403 до подтверждения → переход по ссылке →
успешный вход). Продакшен-отправка писем требует SMTP-настроек.

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
| `SMTP_HOST` | SMTP-сервер (без него письма только логируются) |
| `SMTP_PORT` | Порт, по умолчанию `587` (STARTTLS) |
| `SMTP_USER` / `SMTP_PASSWORD` | AUTH LOGIN (опционально, если сервер требует) |
| `SMTP_FROM` | Например `Velora <no-reply@veloraai.pro>` |
| `APP_BASE_URL` | Базовый URL для ссылки, например `https://veloraai.pro` |

## Поведение без SMTP

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

1. Заполнить SMTP-переменные (`SMTP_HOST/USER/PASSWORD/FROM`,
   `APP_BASE_URL`) на хостинге — без этого письма не доставляются.
2. Запушить `main` в GitHub (sandbox без credentials — push не удался:
   `could not read Username for 'https://github.com'`), чтобы Render
   с `autoDeploy: true` подхватил изменения, либо деплой вручную.
3. Проверить на проде: регистрация → письмо → ссылка → вход → генерация.
