---
name: verdict
description: Lee los números de la landing en PostHog con las varas que el builder selló antes de lanzar y da una de cuatro respuestas, con cada tasa junto a su conteo. Avisa primero si las reglas cambiaron después del sello. Informa; la decisión de seguir y el precio son del builder.
---

# verdict

Read the landing's numbers from the builder's PostHog, apply the thresholds sealed in `.sbr/rules.md`, and write `.sbr/verdict.md` with one of four results, following [the state contract](../../docs/contracts/state.md#sbrverdictmd). The verdict informs; it never decides for the builder.

## Rules that hold for every step

- **The script decides, not you.** Which result comes out of which numbers lives in `scripts/ladder.mjs`. Never pick or change a result yourself, never round a number, never compute a rate by hand.
- **The queries are fixed.** Run the two templates in `${CLAUDE_SKILL_DIR}/queries/` exactly as written, replacing only `{since}`. Never write another query, never add or drop a filter. If one fails, say `preconditions.query_failed` and stop: no verdict without numbers.
- **Only cold traffic decides.** Cold is the `cold_sources` of the sealed rules. `friends` and `untagged` are shown apart. Visits with `src=test` are never counted; the queries drop every visitor that ever sent `source: test`.
- **Rule changes come first.** If the rules changed after the seal, say so before any number, in the chat and in the file.
- **No rate without its raw count.** Every rate you say is written as the script formats it: `4% (8 de 200)`.
- **Measured and declared stay apart.** Calls held are declared by the builder, written apart, and never change the result.
- **No personal data leaves PostHog.** The queries never select an email or a WhatsApp number; never query them and never write them anywhere. Answers to the questions are shown to the builder in the chat only, never written to a file in the repo.
- **No prices.** The verdict does not measure willingness to pay and never suggests a price.
- The project's language is the `locale` of `.sbr/brief.md`, or `es` without a brief. Speak to the builder in it; in Spanish, address them as "usted". Fixed phrases come from `${CLAUDE_PLUGIN_ROOT}/locales/<locale>/verdict.json`, falling back to `${CLAUDE_PLUGIN_ROOT}/locales/es/verdict.json`; read that file first. Keys are written below as `section.key`; replace `{placeholders}` with real values.
- Run the script as `node "${CLAUDE_SKILL_DIR}/scripts/verdict.mjs" <command>`. It prints JSON. Exit code 0 is success, 1 is a check that failed, 2 is a usage or environment error; on 1 or 2 read stderr and tell the builder what it says, in their language.
- The builder's repo is the current working directory. Keep the working files of this run in a temporary folder outside the repo: create it with `mktemp -d` and call it `<work>` below.
- Do not commit. The builder decides when.

## 1. Preconditions

Check in this order and stop at the first one missing, saying its phrase:

| Missing | Phrase |
|---|---|
| A git repo (`git rev-parse --show-toplevel` fails) | `preconditions.not_a_repo` |
| `.sbr/rules.md` or `.sbr/seal.json` | `preconditions.no_rules` |
| `.sbr/landing.json` with a `url` | `preconditions.no_landing` |
| `.sbr/connections.json` with `posthog_project_id` | `preconditions.no_connections` |
| A PostHog session | `preconditions.posthog_sign_in`, then wait and check again when the builder comes back |
| The project of `.sbr/connections.json`, made active in this conversation | `preconditions.posthog_project_unreachable`, with `{project_id}` from that file |

PostHog is read through the builder's sign-in, never with a key, and only in the project of `.sbr/connections.json`.

1. **Find the tool.** The plugin declares PostHog's MCP server as `posthog`; its tool is `mcp__plugin_ship-before-ready_posthog__exec`. If the builder also has PostHog's own plugin, the same tool may be `mcp__plugin_posthog_posthog__exec`, or `mcp__posthog__exec`; use whichever is connected. If tools load on demand, search with ToolSearch using the server's name as the query (`plugin:ship-before-ready:posthog`, then `plugin:posthog:posthog`). No PostHog tool after that search means no session in this conversation: say `preconditions.posthog_sign_in` with `{server}` set to the server this session reports as needing authentication, or `plugin:ship-before-ready:posthog` if it names none, and wait. When the builder comes back, search again with the server's name: that search reconnects the server without a restart.
2. **Every call carries `context` and, after the first, `conversation_id`.** `exec` takes `command`, one string, and `context`, a few words on why you call it; `context` is required and never carries names, emails, numbers or keys. The answer of the first call brings a `conversation_id`. Pass that same `conversation_id` on every later call of this run. Without it PostHog refuses `switch-project`, and a query reads whichever project the builder has open in PostHog, not the idea's.
3. **Switch first.** The first call is the switch; PostHog moves the conversation to the project's organization too, so the project id is enough. If the switch fails, or its answer names another project, say `preconditions.posthog_project_unreachable` and stop. Never run a query in a conversation where the switch did not succeed.

| Purpose | `command` | `context` |
|---|---|---|
| Make the idea's project the active one | `call switch-project {"projectId": <posthog_project_id>}` | `verdict: switch to the idea's project` |
| Run a query | `call execute-sql {"query": "<HogQL>"}` | `verdict: read landing counts` or `verdict: read landing answers` |

`<posthog_project_id>` is the number in `.sbr/connections.json`, without quotes. `<HogQL>` is the template's text as a JSON string: escape its quotes and line breaks, change nothing else. Some clients expose `…__switch-project` and `…__execute-sql` directly; call them with the same input, `context` and `conversation_id` included.

## 2. Integrity of the rules

```bash
node "${CLAUDE_SKILL_DIR}/scripts/verdict.mjs" integrity .
```

It answers with `rules_commit` (the seal), `rules_changed_after_seal`, `uncommitted_changes`, `changes` (every commit that touched `.sbr/rules.md` after the seal, with its reason), `changed_keys`, `since`, `verdict_date` and the sealed `rules`.

- If `rules_changed_after_seal` or `uncommitted_changes` is `true`, or `changed_keys` is not empty, this is the first thing you say, before any number: `integrity.changed_title`, `integrity.changed_intro`, one `integrity.commit_line` per change, `integrity.uncommitted` if it applies, one `integrity.key_line` per changed key, and `integrity.applied_sealed`. The verdict always applies the sealed rules.
- Otherwise say `integrity.unchanged`.
- If today is before `verdict_date`, say `early_reading`. The reading goes on.

## 3. Counts

Read `${CLAUDE_SKILL_DIR}/queries/counts.sql`, replace `{since}` with `since` from step 2, and run it with `execute-sql`, with the `conversation_id` of step 1. It returns one row per source with `source`, `visitors`, `cta_clicks`, `signups` and `answers`, each counting unique people (distinct `distinct_id`), each person under the source of their first visit, from the seal on.

Write the rows as they came to `<work>/counts.json`: a JSON list, one object per row, with those five keys. Copy every number exactly; add or drop no row.

## 4. Answers

Read `${CLAUDE_SKILL_DIR}/queries/answers.sql`, replace `{since}`, and run it the same way, with the same `conversation_id`. It returns one row per person who answered, with their latest answers: `source`, `has_email`, `current_solution`, `last_time`, `wants_call`, `has_whatsapp`, `has_time_slot`. If it returns 1000 rows, the limit was hit: say so and stop.

For each row decide `real_case`, `true` or `false`. A row is a real case only when both answers are about something that happened to that person:

- `current_solution` names what they actually do or use today, even if it is "Excel" or "lo hago a mano". It fails when it is empty, "nada", "no sé", a joke, a test text or a copy of the question.
- `last_time` names a moment or an episode, or what it cost them: time, money, a mistake, a consequence. It fails when it is empty, "nunca", generic ("siempre pasa") or a test text.

Show the builder the table of `answers_table`: one row per answer with the source, both answers as written, your mark and a short reason. Never show email or WhatsApp; the rows do not carry them. If there are no rows, say `answers_table.none`.

Write `<work>/answers.json`: a JSON list with one object per row, in the same order, with `source`, `has_email`, `wants_call`, `has_whatsapp`, `has_time_slot` and your `real_case`, all as `true` or `false`. Do not copy the answer texts into it.

The script, not you, turns these rows into counts:

- **Qualified lead:** `real_case` and a contact left (`has_email` or `has_whatsapp`).
- **Call scheduled:** `wants_call`, `has_whatsapp` and `has_time_slot`.

## 5. Build and decide

```bash
node "${CLAUDE_SKILL_DIR}/scripts/verdict.mjs" build . <work>/counts.json <work>/answers.json --calls-held 0 > <work>/input.json
node "${CLAUDE_SKILL_DIR}/scripts/verdict.mjs" decide <work>/input.json > <work>/decision.json
```

`build` reads the sealed rules itself, drops any `test` row, checks that every source in `answers.json` has as many rows as `answers` says in `counts.json`, and computes qualified leads and scheduled calls. If it fails, the rows were copied wrong: copy them again from the query results.

Read `counts.cold.calls_scheduled` from `<work>/decision.json`. If it is above 0, ask `declared.question` as a plain message. Accept a whole number from 0 to that count; otherwise say `declared.invalid` and ask again. Then run `build` again with `--calls-held <the number>`, and `decide` again. With no scheduled calls, calls held is 0 and you do not ask.

`decide` answers `result`, `reason`, `matched` (every result whose own condition holds), `signup_filter`, `counts`, `rates`, `by_source`, and, when the thresholds changed after the seal, `with_rules_now`: the result the current thresholds would give. That second reading is shown, never applied.

## 6. Review

```bash
node "${CLAUDE_SKILL_DIR}/scripts/verdict.mjs" review-input . <work>/decision.json > <work>/review-input.json
```

That file holds only numbers and thresholds. Call the agent `ship-before-ready:verdict-reviewer` with a prompt that is only the absolute path of `<work>/review-input.json`: no summary, no result explained, nothing about the idea. Save its whole answer, unchanged, to `<work>/review.txt`.

- `approved`: go on.
- `rejected`: read each finding against the query results and your two files. If it points at a number you copied wrong, say `review.retrying`, fix the file, and run steps 5 and 6 again. At most three reviews in all. If the third still says `rejected`, or a finding points at nothing you can fix, say `review.gave_up` and go on with that answer: the file stays `reviewer: pending` and lists the findings.

Never edit the reviewer's answer and never write `approved` yourself.

## 7. Write

```bash
node "${CLAUDE_SKILL_DIR}/scripts/verdict.mjs" write . <work>/decision.json <work>/review.txt
```

The script writes `.sbr/verdict.md`: the contract header, then the rule changes if any, the result and its reason, the table of numbers per source, the rates with their counts, the declared calls, the sealed thresholds, what the verdict does not measure, the review, and the closing line. Do not write or edit that file by hand.

## 8. Tell the builder

In this order, from `.sbr/verdict.md` and the phrases:

1. The rule changes, if any, again first.
2. The result: `results.<result>.title`, then the reason as written in the file.
3. The table of numbers per source and the cold signup rate with its count.
4. The declared calls held, as declared.
5. The list under `not_measured`.
6. `saved`.
7. `closing`, alone, as the last line.

Do not recommend whether to continue, what to build or what to charge. If the builder asks, the decision and the price are theirs.

## Test without PostHog

The ladder runs on counts in a file, with no PostHog and no repo:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/verdict.mjs" decide "${CLAUDE_SKILL_DIR}/fixtures/no_evidence.json"
node --test "${CLAUDE_SKILL_DIR}/tests/"*.test.mjs
```

`fixtures/` holds one input per result.
