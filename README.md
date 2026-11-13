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
- A local-only demo mode remains available until cloud configuration is supplied.

## Enable shared cloud mode (one-time project setup)

The code and schema are already in this repository. A Supabase project and two public configuration values still have to be supplied by its owner; this repository connection cannot create a project or read its private dashboard credentials.

1. Create a Supabase project at https://supabase.com/dashboard.
2. In the Supabase SQL Editor, run the complete migration in `supabase/migrations/202611130001_init.sql`. This creates the reports table, indexes, row-level security policies and `item-photos` storage bucket.
3. In Supabase **Authentication → URL Configuration**, set the Site URL to `https://alisherice.github.io/FindIt-AI/` and add that same address to the allowed redirect URLs.
4. In Supabase **Project Settings → API Keys**, copy the **Project URL** and the **Publishable key** (the browser-safe `sb_publishable_...` key). Never use a secret/service-role key in the frontend.
5. In GitHub, open **Settings → Secrets and variables → Actions → New repository secret** and add:
   - `VITE_SUPABASE_URL` = the Supabase Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = the Supabase Publishable key
6. Run the **Build and deploy FindIt AI** workflow again (Actions → workflow → Run workflow), or push a change to `main`.

Once the two repository secrets are present and the migration is applied, the GitHub Pages build includes the public Supabase configuration and the app switches to shared mode automatically. Remove/avoid any old `VITE_SUPABASE_ANON_KEY` secret if it contains anything other than the legacy anon public JWT.

**Key safety:** the publishable key is intended for browser apps; database access is controlled by the RLS policies in the SQL migration. Never put a Supabase secret/service-role key in a `VITE_...` variable or the frontend. Supabase documents publishable keys as safe for browser use and secret keys as server-only because they bypass RLS.

**Photo privacy:** the migration creates a public photo bucket so report images can be displayed to all visitors. Upload is restricted to the signed-in user's own folder, but images in the bucket are publicly retrievable. Do not upload identity documents, cards showing private numbers, faces of children, or other sensitive images.

## Local demo mode

Without cloud configuration, the site keeps its browser-only demo mode. Demo accounts and reports are not shared between browsers or devices, and browser storage can be cleared by the user.

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

GitHub Actions builds the frontend and publishes `frontend/dist` to GitHub Pages on pushes to `main`. Supabase URL and publishable key are read from GitHub Actions repository secrets during the build.

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
