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
| `.sbr/bypass.log` | gate | `verdict`, gate | Date, session, file and reason of every bypass |

- The gate acts only in a project that has `.sbr/brief.md`.
- The gate never blocks edits inside `.sbr/` or `landing/`.
- The gate lets every edit through, silently, when `.sbr/verdict.md` has `result: evidence_to_continue`.
- Once a reason is recorded in `.sbr/bypass.log`, the gate lets edits through for the rest of that session.
- State is never stored in `CLAUDE_PLUGIN_ROOT`: that path changes with every plugin update.
- `.sbr/` is committed with the repo and holds no secrets. It is never published: `landing` deploys with `--cwd landing`.
- PostHog is read through the builder's sign-in, never with a key: the plugin declares PostHog's MCP server in its `.mcp.json` under the name `posthog`, and `connect` and `verdict` read through that session. No personal API key exists anywhere, and there is no `.env` file in `.sbr/`.

## Conventions

- JSON keys and header keys are `snake_case`, in English.
- Timestamps are ISO 8601 in UTC (`2026-11-21T03:12:45Z`); dates are `YYYY-MM-DD`.
- A Markdown state file starts with a header between two `---` lines: one `key: value` per line, values on a single line, strings in double quotes when they contain `:` or `#`. A list of plain values is written inline (`cold_sources: [v1, v2, v3, bio]`). Only three keys are nested, indented two spaces per level: `questions` in the brief, `scripts` in the video scripts and `counts` in the verdict.
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
| `probe_url` | URL of the probe page that `connect` published to check the Vercel connection |
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
| `reviewer` | `pending` or `approved`. It becomes `approved` only when `brief-reviewer` answers `approved` ([reviewers.md](reviewers.md)); `design` does not run without it |
| `locale` | Language of the project: of the brief body, of the landing copy and of what the skills say to the builder |
| `persona`, `pain`, `current_solution`, `promise` | One line each, in the builder's language |
| `questions` | The three questions of screen 3, with the same keys as the copy file and the event properties |

Reference file: [`templates/example/brief.md`](../../templates/example/brief.md).

## `.sbr/rules.md`

The thresholds live in the header. The defaults come from the design document; the builder may adjust them before sealing.

