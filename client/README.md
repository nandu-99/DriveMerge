# Welcome to your DriveMerge project

## Project info

**URL**: https://DriveMerge.dev/projects/2b253f5e-ae4f-40f4-9e9f-bfceed231aba

<!--
	README for the client-side DriveMerge web app.
	This repo contains the frontend (Vite + React + TypeScript + Tailwind).
	The backend (server) is not included in this repository — it is intentionally ignored.
-->

# DriveMerge (Client)

A modern web client for DriveMerge — a multi-drive file transfer and merge UI. This repository contains the frontend only (Vite + React + TypeScript + Tailwind). The backend / server is maintained separately and is intentionally not included here.

## Quick highlights

- Client: Vite + React + TypeScript
- Styling: Tailwind CSS + shadcn-style components
- Auth & Storage: optional external integration (configure via env vars)

## Getting started (local development)

1. Clone this repo:

```bash
git clone <YOUR_CLIENT_REPO_URL>
cd <repo-folder>
```

2. Install dependencies (npm):

```bash
npm install
```

3. Create environment variables

Create a `.env.local` file (this file is ignored) and set any required variables. Example variables the client may read:

```env
# Optional: API base URL for your backend
VITE_API_BASE_URL=https://your-backend.example.com
```

4. Start the development server:

```bash
npm run dev
```

5. Build for production:

```bash
npm run build
```

## Notes about the backend

- The backend (server) is not included in this repository and should not be uploaded here.
- If you already have the server repository, point `VITE_API_BASE_URL` to that server.
- If you need to include server code later, remove the `/server` or `/backend` entries from `.gitignore` and add the server files.

## Project structure (important folders)

- `src/` — React app source
- `public/` — static assets
- `supabase/` — optional Supabase migrations and config (can be removed if not used)

## Contribution & style

- Keep the UI client-only and avoid committing secrets. `.env` files are ignored by default.
- Use feature branches and open pull requests for changes.

## License

This project is provided as-is. Add a license file if you wish to specify usage terms.

---

If you want, I can:

- run a quick scan for accidental secrets (I already saw a `.env` file locally — you should remove or rotate secrets before pushing),
- tidy the repo (remove any local `.env` from source control), and
- optionally run `npm run build` to verify the client compiles successfully before you push.

Tell me which of those you'd like me to do next.
