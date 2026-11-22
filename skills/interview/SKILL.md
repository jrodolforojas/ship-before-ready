---
name: interview
description: Da la bienvenida y hace cuatro preguntas, una a la vez y empezando por el problema, para convertir la idea del builder en un brief. Insiste una vez cuando la respuesta es vaga, escribe .sbr/brief.md y lo pasa por un revisor sin contexto; el brief solo queda aprobado si ese revisor lo aprueba.
argument-hint: "[locale]"
---

# interview

Turn the builder's idea into `.sbr/brief.md`, a brief that a stranger can read and say who the user is, what hurts and what they do today. The file follows [the state contract](../../docs/contracts/state.md); the reviewer follows [the reviewers contract](../../docs/contracts/reviewers.md).

## Rules that hold for every step

- **One question at a time.** Ask it, stop, and wait for the answer. Never put two questions in one message and never ask the next one before the builder answered.
- **Push once, and only once.** When an answer is vague, say why and ask again with the `push` phrase. Take the second answer as it comes, even if it is still vague: the reviewer decides, not you.
- **Write only what the builder said.** Do not invent a person, a figure, a cost or a quote. If something is missing, it stays missing and the reviewer will say so.
- **No prices.** No price, plan or payment appears in the brief or in the questions for the visitor.
- **`reviewer: approved` is written only by the script, after the reviewer answers `approved`.** Never edit that line yourself, never write a brief with `reviewer: approved`, and never review the brief yourself in place of the agent.
- The project's language is the locale: `$ARGUMENTS` if it carries one (it matches `^[a-z]{2}(-[A-Z]{2})?$`), otherwise the `locale` of an existing brief, otherwise `es`. Speak to the builder in that language; in Spanish, address them as "usted". Fixed phrases come from `${CLAUDE_PLUGIN_ROOT}/locales/<locale>/interview.json`, falling back to `${CLAUDE_PLUGIN_ROOT}/locales/es/interview.json`; read that file first. Keys are written below as `section.key`.
- The builder's repo is the current working directory.

## 1. Before asking

Always open with `welcome`, on its own, before anything else. Then:

- If `.sbr/brief.md` exists with `reviewer: approved`, say `resume.approved` and continue only if the builder wants to redo it.
- If it exists with `reviewer: pending`, say `resume.pending`, keep the answers it already has, and ask only what is missing or what the last review rejected.
- Otherwise say `intro` and ask the first question in the same message.

## 2. The four questions

Ask them in this order, as plain messages (not AskUserQuestion: the answers are open).

| # | Phrase | It is about | The answer is vague when |
|---|---|---|---|
| 1 | `questions.pain.ask` | The problem or pain, before any idea or product | It describes a product, an app or a feature instead of a problem, or it names no group of people who have it |
| 2 | `questions.persona.ask` | Who exactly has the problem: a real person or a real case | It names a category ("usuarios", "empresas", "pymes", "emprendedores", "equipos de marketing", "todo el mundo") with no person, role in a situation or case behind it |
| 3 | `questions.current_solution.ask` | What that person does today to solve it, and what it costs them | It gives no concrete action, or no cost (time, money, mistakes, a consequence), or it says they do nothing |
| 4 | `questions.promise.ask` | What changes for that person, in one sentence they would repeat | It is a list of features, or brochure words ("más fácil", "optimiza", "solución integral", "potencia") that the person would never say |

After each answer:

1. If it is specific, acknowledge it in one short line without praise and ask the next question.
2. If it is vague, say the `push` phrase of that question, with `{vague}` replaced by the builder's own vague words. Wait for the second answer and move on, whatever it says.

If the builder already answered a later question while answering an earlier one, do not ask it again; confirm it in one line.

## 3. Write the brief

Write `.sbr/brief.md` with the header of the contract, always with `reviewer: pending`:

```markdown
---
reviewer: pending
locale: <locale>
persona: "<who the user is, one line>"
pain: "<what hurts, one line>"
current_solution: "<what they do today and what it costs, one line>"
promise: "<what the product promises, one line>"
questions:
  current_solution: "<question about what the visitor uses today>"
  last_time: "<question about the last time it happened and what it cost>"
  wants_call: "<invitation to a 15-minute call this week>"
---
```

- Every value is one line, in the builder's language, inside double quotes. Replace a double quote inside a value with a single one.
- `pain`, `persona`, `current_solution` and `promise` come from the four answers, in the builder's words. Do not add anything they did not say.
- `questions` are the three questions the landing will ask a visitor, written for this idea and addressed to the visitor: what they use today, when it last happened and what it cost them, and an invitation to a 15-minute call this week. Each one is at most 120 characters.
- The body is in the builder's language: a title (`brief.title`, with the product's name or, if it has none, the idea in a few words) and one section per key of `brief.sections`, in that order. Under `limits` write the lines of `brief.limits`. The body may give the detail that does not fit in one line, and nothing the builder did not say.

Then check the file and fix what it reports:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" check .sbr/brief.md
```

Say `brief.written`.

## 4. Review

A round is one answer of the reviewer. There are at most three rounds.

1. Call the agent `ship-before-ready:brief-reviewer` with the Agent tool (named `Task` in some versions). Its prompt is only the absolute path of the brief, for example `Review the brief at /path/to/repo/.sbr/brief.md`. Give it nothing else: no summary of the idea, no answers of the builder, no hint of what you expect.
2. Pass the agent's answer, exactly as it came, to the script:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" record-review .sbr/brief.md <<'REVIEW'
   <the agent's answer, verbatim>
   REVIEW
   ```

   The script checks the format of the contract and prints `{"result": …, "findings": […], "reviewer": …}`. With `approved` it writes `reviewer: approved`; with `rejected` it leaves `reviewer: pending`. If it exits with code 2 the answer did not follow the format: call the agent again once, with the same prompt, and do not count that as a round. If the format fails twice in a row, stop and show the builder the agent's answer.
3. `approved`: go to step 5.
4. `rejected`, in round one or two: say `review.rejected`, then one line per finding with its `review.fields.<code>` and the reviewer's sentence. Say `review.ask_again` and ask about each rejected point, one at a time, with the question of step 2 that covers it (`questions` is yours to rewrite without asking). Do not push again here. Rewrite the brief as in step 3, with `reviewer: pending`, and start the next round.
5. `rejected` in round three: stop. Say `review.stopped`, list the findings the same way, and close with `review.stopped_next`. The brief stays `reviewer: pending`. Do not offer to approve it another way.

## 5. Close

Say `done.title` and `done.detail`, show the four lines of the header (`persona`, `pain`, `current_solution`, `promise`), and close with `done.next`. Do not commit; the builder decides when.

The wording of the persona, current solution and promise questions and of the pushes is adapted from the `/office-hours` skill of gstack (MIT, Garry Tan).
