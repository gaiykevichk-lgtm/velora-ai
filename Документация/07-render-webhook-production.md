# Render: публикация webhook Infini

## Цель
Обновить действующий Render web service Velora AI из текущего проекта и получить проверяемый публичный HTTPS callback для регистрации Infini webhook.

## Текущая проверка (2026-10-22)
- `https://velora-ai.onrender.com/` отвечает HTTP 200, но возвращает старую страницу на Gunicorn, а не Next.js-приложение.
- `/api/health` и `/api/payments/webhook` на этом Render hostname отвечают HTTP 404. Текущий производственный endpoint webhook не обслуживает проект.
- В репозитории есть Next.js POST handler `app/api/payments/webhook/route.ts`, с проверкой подписи, проверкой заказа и защитой от повторной обработки.
- Локальная конфигурация не содержит DATABASE_URL или Infini webhook secret; INFINI_ENABLED=false. Поэтому deployment без production Render env не обеспечит платёжную обработку.

## План
Проверить актуальный Render service и его deployment/source settings, обновить существующий service на текущий код ветки `main`, не менять платный тариф/ресурсы без подтверждения. Проверить runtime build и наличие production env-переменных через Render API без вывода секретных значений. Выполнить безопасный POST smoke test: неподписанный payload должен быть отвергнут 401; не отправлять фальшивый подписанный платёж. Финальный callback: `https://velora-ai.onrender.com/api/payments/webhook` только после route verification.

## Требуемые production env
`DATABASE_URL`, `INFINI_ENABLED`, `INFINI_KEY_ID`, `INFINI_SECRET_KEY`, `INFINI_WEBHOOK_SECRET`, `INFINI_API_BASE_URL`, `INFINI_CHECKOUT_ORIGIN`, `APP_BASE_URL`.

## Блокер доступа
На момент записи публичная вкладка Render Dashboard показывает страницу входа, а API/webhook route публично возвращает 404. Агент не обновлял production service: текущий Render аккаунт требует авторизации. Не выдавать callback как подтверждённый, пока service не обновлён и POST smoke test не прошёл.
