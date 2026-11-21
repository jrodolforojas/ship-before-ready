---
name: rules
description: Muestra las varas del veredicto con su fuente, deja ajustarlas, pregunta la fecha de veredicto y las sella con un commit antes de lanzar. Si se corre de nuevo después del sello, no cambia nada sin avisar.
---

# rules

Write `.sbr/rules.md` with the thresholds the verdict will use and seal it with a commit, before anything is launched. The files follow [the state contract](../../docs/contracts/state.md): `.sbr/rules.md` holds the thresholds in its header, and `.sbr/seal.json` records which commit sealed them.

## Rules that hold for every step

- **The seal is a commit, and only the script makes it.** Never run `git commit` yourself for these files, never write `.sbr/seal.json` by hand, and never write the `sealed` key: the script adds it.
- **After the seal, nothing changes silently.** If the rules are already sealed, change no file unless the builder asks for a change, hears the warning and gives a reason.
- **No prices.** No price, plan or payment appears in the rules.
- The project's language is the `locale` of `.sbr/brief.md`, or `es` when there is no brief. Speak to the builder in that language; in Spanish, address them as "usted". Fixed phrases come from `${CLAUDE_PLUGIN_ROOT}/locales/<locale>/rules.json`, falling back to `${CLAUDE_PLUGIN_ROOT}/locales/es/rules.json`; read that file first. Keys are written below as `section.key`.
- Run the script as `node "${CLAUDE_SKILL_DIR}/scripts/seal.mjs" <command> .`. It prints one JSON line. Exit code 0 is success, 1 is a rule that does not hold, 2 is a usage or environment error; on 1 or 2 read stderr and tell the builder what it says, in their language.
- The builder's repo is the current working directory.

## 1. Where things stand

- If `.sbr/seal.json` exists, the rules are sealed: go to [Already sealed](#already-sealed).
- If `.sbr/brief.md` does not exist, say `no_brief` and continue.
- If the folder is not a git repo (`git rev-parse --show-toplevel` fails), say `no_repo` and wait. Run `git init` only after the builder accepts.
- If `.sbr/rules.md` exists without a seal, it is a draft: start from its values instead of the defaults.

## 2. Show the thresholds

Say `intro` and show one table with the columns of `table` and one row per threshold, in this order. Label, what it measures and source come from `thresholds.<key>`.

| Header key | Default | Shown as |
|---|---|---|
| `min_cold_visitors` | `200` | 200 |
| `signup_rate_pass` | `0.05` | 5% |
| `signup_rate_gray_min` | `0.038` | 3,8% |
| `no_evidence_visitors` | `300` | 300 |
| `calls_scheduled_pass` | `3` | 3 |
| `cold_sources` | `[v1, v2, v3]` | v1, v2, v3 |

Rates are stored as fractions and shown to the builder as percentages.

## 3. Adjust

Ask with AskUserQuestion, using `adjust.question` and the two options of `adjust.options`, `keep` first.

- `keep`: go on.
- `adjust`: ask `adjust.which`, apply the change, show the table again and ask the same question again, until the builder keeps them.

A value holds when: the three counts are whole numbers above zero; the two rates are above 0 and below 1; `signup_rate_gray_min` is below `signup_rate_pass`; `no_evidence_visitors` is not below `min_cold_visitors`; `cold_sources` is a non-empty list with values among `v1`, `v2`, `v3`. If the builder gives a percentage, store the fraction (`4%` is `0.04`). If a value does not hold, say `adjust.invalid` and ask again. Do not argue against a valid adjustment: the builder owns the thresholds.

## 4. Verdict date

Ask `verdict_date.question` as a plain message. Accept a date in another form only if it is unambiguous, and store it as `YYYY-MM-DD`. It must be after today; otherwise say `verdict_date.invalid` and ask again.

## 5. Write and seal

Write `.sbr/rules.md`. The header carries exactly these keys, in this order, and no `sealed` key:

```markdown
---
min_cold_visitors: 200
signup_rate_pass: 0.05
signup_rate_gray_min: 0.038
no_evidence_visitors: 300
calls_scheduled_pass: 3
cold_sources: [v1, v2, v3]
verdict_date: <YYYY-MM-DD>
---
```

The body is in the builder's language, built from `body`: the title; under `body.thresholds`, the same table shown in step 2 with the final values; under `body.verdict_date`, `body.verdict_date_detail`; under `body.credibility`, the lines of `body.credibility_rules` as a numbered list; under `body.not_measured`, `body.not_measured_detail`; under `body.seal`, `body.seal_detail`.

Then seal:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/seal.mjs" seal .
```

The script checks the header, adds `sealed: <date>`, commits `.sbr/rules.md` alone, writes `.sbr/seal.json` with `sealed_at` and the full SHA of that commit, and commits it alone. It answers `{"action": "sealed", "sealed_at": …, "commit": …}`. If it fails, nothing is sealed: fix what it reports and run it again.

Close with `sealed.title`, `sealed.detail` (the first seven characters of `commit`, and the verdict date) and `sealed.next`.

## Already sealed

1. Read `.sbr/seal.json` and `.sbr/rules.md`. Show the table of step 2 with the sealed values and the verdict date, and say `already_sealed.notice` (the `sealed` date and the first seven characters of `commit`).
2. Ask with AskUserQuestion, using `already_sealed.question` and the options of `already_sealed.options`, `keep` first.
3. `keep`: say `already_sealed.unchanged` and stop. Touch no file and run no command.
4. `change`: say `already_sealed.warning`. Ask `already_sealed.which`, then `already_sealed.reason`, one at a time. Apply the change to the header and to the table in the body of `.sbr/rules.md`, leaving `sealed` and every other value as they are, with the same checks as in steps 3 and 4. Then:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/seal.mjs" seal . --reason "<the builder's reason>"
   ```

   The script commits the change on its own and never rewrites `.sbr/seal.json`. It answers `{"action": "changed", "commit": <seal>, "change_commit": <new commit>}`: say `already_sealed.changed` with both, seven characters each. If it answers `{"action": "unchanged"}`, say `already_sealed.unchanged`.
