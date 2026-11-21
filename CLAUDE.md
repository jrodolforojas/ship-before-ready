# Ship Before Ready

Claude Code plugin that takes a builder from an idea to the first leads before any code is written. The plugin lives at the repo root: `.claude-plugin/`, `skills/<name>/SKILL.md`, `scripts/`, `templates/`, `hooks/`.

The build plan is [docs/plan.md](docs/plan.md). It is a copy; it is only updated on `main`.

## Language

| In English | In Spanish, in language files or documents |
|---|---|
| Skill commands, folders, files, scripts | Landing copy (`src/i18n/es.json`) |
| Tokens, hooks, JSON keys, events and their properties | What a skill says to the builder |
| Internal instructions of the skills, contracts, `CLAUDE.md`, comments and commits | Documents the builder reads: README, brief, verdict |

- The `description` of each skill is in Spanish; its `name` and its body are in English.
- The language of a project is the `locale` key of the brief (`es` by default). A skill speaks to the builder in that language.
- Fixed phrases of the plugin live in `locales/es.json`. No visible text lives in code: landing copy comes from `src/i18n/<locale>.json`.

## Technology

| Piece | Choice | Why |
|---|---|---|
| Generator | Astro 7, static output, no adapter | Copy is in the HTML at build time; Vercel detects it by itself |
| Styles | Tailwind 4 with the default palette and scales turned off | Only the utilities of our tokens exist: a color outside the system does not compile |
| Interaction | Our own TypeScript script with native browser validation | Four screens and five fields do not justify an island or a library |
| Copy | One file per language, `src/i18n/es.json` | No visible text lives in code |
| Fonts | Astro's fonts API with the Google provider | Downloaded at build time: no request to Google |
| Events | `fetch` to PostHog's capture API through a route on the landing's own domain | No third-party scripts; shows an error if the request fails |
| Publishing | Vercel CLI with `--cwd landing` | Never from the root: it would publish `.sbr/` |

No React, no Preact, no form library. The builder picks the package manager among bun, pnpm, npm and yarn; bun is the recommended one and the default. Plugin scripts are `.mjs` with no dependencies. Astro 7 needs Node 22.23.4 or newer.

## Contracts

- [docs/contracts/landing.md](docs/contracts/landing.md): anatomy, files, `data-sbr` hooks, copy keys, `config.json`, URL parameters, plugin scripts.
- [docs/contracts/tokens.md](docs/contracts/tokens.md): design variables, their Tailwind utilities, the `tokens.json` schema, color pair rules.
- [docs/contracts/state.md](docs/contracts/state.md): state files in the builder's repo.
- [docs/contracts/events.md](docs/contracts/events.md): PostHog events, properties and `src` values.
- [templates/contract.json](templates/contract.json): the same names in a file that scripts read.

**Contracts are edited only on `main`.** If a contract falls short, stop and report it; do not change it on your branch. Do not rename a file, hook, key, token, event or property without updating the contract.

## File ownership

Each step of the plan runs in its own session and, except 0b, in its own worktree; it ends in a pull request. A step only touches what it owns.

| Step | Owns |
|---|---|
| 0b (on `main`) | `docs/contracts/*`, `CLAUDE.md`, README, `templates/contract.json`, `templates/neutral-design/*`, `templates/example/*`, `locales/es.json`, renaming of the skills |
| 0c | `templates/canvas/*`, `scripts/fill-artboards.mjs`, `docs/design/compositions.md` |
| 1 | `templates/landing/**`, `scripts/copy-template.mjs` |
| 1b | `scripts/verify-design.mjs`, `verify-landing.mjs`, `capture.mjs`, `scripts/tests/*`, `guides/*`, `agents/design-reviewer.md`, `ATTRIBUTIONS.md` |
| 1c | Composition styles and components inside `templates/landing/`, `templates/landing-tests/*` |
| 2 | `site/**`, `scripts/configure-landing.mjs`; may fix `events.ts` |
| 3 | `skills/connect/*`, `skills/interview/*`, `skills/rules/*`, `agents/brief-reviewer.md`, `templates/probe/*`, `.mcp.json` |
| 4a | `skills/design/*` |
| 4b | `skills/landing/*` |
| 4c | `site/**`, and fixes in any folder because it is the only design session open |
| 5 | `skills/video-scripts/*`, `agents/script-reviewer.md` |

Not detailed in the plan yet: step 6 fills `skills/verdict/*`; step 7 `hooks/`. Only steps 0 and 8 touch `.claude-plugin/`.

To try a skill before merging, open Claude Code with `claude --plugin-dir <worktree>`.

## Code style

- No comments unless the code is genuinely complex. If one is needed, it explains why (a constraint, a workaround), not what.
- No `else` branches. Guard clauses (`if (cond) return ...`) and flat nesting.
- Self-descriptive names.
