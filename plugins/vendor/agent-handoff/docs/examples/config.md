<!-- Example .handoff/config.md from a pnpm + per-app workspace monorepo
     (NestJS server + React/Module Federation web + Flutter mobile).
     Demonstrates: doc index links, monorepo Verification Commands blockquote,
     and per-workspace agent guidance + docs scan. -->

# Handoff Config

## Verification Commands

test:
typecheck:
lint:
build:

> Monorepo — root package.json has no test/typecheck/lint scripts.
> Plan picks the right command per workspace from this candidate list:
> - apps/server: `pnpm -C apps/server test`, `pnpm -C apps/server test:e2e`
> - apps/web:    `pnpm -C apps/web test`, `pnpm -C apps/web tsc:check`, `pnpm -C apps/web lint`
> - apps/mobile: `cd apps/mobile && flutter test`, `cd apps/mobile && flutter analyze`

## Conventions

response_language: ko
handoff_dir:       .handoff
commit_style:      conventional
convention_docs:   CLAUDE.md

## Project Documentation Index

### Agent guidance
- [CLAUDE.md](CLAUDE.md) — root agent rules
- [AGENTS.md](AGENTS.md) — agent-agnostic rules
- [GEMINI.md](GEMINI.md) — Gemini-specific
- [apps/server/AGENTS.md](apps/server/AGENTS.md) — server workspace
- [apps/web/AGENTS.md](apps/web/AGENTS.md) — web workspace
- [.agents/skills/](.agents/skills/) — local skill index

### Project docs
- [README.md](README.md) — project overview
- [apps/server/README.md](apps/server/README.md) — server overview
- [apps/server/LOCAL_SETUP.md](apps/server/LOCAL_SETUP.md) — server local dev
- [apps/web/FE_DEVELOPMENT_GUIDE.md](apps/web/FE_DEVELOPMENT_GUIDE.md) — frontend dev guide
- [apps/web/MFE_DEPLOYMENT_STRATEGY.md](apps/web/MFE_DEPLOYMENT_STRATEGY.md) — module federation deploy
- [apps/mobile/README.md](apps/mobile/README.md) — mobile overview
- [apps/mobile/CHANGELOG.md](apps/mobile/CHANGELOG.md) — mobile changelog

### Detected toolchain
- package manager: pnpm@10.2.1 (from pnpm-lock.yaml)
- monorepo: per-app pnpm workspaces (`apps/server`, `apps/web`, `apps/mobile`); `apps/web` uses Turbo + Module Federation
- workspaces: apps/server, apps/web, apps/mobile
- frameworks: NestJS (server), React + Module Federation (web), Flutter (mobile)
