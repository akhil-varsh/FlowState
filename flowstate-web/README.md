# FlowState — Web

Marketing site and product documentation for **FlowState**, the privacy-first,
fully-offline developer context-restorer. Built with Next.js (App Router),
TypeScript, Tailwind, and Framer Motion.

> This is the **web** project. The FlowState product itself (daemon, VS Code
> extension, desktop widget, installer) lives in the separate `flowstate/`
> repository.

## Stack

| Concern      | Choice                                   |
| ------------ | ---------------------------------------- |
| Framework    | Next.js 14 (App Router) + React 18       |
| Language     | TypeScript (strict)                      |
| Styling      | Tailwind CSS 3 with CSS-variable tokens  |
| Motion       | Framer Motion                            |
| Theming      | next-themes (light / dark / system)      |
| Tests        | Vitest + Testing Library (jsdom)         |
| CI           | GitHub Actions (lint · typecheck · test · build) |

## Getting started

```bash
npm install
npm run dev        # http://localhost:3000
```

## Scripts

| Script              | What it does                                   |
| ------------------- | ---------------------------------------------- |
| `npm run dev`       | Start the dev server                           |
| `npm run build`     | Production build (`output: standalone`)        |
| `npm run start`     | Serve the production build                     |
| `npm run lint`      | ESLint (`next lint`)                           |
| `npm run typecheck` | `tsc --noEmit`                                 |
| `npm run test`      | Run the Vitest suite once                      |
| `npm run test:watch`| Watch mode                                     |
| `npm run ci`        | lint → typecheck → test → build (what CI runs) |

## Routes

| Route                 | Page                                    |
| --------------------- | --------------------------------------- |
| `/`                   | Landing page                            |
| `/guide`              | Getting-started walkthrough             |
| `/privacy`            | Privacy model & guarantees              |
| `/docs`               | Documentation overview                  |
| `/docs/installation`  | Install on Windows                      |
| `/docs/configuration` | `config.toml` and env overrides         |
| `/docs/api`           | REST API reference                      |
| `/docs/cli`           | CLI & shortcuts                         |
| `/docs/architecture`  | Tiers, stores, and the restore path     |

## Design system

The "lamplight in the dark" identity — a warm amber accent on deep slate — is
driven entirely by CSS custom properties in `app/globals.css`. Light is the
bare `:root` palette; `.dark` (toggled by next-themes, and matched to the system
preference) redefines the same tokens. Tailwind maps the tokens to semantic
color names in `tailwind.config.ts`, so components never hard-code a hex value.

Typography pairs **Fraunces** (display) with **IBM Plex Sans / Mono** — the
human train of thought captured by an engineered machine.

Shared copy (features, API rows, config keys, FAQ) lives in `lib/content.ts` so
the marketing pages, the docs, and the tests all read from one source of truth.

## CI / CD

- **`.github/workflows/ci.yml`** — runs on every push and PR against `main`
  across Node 18 and 20: lint, typecheck, unit tests, and a production build.
- **`.github/workflows/deploy.yml`** — runs after CI succeeds on `main`; wire in
  your host (Vercel, a container registry, or a static export) at the marked
  step.

## Project layout

```
app/                 App Router routes (landing, docs, guide, privacy)
components/           Nav, footer, theme, reveal, icons
components/landing/   Landing-page sections
components/docs/       Docs sidebar + prose primitives
lib/content.ts        Single source of truth for site copy
__tests__/            Vitest + Testing Library specs
```
