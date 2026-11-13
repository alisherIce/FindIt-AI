# FindIt AI

A React, TypeScript and Vite lost-and-found product prototype, currently deployed as a static GitHub Pages application.

## Live website

https://alisherice.github.io/FindIt-AI/

## What works in the current browser demo

- Search reports by item name, category, campus, location and description.
- Filter by lost/found status, country and local calendar date.
- Register a local demo profile using an email address (no password or server authentication).
- Submit lost and found reports with a photo, item category, campus and location.
- Save reports and compressed photos in the current browser's local storage.
- See your own reports and mark them as resolved.
- Rank possible lost/found pairs using text, category, campus, country and location similarity.
- Keep the local board in sync between tabs in the same browser.
- Explore a clearly labelled illustrative global map and category showcase.

## Important limitations

This is still a **frontend-only prototype**. Reports, demo profiles and photos are stored in one browser, so they are not shared with other users or devices. Clearing browser storage removes that local demo data.

The sign-in screen creates a browser-only profile. It is not secure authentication and must not be used with a real password or sensitive account data. Matching is a transparent text/category/location heuristic, not computer vision or an AI model. Global hotspot totals and global showcase cards are illustrative examples, not live reports or real-world statistics.

A production multi-user service needs a hosted API, database, image storage, real authentication, server-side authorization and privacy/security rules. Those services must be provisioned and configured separately; GitHub Pages only hosts the static frontend.

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
