# Repository Guidelines

## Project Structure & Module Organization

- `src/main/`: Electron main process (app bootstrap, IPC, process manager, logging).
- `src/preload/`: Secure context bridge APIs exposed to the renderer.
- `src/renderer/src/`: React + TypeScript UI (components, hooks, stores, utils, styles, types).
- `src/types/` and `src/shared/`: Shared types and helpers.
- `logs/`, `out/`, `dist/`: Generated at build/runtime; do not edit.

## Build, Test, and Development Commands

- `pnpm dev`: Run Electron + Vite in development with HMR.
- `pnpm build`: Production build to `out/`.
- `pnpm preview`: Preview the production build.
- `pnpm package` / `pnpm dist`: Create binaries (or platform-specific with `dist:win|mac|linux`).
- `pnpm lint` / `pnpm lint:fix`: Lint code (ESLint) and auto-fix.
- `pnpm format` / `pnpm format:check`: Format with Prettier or verify.
- `pnpm type-check`: TypeScript diagnostics without emit.
- `pnpm test` / `pnpm test:watch` / `pnpm test:coverage`: Jest tests and coverage.

## Coding Style & Naming Conventions

- TypeScript strict mode; 2-space indentation; no unused vars/params.
- React components: PascalCase in `src/renderer/src/components` (e.g., `MyPanel.tsx`).
- Hooks: `useX.ts(x)` in `src/renderer/src/hooks`.
- Utilities: kebab- or lowerCamel-case in `utils/`.
- Import aliases: `@/`, `@main/`, `@preload/`, `@renderer/` (see `tsconfig.json`).
- Use ESLint + Prettier before pushing: `pnpm lint && pnpm format`.

## Testing Guidelines

- Frameworks: Jest + Testing Library (`jsdom` env).
- File patterns: `**/*.test.(ts|tsx)` or `**/*.spec.(ts|tsx)` under `src/`.
- Coverage: global ≥ 80% (branches, funcs, lines, statements). Some renderer modules have higher thresholds (see `jest.config.cjs`).
- Add tests near the code under test; prefer user-facing tests for components.

## Commit & Pull Request Guidelines

- Use Conventional Commits: `feat:`, `fix:`, `refactor:`, `chore:`, etc. Example: `feat: enhance export persistence management`.
- PRs must include: clear description, rationale, linked issues, test plan, and UI screenshots/GIFs when applicable.
- Keep PRs focused and small; note breaking changes explicitly.

## Security & Configuration Tips

- Do not use Node APIs in the renderer; go through `src/preload` IPC.
- Engine dependencies (Python 3.12, FFmpeg) are validated at runtime; avoid hardcoding absolute paths.
- Never commit secrets; use env vars or OS keychain where applicable.
