# FindIt AI

A frontend-only global lost-and-found discovery experience built with React, TypeScript and Vite.

## Live website

https://alisherice.github.io/FindIt-AI/

## Features

- Responsive lost-and-found interface
- Global discovery categories and illustrative sample listings
- Interactive global map with 26 city hotspots across 24 countries
- Local cultural photo stories and source credits for each hotspot
- Search and report interface previews

> **Demo notice:** Global hotspot counts and sample listings are illustrative demo content, not live reports or real-time statistics. This static GitHub Pages version does not include a hosted API, database, authentication service or live AI matching backend.

## Run locally

Requirements: Node.js 22 or newer.

```bash
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite.

## Production build

```bash
cd frontend
npm ci
npm run build
```

The production files are generated in `frontend/dist`.

## Deployment

GitHub Actions builds the frontend and publishes `frontend/dist` to GitHub Pages whenever changes are pushed to `main`. The repository's Pages source must be set to **GitHub Actions**.

## Project structure

```text
FindIt-AI/
├── .github/
│   └── workflows/
│       └── deploy.yml
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── vite.config.ts
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       └── styles.css
├── .gitignore
└── README.md
```
