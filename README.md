# DevFocus

A personal productivity dashboard for developers — capture work, plan your week, and track where your time actually goes. DevFocus pulls in your meetings, pull requests, and tickets, then gives you a single place to triage, schedule, and review your work.

## What it does

DevFocus follows a simple loop: **Capture → Organize → Plan → Execute → Review.**

- **Capture** — Drop anything into the Brain Dump (`Ctrl+K` or the quick-capture input). No need to organize it yet.
- **Organize** — Triage items on the Board into Active, Waiting, Later, or Done.
- **Plan** — Drag items onto a Mon–Fri weekly planner. Mark each day as a "meetings" or "focus" day.
- **Execute** — Work from the Today page, which shows your meetings, available focus time, and current priorities.
- **Review** — Log completed work, save context snapshots for mid-flight projects, and watch your trends over time.

## Features

| Page | Purpose |
|------|---------|
| **Today** | Command center — meetings, focus time, priorities, active work, context snapshots, and activity log |
| **Board** | Kanban board (Brain Dump → Active → Waiting → Later → Done/Cancelled) with rich descriptions and recurring items |
| **Week** | Drag-to-schedule weekly planner, plus context snapshots (branch, next steps, files) |
| **Notes** | Rich-text daily notes with date navigation |
| **Trends** | Analytics — completed items, meetings, PRs reviewed, by-project breakdown, out-of-office, and context switches |
| **Weekly Summary** | Shareable weekly snapshot with item counts, meeting breakdown, after-hours work, and CSV export |
| **Guide** | In-app documentation of the full workflow and keyboard shortcuts |
| **Settings** | Work hours, projects, custom statuses, and integration setup |

## Integrations

Configure these in **Settings** — credentials are stored encrypted in the local database and synced automatically every 30 minutes during work hours (or on demand).

- **Outlook Calendar** — Syncs meetings via an ICS feed to compute available focus time. Handles all-day events, out-of-office blocks, and configurable meeting exclusions (e.g. "Focus time").
- **Jira** — Pulls active and recently completed tickets across one or more project keys.
- **Bitbucket** — Tracks open PRs, review requests, and commits, mapping repos to projects via configurable repo slugs.

## Tech stack

**Backend** — Express 4, Sequelize 6 + SQLite, node-cron (scheduler), axios, Anthropic SDK (for the in-app FAQ assistant). CommonJS.

**Frontend** — React 19, Vite 6, MUI 6, TanStack Query, Zustand, TipTap (rich text), dnd-kit (drag-and-drop), dayjs. ES modules.

Plain JavaScript throughout (no TypeScript). ESLint (Airbnb) + Prettier.

## Project structure

```
devfocus/
├── backend/                 # Express + Sequelize + SQLite
│   ├── start.js             # Entry point
│   ├── server.js            # Express app
│   ├── scheduler.js         # node-cron background sync
│   ├── database/
│   │   ├── connection.js
│   │   └── models/          # Sequelize models
│   ├── routes/              # Express route handlers
│   ├── services/            # Integration sync (jira, bitbucket, calendar, sync)
│   └── utilities/           # Auth
└── frontend/                # React + Vite + MUI + Zustand + TanStack Query
    └── src/
        ├── api/             # TanStack Query hooks
        ├── stores/          # Zustand stores
        ├── pages/           # Route pages (lazy-loaded)
        └── components/
```

## Getting started

Requires Node.js and npm.

```bash
# Install dependencies (root, backend, and frontend)
npm install
cd backend && npm install && cd ../frontend && npm install && cd ..

# Run backend (:3001) and frontend (:5173) together
npm run dev
```

The frontend dev server proxies API requests to the backend. Open http://localhost:5173.

In development, authentication is **skipped** when `DEVFOCUS_PASS_HASH` is unset and no environment variables are required.

### Scripts

| Command | What it does |
|---------|--------------|
| `npm run dev` | Run backend + frontend concurrently |
| `npm run build` | Build the frontend (`vite build`) |
| `npm run lint` | Lint backend and frontend |

> **Before committing,** verify the frontend builds cleanly with `npm run build` (or `cd frontend && npx vite build`). Don't commit if the build fails.

## Data & persistence

- SQLite database. Tables auto-sync on startup via `sequelize.sync()` — there is no migration CLI; schema changes are made directly in the model definitions.
- In production the database lives on a Fly.io persistent volume and is replicated with Litestream.

## Authentication

- Password-based login: a SHA-256 hash of the password is stored in `DEVFOCUS_PASS_HASH`. Sessions use a 7-day cookie.
- Read-only access tokens are supported for embedding dashboards externally (via `Authorization: Bearer` header or a `?token=` query param).
- Auth is disabled in development when `DEVFOCUS_PASS_HASH` is unset.

## Environment variables

Local development needs none. Production sets the following (see `fly.toml` and Fly secrets):

| Variable | Purpose |
|----------|---------|
| `DEVFOCUS_DB_PATH` | Path to the SQLite file (e.g. `/data/devfocus.sqlite3`) |
| `DEVFOCUS_PORT` | Server port (default `3001`) |
| `DEVFOCUS_PASS_HASH` | SHA-256 hash of the login password |
| `DEVFOCUS_API_TOKEN` | Read-only token (Bearer header) for dashboards |
| `DEVFOCUS_READER_TOKEN` | Read-only token (`?token=` param) for embeds |
| `DEVFOCUS_FRONTEND_URL` | Allowed CORS origin |

Integration credentials (Jira, Bitbucket, Outlook) are **not** environment variables — they're entered in Settings and stored encrypted in the database.

## Deployment

Deployed to Fly.io. After pushing, deploy with:

```bash
fly deploy
```

The Express server serves the built frontend, so a single machine runs the whole app.