| Header key | Default | Value |
|---|---|---|
| `min_cold_visitors` | `200` | Cold visitors needed before rates are judged |
| `signup_rate_pass` | `0.05` | Signups over cold visitors at or above which the filter passes |
| `signup_rate_gray_min` | `0.038` | Lower bound of the gray zone, which ends at `signup_rate_pass` |
| `no_evidence_visitors` | `300` | Cold visitors with no qualified lead that mean no evidence in this angle |
| `calls_scheduled_pass` | `3` | Calls scheduled with strangers that mean evidence to continue |
| `cold_sources` | `[v1, v2, v3, bio]` | Values of `source` that count as cold traffic ([events.md](events.md#source)) |
| `verdict_date` | None | Date the verdict is due |
| `sealed` | Absent until sealed | Date of the seal |

Rates are fractions: `0.05` is 5%. The body is in the builder's language.

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

```markdown
---
result: insufficient_sample
computed_at: 2026-11-22T18:00:00Z
rules_commit: <sha>
rules_changed_after_seal: false
reviewer: pending
counts:
  cold:
    visitors: 0
    cta_clicks: 0
    signups: 0
    answers: 0
    qualified_leads: 0
    calls_scheduled: 0
  friends:
    visitors: 0
    cta_clicks: 0
    signups: 0
    answers: 0
    qualified_leads: 0
    calls_scheduled: 0
  untagged:
    visitors: 0
    cta_clicks: 0
    signups: 0
    answers: 0
    qualified_leads: 0
    calls_scheduled: 0
calls_held_declared: 0
---

Body in the builder's language.
```

| Header key | Value |
|---|---|
| `result` | One of the four results below; the same list as `verdict_results` in `templates/contract.json` |
| `computed_at` | Timestamp of this verdict |
| `rules_commit` | SHA of the commit of `.sbr/rules.md` whose thresholds this verdict applied |
| `rules_changed_after_seal` | `true` when a commit touched `.sbr/rules.md` after the `commit` of `.sbr/seal.json`; `false` otherwise |
| `reviewer` | `pending` or `approved`. It becomes `approved` only when `verdict-reviewer` answers `approved` ([reviewers.md](reviewers.md)) |
| `counts` | One group per kind of traffic: `cold` (the `cold_sources` of the rules), `friends` and `untagged`. `test` is never counted |
| `calls_held_declared` | Calls that took place, as declared by the builder. Not measured, so it stays outside `counts` |

Every group of `counts` has the same six keys:

| Key | Counts |
|---|---|
| `visitors` | Unique visitors |
| `cta_clicks` | `sbr_cta_click` |
| `signups` | `sbr_signup` |
| `answers` | `sbr_answers` |
| `qualified_leads` | Visitors who answered both questions with a real case and left a contact |
| `calls_scheduled` | Visitors who left WhatsApp and a time slot |

Only `cold` decides the result.

| `result` | Phrase in `locales/<locale>/verdict.json` |
|---|---|
| `insufficient_sample` | `results.insufficient_sample` |
| `iterate_promise` | `results.iterate_promise` |
| `no_evidence` | `results.no_evidence` |
| `evidence_to_continue` | `results.evidence_to_continue` |

The body carries the result, the table of numbers per source with every rate next to its raw count, and the list of what the verdict does not measure. If the rules changed after the seal, the body says so before any number.

## `.sbr/video-scripts.md`

```markdown
---
reviewer: pending
locale: es
bio_link: "<landing url>?src=bio"
friends_link: "<landing url>?src=friends"
scripts:
  - id: v1
    angle: pain
    smp: "<one sentence>"
    keyword: <word>
    link: "<landing url>?src=v1"
  - id: v2
    angle: top3
    smp: "<one sentence>"
    keyword: <word>
    link: "<landing url>?src=v2"
  - id: v3
    angle: founder
    smp: "<one sentence>"
    keyword: <word>
    link: "<landing url>?src=v3"
---

## v1

Script in the builder's language.

## v2

## v3
```

| Header key | Value |
|---|---|
| `reviewer` | `pending` or `approved`. It becomes `approved` only when `script-reviewer` answers `approved` ([reviewers.md](reviewers.md)) |
| `locale` | Language of the scripts |
| `bio_link` | The landing URL with `?src=bio`: the one link for the builder's profile |
| `friends_link` | The landing URL with `?src=friends` |
| `scripts` | List of exactly three items, in the order `v1`, `v2`, `v3` |
| `id` | `v1`, `v2` or `v3`. It is also the `src` of its link ([events.md](events.md#source)) |
| `angle` | `pain` for `v1`, `top3` for `v2`, `founder` for `v3` |
| `smp` | The single idea of the video, in one sentence |
| `keyword` | The word a viewer comments to receive the link of that video |
| `link` | The landing URL with `?src=<id>` |

The landing URL is `url` in `.sbr/landing.json`. The body has one section per script, titled with its `id`.

## `.sbr/bypass.log`

JSON Lines: one JSON object per line, one line per bypass. `scripts/bypass.mjs` appends the line after the builder gives a reason; nothing rewrites earlier lines.

| Key | Value |
|---|---|
| `at` | Timestamp of the bypass |
| `session_id` | Id of the Claude Code session in which the reason was given. A reason is valid for that whole session, and only for it |
| `file` | File the agent was about to edit |
| `reason` | The reason, in the builder's words |

```json
{"at":"2026-11-21T18:40:00Z","session_id":"<session id>","file":"<path>","reason":"<reason>"}
```

## Plugin phrases

Fixed phrases that the skills say to the builder live in the plugin, one file per skill: `locales/<locale>/<skill>.json` (`locales/es/connect.json`). Keys are in English. A skill reads the file of the brief's `locale` and falls back to `locales/es/<skill>.json`. Each file belongs to the step that owns that skill. The gate is not a skill but follows the same rule with `locales/<locale>/gate.json`, owned by step 7.
