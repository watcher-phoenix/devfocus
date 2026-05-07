# DevFocus — Claude Instructions

## Project

Personal productivity dashboard. Monorepo: Express + Sequelize + SQLite backend, React + Vite + MUI frontend. Plain JavaScript (no TypeScript).

## Committing and pushing

Stage all modified tracked files, generate an appropriate commit message based on the diff, commit, push to `origin main`, then deploy to Fly.io:

```bash
fly deploy
```

Always deploy after pushing. The app is live at https://devfocus.fly.dev.

**Before every commit**, verify the frontend builds cleanly:

```bash
cd frontend && npx vite build
```

Do not commit if the build fails.

## Documentation

The app has a built-in Guide page at `frontend/src/pages/Guide.jsx`. When committing changes that affect user-facing features, behavior, or workflow, update the Guide to reflect those changes. Each page also has a contextual hint banner (`ContextualHint` component) — update those if the page's purpose changes.

## Running locally

```bash
npm run dev
```

Backend on :3001, frontend on :5173 (proxied via Vite).

## Project structure

```
devfocus/
├── backend/           # Express + Sequelize + SQLite
│   ├── start.js       # Entry point
│   ├── server.js      # Express app
│   ├── scheduler.js   # node-cron background sync
│   ├── database/
│   │   ├── connection.js
│   │   └── models/    # Sequelize models
│   ├── routes/        # Express route handlers
│   ├── services/      # Integration sync services (jira, bitbucket, calendar)
│   └── utilities/     # Auth
└── frontend/          # React + Vite + MUI + Zustand + TanStack Query
    └── src/
        ├── api/       # TanStack Query hooks
        ├── stores/    # Zustand stores
        ├── pages/     # Route pages (lazy-loaded)
        └── components/
```

## Database

SQLite via Sequelize. Tables auto-sync on startup (`sequelize.sync()`). No migration CLI — schema changes go through model definitions.

## Environment

No Doppler for this project. Local dev uses no env vars (auth is skipped when `DEVFOCUS_PASS_HASH` is unset). Production env is set in `fly.toml`.

## Key conventions

- Backend: CommonJS (`require`)
- Frontend: ESM (`import`)
- ESLint Airbnb + Prettier (singleQuote, trailingComma: es5)
- No TypeScript
- Pages are lazy-loaded via `React.lazy` + `Suspense`
- API hooks follow pattern: `useQuery`/`useMutation` with `queryKey` invalidation
