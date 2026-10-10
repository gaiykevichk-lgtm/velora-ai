# Velora AI — чек-лист публикации на Google Cloud (Cloud Run + Cloud SQL)

Этот файл — пошаговая инструкция. Реальные значения, секреты и имена
ресурсов подставляются на шаге выполнения, секреты сюда не записываются.

## Решение пользователя (04.10.2026)

- Проект Google Cloud: PROJECT_ID `velar-pro` (номер `604765274410`). ⛔ Блокер 04.10.2026: к проекту не привязан биллинговый аккаунт (`UREQ_PROJECT_BILLING_NOT_FOUND`). Без биллинга Cloud Run / Cloud SQL / Artifact Registry включить нельзя — деплой остановлен на шаге 0.
- Регион: Европа — `europe-west1`.
- База: создать новую Cloud SQL for PostgreSQL в Европе.
- Секреты: да, использовать текущие ключи из `.env` (в Secret Manager, в чат не печатаем).
- Домен: пока дефолтный `*.run.app`.

## Что нужно от тебя (вопросы с ответами по умолчанию)

1. **Google Cloud проект** — `PROJECT_ID`:
   - ✅ `velar-pro` (подтверждено).
2. **Регион** — ✅ `europe-west1` (подтверждено).
   - Все ресурсы (Cloud Run, Cloud SQL, Artifact Registry) — в одном регионе.
3. **Имя сервиса Cloud Run** — `velora-ai` (по умолчанию).
4. **База данных** — ✅ новая Cloud SQL for PostgreSQL 15 в `europe-west1` (подтверждено).
   - Рекомендуется: Cloud SQL for PostgreSQL 15+ (db-f1-micro / db-g1-small для старта).
   - Альтернатива (не рекомендуется): внешняя строка `DATABASE_URL` (Neon/Supabase).
   - Нельзя: `VELORA_TEST_DB=memory` — только для локальных тестов, данные исчезают при рестарте.
5. **Провайдер-секреты** — ✅ да, из `.env` в Secret Manager (подтверждено):
   - `DATABASE_URL`, `TEXT_API_BASE_URL`, `TEXT_API_KEY`, `TEXT_MODEL`,
     `IMAGE_API_BASE_URL`, `IMAGE_API_KEY`, `IMAGE_MODEL`,
     `VIDEO_SUBMIT_URL`, `VIDEO_STATUS_URL`, `VIDEO_API_KEY`, `VIDEO_MODEL`.
6. **Домен** — пока дефолтный `*.run.app` (подтверждено).

## Подготовка проекта (уже сделано в репозитории)

- [x] `Dockerfile` (multi-stage, `node:22-alpine`, `npm ci` + `npm run build` + `npm start`, слушает `PORT`).
- [x] `.dockerignore` — исключить `node_modules`, `.next*`, `.env*`, `*.log`.
- [x] Проверка: `npm test` (5/5) + `npm run build` (20 страниц) — зелёные (04.10.2026).

## Шаги публикации (PROJECT_ID=`velar-pro`, регион `europe-west1`)

```bash
# 0. Проект и регион
export PROJECT_ID="velar-pro"
export REGION="europe-west1"
export SERVICE="velora-ai"
gcloud config set project "$PROJECT_ID"
gcloud services enable run.googleapis.com sqladmin.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com

# 1. Тесты и сборка
npm test
npm run build

# 2. Artifact Registry
gcloud artifacts repositories create velora --repository-format=docker \
  --location="$REGION" --description="Velora images" || true

# 3. Cloud SQL (если ещё нет) — команды выполняются в твоём терминале,
# сгенерируй секрет через Secret Manager или менеджер паролей и никуда его не копируй:
# gcloud sql instances create velora-db --database-version=POSTGRES_15 \
#   --tier=db-f1-micro --region="$REGION"
# gcloud sql databases create velora --instance=velora-db
# gcloud sql users create velora --instance=velora-db --credential-from-env
# Строка подключения вида:
# postgresql://velora:СЕКРЕТ@/velora?host=/cloudsql/PROJECT:REGION:velora-db

# 4. Секреты (значения берутся из локального .env, в git не коммитятся)
# for k in DATABASE_URL TEXT_API_KEY IMAGE_API_KEY VIDEO_API_KEY; do ... done
# gcloud secrets create velora-database-url --data-file=- <<<"$DATABASE_URL"
# (аналогично остальные ключи; непечатаемые URL/модели — через --set-env-vars)

# 5. Сборка и пуш образа
gcloud builds submit --tag "$REGION-docker.pkg.dev/$PROJECT_ID/velora/velora-ai:latest" .

# 6. Миграция схемы (один раз, локально с Cloud SQL Proxy или из Cloud Shell)
# npm run db:setup   # при установленном DATABASE_URL на прод-БД

# 7. Деплой
gcloud run deploy "$SERVICE" \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/velora/velora-ai:latest" \
  --region="$REGION" --platform=managed \
  --allow-unauthenticated \
  --port=8080 --memory=1Gi --cpu=1 --min-instances=0 --max-instances=3 \
  --add-cloudsql-instances="$PROJECT_ID:$REGION:velora-db" \
  --set-secrets="DATABASE_URL=velora-database-url:latest,TEXT_API_KEY=velora-text-key:latest,IMAGE_API_KEY=velora-image-key:latest,VIDEO_API_KEY=velora-video-key:latest" \
  --set-env-vars="TEXT_API_BASE_URL=https://api.promto.ai/v1,TEXT_MODEL=google/gemini-3.8-flash,IMAGE_API_BASE_URL=https://api.promto.ai/v1,IMAGE_MODEL=qwen/qwen-image-3-pro,VIDEO_SUBMIT_URL=https://api.promto.ai/v1/videos,VIDEO_STATUS_URL=https://api.promto.ai/v1/videos/{id},VIDEO_MODEL=minimax/hailuo-3"

# 8. Проверки
# curl -s -o /dev/null -w "%{http_code}" "$(gcloud run services describe $SERVICE --region=$REGION --format='value(status.url)')"
# открыть /faq, /studio, проверить регистрацию/логин, генерацию текста
```

## Оценка затрат (ориентиры GCP, точные цены — в калькуляторе Google Cloud)

- Cloud Run: pay-per-request; при простое ~0. Минимальный сервис ~ единицы $/мес.
- Cloud SQL db-f1-micro: ~$10–15/мес + диск. Самый дешёвый вариант с реальной персистентностью.
- Artifact Registry + Secret Manager: копейки на таком масштабе.
- Провайдер-ключи (Promto gateway): отдельно по фактической генерации.

## Что ответить, чтобы продолжить

1. `PROJECT_ID` твоего Google Cloud проекта (и что биллинг включён).
2. Регион оставить `europe-west1`? (да/нет + свой)
3. Создавать новую Cloud SQL БД или есть готовая `DATABASE_URL`?
4. Деплоить с текущими ключами из `.env` (да — скопирую значения в Secret Manager, в чат/файлы их не печатаю)?
