# State contract (builder's repo)

Skills and the gate talk to each other only through these files, which live in the builder's repo. File names and keys do not change without updating this contract.

Edit this file only on `main`.

## Files

| File | Written by | Read by | Content |
|---|---|---|---|
| `.sbr/connections.json` | `connect` | `design`, `landing`, `verdict` | Package manager, PostHog and Vercel connections. No secrets |
| `.sbr/brief.md` | `interview` | `rules`, `design`, `video-scripts` | Header with the brief fields; body in the builder's language |
| `.sbr/rules.md` | `rules` | `verdict`, gate | Thresholds, verdict date and the seal; the seal is a commit |
| `.sbr/seal.json` | `rules` | `verdict` | Which commit sealed the rules, and when |
| `.sbr/design/answers.md`, `.sbr/design/market.md`, `.sbr/design/concepts.md` | `design` | `design` | The four design answers (each marked given or derived), the market look, the three concepts |
| `.sbr/sketches/{a,b,c}/tokens.json` and `.sbr/sketches/{a,b,c}/concept.md` | `design` | builder | One direction per letter |
| `.sbr/design/tokens.json`, `.sbr/design/copy.<locale>.json`, `.sbr/design/system.md` | `design` | `landing` | The approved design system |
| `.sbr/design/choice.md` | `design` | `landing` | Which direction was chosen and its approval |
| `landing/` and `.sbr/landing.json` | `landing` | `video-scripts`, `verdict` | The Astro project and the record of its publication |
| `.sbr/video-scripts.md` | `video-scripts` | `verdict` | Three scripts, each with its link |
| `.sbr/verdict.md` | `verdict` | gate | The result and the numbers with their raw counts |
| `.sbr/bypass.log` | gate | `verdict` | Date, file and reason of every bypass |

- The gate never blocks edits inside `.sbr/` or `landing/`.
- State is never stored in `CLAUDE_PLUGIN_ROOT`: that path changes with every plugin update.
- `.sbr/` is committed with the repo and holds no secrets. It is never published: `landing` deploys with `--cwd landing`.
- PostHog is read through the builder's sign-in, never with a key: the plugin declares PostHog's MCP server in its `.mcp.json`, and `connect` and `verdict` read through that session. No personal API key exists anywhere, and there is no `.env` file in `.sbr/`.

## Conventions

- JSON keys and header keys are `snake_case`, in English.
- Timestamps are ISO 8601 in UTC (`2026-11-21T03:12:45Z`); dates are `YYYY-MM-DD`.
- A Markdown state file starts with a header between two `---` lines: one `key: value` per line, values on a single line, strings in double quotes when they contain `:` or `#`. The only nested key is `questions` in the brief, indented two spaces.
- `<locale>` matches `^[a-z]{2}(-[A-Z]{2})?$`; the default is `es`.

## `.sbr/connections.json`

| Key | Value |
|---|---|
| `package_manager` | `bun`, `pnpm`, `npm` or `yarn`. `bun` is the recommended one and the default |
| `posthog_region` | `us` or `eu` |
| `posthog_public_key` | Public project key (`phc_…`). `connect` reads it from the signed-in PostHog session; the builder never pastes it |
| `posthog_project_id` | Project id, as a string |
| `vercel_project` | Name of the Vercel project |
| `vercel_team` | Team slug, or `null` for a personal account |
| `verified_at` | Timestamp of the last successful check |

## `.sbr/brief.md`

```markdown
---
reviewer: pending
locale: es
persona: "Who the user is, in one line"
pain: "What hurts, in one line"
current_solution: "What they do today and what it costs them, in one line"
promise: "What the product promises, in one line"
questions:
  current_solution: "Question about what they use today"
  last_time: "Question about the last time it happened and what it cost"
  wants_call: "Invitation to a call"
---

Body in the builder's language.
```

| Key | Value |
|---|---|
| `reviewer` | `pending` or `approved`. Only the context-free reviewer sets `approved`; `design` does not run without it |
| `locale` | Language of the project: of the brief body, of the landing copy and of what the skills say to the builder |
| `persona`, `pain`, `current_solution`, `promise` | One line each, in the builder's language |
| `questions` | The three questions of screen 3, with the same keys as the copy file and the event properties |

