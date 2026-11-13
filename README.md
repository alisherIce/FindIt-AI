# FindIt AI

A React, TypeScript and Vite lost-and-found application. It supports a local browser demo and a Supabase-backed shared mode.

## Live website

https://alisherice.github.io/FindIt-AI/

## Features

- Search shared lost and found reports by name, category, campus, location and description.
- Filter by report type, country and date.
- Email/password registration and sign-in through Supabase Auth when configured.
- Shared report records stored in PostgreSQL.
- Item photos uploaded to Supabase Storage.
- Row-level security: only signed-in report owners can update or resolve their own records.
- Text/category/location-based match suggestions.
- Report creation, status resolution and refresh-safe sessions.
- A local-only demo mode remains available as a fallback.

## Cloud backend

The Supabase project has been provisioned and the database migration has been applied.

- Project: `FindIt AI` (Seoul region)
- Database tables: `items`, `item_contact_requests`
- Row-level security: enabled on both tables
- Storage bucket: `item-photos`
- Frontend production configuration: `frontend/.env.production`

The browser bundle uses only the Supabase **publishable** key. It is designed to be public; access to records and uploads is enforced by database and storage RLS policies. Never add a Supabase secret/service-role key to the frontend.

**One remaining dashboard setting:** in Supabase **Authentication → URL Configuration**, set the Site URL to `https://alisherice.github.io/FindIt-AI/` and add that exact URL to the allowed redirect URLs. This enables email-confirmation links to return to the deployed app.

**Photo privacy:** the `item-photos` bucket is public so report images can be shown to visitors. Upload is restricted to the signed-in user's own folder, but image URLs are publicly retrievable. Do not upload identity documents, private numbers, children's faces, or other sensitive images.

Without a successful cloud connection, the app can still use its browser-only demo mode. Demo reports are not shared between browsers or devices.

## Run locally

Requirements: Node.js 22 or newer.

```bash
cd frontend
npm ci
cp .env.example .env.local
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local
npm run dev
```

## Production build

```bash
cd frontend
npm ci
npm run build
```

The production files are generated in `frontend/dist`.

## Deployment

GitHub Actions builds the frontend and publishes `frontend/dist` to GitHub Pages on pushes to `main`. The production Supabase URL and publishable key are loaded from `frontend/.env.production` during the build.

## Project structure

```text
FindIt-AI/
├── .github/workflows/deploy.yml
├── supabase/migrations/202611130001_init.sql
├── frontend/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── src/
│       ├── App.tsx
│       ├── lib/supabase.ts
│       ├── main.tsx
│       └── styles.css
├── .gitignore
└── README.md
```
