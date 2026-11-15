<!-- Example .handoff/plan.md addressing two backlog items in a React + Apollo project. -->

# Add error boundary and extract user-search hook

> Created: 2026-04-12
> Author: plan skill
> Addresses backlog: #2, #5

## Background

Two backlog items pile up enough impact to address together: the missing error boundary causes blank screens on Apollo network failures, and the user-search logic is duplicated across three containers.

## Change list

### `frontend/main/src/components/error-boundary.tsx` — Create

A class-based React error boundary with a `fallback` prop. Catches render-tree errors and Apollo network errors thrown from suspense.

### `frontend/main/src/container/layout/layout.container.tsx` — Modify

Wrap the existing `<Outlet/>` in `<ErrorBoundary fallback={<ErrorScreen/>}>`. Match the Container/Presentation pattern from `docs/conventions/component-design-pattern.md`.

### `packages/logic/src/hooks/use-user-search.ts` — Create

Extract the `useUserSearch` hook from `home-start.container.tsx`, `dm.container.tsx`, `notifications.container.tsx`. Single source. Follow the Apollo Client query pattern in `docs/conventions/apollo-client.md`.

### `frontend/main/src/container/{home-start,dm,notifications}/*.container.tsx` — Modify

Replace inline user-search logic with `useUserSearch` from `@universe/logic`.

## Parallelization

Two independent groups — `/execute` may dispatch one subagent per group:

- **Group A (independent):** error boundary — Create `frontend/main/src/components/error-boundary.tsx`, then modify `frontend/main/src/container/layout/layout.container.tsx` to wrap with the new boundary
- **Group B (independent):** user-search hook extraction — Create `packages/logic/src/hooks/use-user-search.ts`, then modify the three container files (`home-start`, `dm`, `notifications`) to use the new hook

## Test strategy

- `packages/logic/src/hooks/use-user-search.spec.ts` — tests success / network error / debounce paths.
- `frontend/main/src/components/error-boundary.spec.tsx` — tests render-error catch + fallback render.

## Verification plan

- `pnpm turbo test` — all tests pass.
- `pnpm lint` — no errors.

(Typecheck is run by `/execute` as the compile-check safety net — `pnpm turbo typecheck` per `config.md`. Not repeated here.)