Reference file: [`templates/example/brief.md`](../../templates/example/brief.md).

## `.sbr/rules.md`

Header keys: `sealed` (date of the seal; absent until sealed) and `verdict_date` (date the verdict is due). The thresholds go in the body, each with its source; the layout of the body belongs to `rules`.

`rules` seals by committing `.sbr/rules.md` alone. That commit is the seal.

### `.sbr/seal.json`

A file cannot hold the hash of its own commit, and editing `rules.md` after the seal would look like a change of rules. So the seal is recorded apart: `rules` writes this file right after the seal commit and commits it on its own.

| Key | Value |
|---|---|
| `sealed_at` | Timestamp of the seal |
| `commit` | Full SHA of the commit that sealed `.sbr/rules.md` |

Every commit that touches `.sbr/rules.md` after `commit` is a change of rules. `verdict` lists them with `git log <commit>..HEAD -- .sbr/rules.md` and shows them. Running `rules` again never rewrites `seal.json`.

## `.sbr/design/`

- `tokens.json`: the approved direction, following [tokens.md](tokens.md).
- `copy.<locale>.json`: the approved copy, following the copy keys of [landing.md](landing.md#copy-keys). `landing` copies both files unchanged to `landing/src/data/tokens.json` and `landing/src/i18n/<locale>.json`.
- `system.md`: the design system in prose. Every decision cites a line of the brief (R31).
- `answers.md`, `market.md`, `concepts.md`: Markdown working notes; only `design` writes and reads them, so their layout belongs to that skill.
- `.sbr/sketches/<letter>/tokens.json` follows [tokens.md](tokens.md); `concept.md` is the concept in prose.

### `.sbr/design/choice.md`

| Header key | Value |
|---|---|
| `chosen` | `a`, `b` or `c` |
| `approved` | Timestamp of the builder's written approval. Absent until then; `landing` does not run without it |
| `canvas` | URL of the Claude Design canvas, or `none` in the fallback without Claude Design |
| `fingerprint` | `sha256:<hex>`, see below |
| `reason` | Why the builder chose it, in their words, one line |

**Fingerprint.** The SHA-256, in lowercase hex, of the bytes of `.sbr/design/tokens.json` followed directly by the bytes of `.sbr/design/copy.<locale>.json`. Same result as `cat .sbr/design/tokens.json .sbr/design/copy.<locale>.json | shasum -a 256`. `landing` recomputes it before installing and stops if it differs from `choice.md`.

## `.sbr/landing.json`

| Key | Value |
|---|---|
| `url` | Public URL of the landing |
| `published_at` | Timestamp of the last publication |
| `fingerprint` | The fingerprint of the design that was published; equal to the one in `choice.md` |
| `verification` | `{ "passed": [...], "failed": [...], "skipped": [...] }` with requirement ids (`R1` to `R32`) from the last run of the gate |

## `.sbr/verdict.md`

Header key `result`, one of:

| `result` | Phrase in `locales/<locale>.json` |
|---|---|
| `insufficient_sample` | `verdict.results.insufficient_sample` |
| `iterate_promise` | `verdict.results.iterate_promise` |
| `no_evidence` | `verdict.results.no_evidence` |
| `evidence_to_continue` | `verdict.results.evidence_to_continue` |

The body carries the numbers, every rate next to its raw count. Step 6 fixes the rest of this file on `main` when it is detailed.

## `.sbr/video-scripts.md`

Three scripts. Each one names its link: the landing URL with `?src=v1`, `?src=v2` or `?src=v3` ([events.md](events.md#source)).

## `.sbr/bypass.log`

One line per bypass, tab-separated: timestamp, file the builder was about to edit, reason given.

## Plugin phrases

Fixed phrases that the skills say to the builder live in `locales/<locale>.json` in the plugin, with English keys. A skill reads the file of the brief's `locale` and falls back to `locales/es.json`.
