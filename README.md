# Velora

English-language AI creative workspace for text, image and video. Product brief and architecture are in `Документация/01-brief-architecture.md`.

Run with `npm install` and `npm run dev`. For persistent accounts and generation, configure `.env.local` from `.env.example`, run `npm run db:setup`, then add provider endpoints and keys. Without these services the public site loads, while account creation and generation intentionally return a configuration error rather than a mock response.

Tests: `npm test`. Build: `npm run build`.
