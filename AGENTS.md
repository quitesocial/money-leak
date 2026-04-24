# AGENTS.md

## Project

Money Leak is a minimal mobile expense tracking app focused on behavioral money leaks, not classic budgeting.

Current stage: early Expo/React Native bootstrap.

## Product Guardrails

- Prefer speed over perfection.
- Prefer simplicity over flexibility.
- Prefer emotion over precision.
- Do not overengineer.
- No backend.
- No auth.
- No cloud sync.
- No bank integrations.

Unless the task explicitly asks for it, do not add:

- database implementation
- Zustand store
- transaction domain models beyond what is needed for the task
- forms infrastructure
- analytics logic
- share/export features
- extra dependencies without a clear reason

## Tech Stack

- Expo
- React Native
- TypeScript
- Expo Router
- ESLint
- Prettier
- npm

Use Node `20.19.4` for this project.

```sh
source /Users/quitesocial/.nvm/nvm.sh
nvm use 20.19.4
```

## Repository Conventions

- Keep `app/` route-focused. Route files and layout files live there.
- Keep screen implementations in `src/features/*`.
- Keep shared presentational components in `src/components`.
- Keep general helpers in `src/lib`.
- Keep `src/db`, `src/store`, and `src/types` empty until a task actually requires them.
- Prefer the `@/*` path alias for imports from `src`.
- Keep placeholder UI minimal and explicit. Do not invent fake product logic.
- When a local function or hook needs more than two inputs (3+), prefer one object parameter with named fields.

## Current App Structure

- `app/_layout.tsx`: root Expo Router layout.
- `app/(tabs)/_layout.tsx`: bottom tab navigation.
- `app/(tabs)/index.tsx`: Home route.
- `app/(tabs)/add-transaction.tsx`: Add Transaction route.
- `app/(tabs)/analytics.tsx`: Analytics route.
- `src/features/*`: screen components for each route.
- `src/components/screen-shell.tsx`: minimal shared screen wrapper.

## Commands

Install dependencies:

```sh
npm install
```

Start Expo:

```sh
npm run start
```

Start web:

```sh
npm run web
```

Lint:

```sh
npm run lint
```

Format check:

```sh
npm run format:check
```

Test:

```sh
npm test
```

Format:

```sh
npm run format
```

Type-check:

```sh
npx tsc --noEmit
```

## Validation Checklist

After code changes, prefer to run the smallest relevant checks:

- `npm test`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run format:check`

If routing, startup, or platform config changed, also verify:

- `npm run start`
- `npm run web` when the change may affect web support

## Working Style

- Make the smallest clean change that solves the task.
- Avoid speculative abstractions.
- Preserve the existing folder ownership model.
- Do not move screen logic into `app/` unless explicitly requested.
- Do not leave generated artifacts in the repo.

Generated/local artifacts that should stay out of commits:

- `.expo/`
- `dist/`
- `expo-env.d.ts`
- IDE files
