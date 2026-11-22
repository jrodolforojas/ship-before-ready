---
name: interview
description: Lleva la idea del builder a un brief en tres pasos, una pregunta a la vez. Primero el problema, sin hablar de la solución, con diez preguntas y fuentes que la skill busca y cita; después el Lean Canvas; al final el brief, que solo queda aprobado si un revisor sin contexto lo aprueba. Escribe .sbr/problem.md, .sbr/lean-canvas.md y .sbr/brief.md.
argument-hint: "[locale]"
---

# interview

Take the builder from an idea to three files, in this order:

1. `.sbr/problem.md`: the problem module (ten questions in four components), the sources table of each component and the problem statement. It is the evidence that the problem is real and large.
2. `.sbr/lean-canvas.md`: the Lean Canvas. Its problem block is the statement.
3. `.sbr/brief.md`: the brief the other skills read. It comes from the canvas, in the words of the person who has the problem.

The files follow [the state contract](../../docs/contracts/state.md); the reviewer follows [the reviewers contract](../../docs/contracts/reviewers.md). The script is `${CLAUDE_SKILL_DIR}/scripts/brief.mjs`, written below as `brief.mjs`.

## Rules that hold for every step

- **One question at a time.** Ask it, stop, and wait for the answer. Never two questions in one message, never the next one before the builder answered. Questions are plain messages, not AskUserQuestion: the answers are open.
- **The problem comes first, without the solution.** Until the statement is approved, do not ask about the product and do not write it down. When an answer describes the product, an app or a feature, say `problem.solution_reminder`, keep the part that is about the problem and go on. Remember what they said for the canvas.
- **Never bias the builder.** No example of a solved idea, no sample answer and no hint of what a good answer looks like, in a question, a push or an acknowledgement. Formats are explained in the abstract: what goes in each field, never a filled-in idea. Never read, quote or show the files of `templates/example/`: they are test data of the plugin's own page.
- **"No sé" is a valid answer.** Say `problem.dont_know`, write it down as it is and research it when the component closes. Never push on it and never fill it with a guess.
- **Write only what the builder said or what a page you opened says.** Do not invent a person, a figure, a cost or a quote. A fact you found, and the builder did not say, is marked `sources.found_by_skill` until they confirm it.
- **Sources.** Cite only pages you opened in this run, with the exact sentence copied from the page. Never a search snippet, never a page from memory, never a figure that is in neither the builder's answers nor a copied sentence. The procedure is [sources.md](sources.md); read it before the first table.
- **Costs and revenue are the builder's alone.** Write them as said, without comment, advice or a suggested price. They live only in `.sbr/lean-canvas.md`: never in the brief, the statement or the questions for the visitor. No price, plan or payment appears in the brief.
- **Two lines are written only by the script:** `approved` in `.sbr/problem.md` (after the builder approves the statement in writing) and `reviewer: approved` in `.sbr/brief.md` (after the reviewer answers `approved`). Never write either yourself, and never review the brief in place of the agent.
- **Save as you go.** Write each answer to its file as soon as it is given, so the interview can be resumed.
- The project's language is the locale: `$ARGUMENTS` if it carries one (it matches `^[a-z]{2}(-[A-Z]{2})?$`), otherwise the `locale` of an existing file in `.sbr/`, otherwise `es`. Speak to the builder in that language; in Spanish, address them as "usted". Fixed phrases come from `${CLAUDE_PLUGIN_ROOT}/locales/<locale>/interview.json`, falling back to `${CLAUDE_PLUGIN_ROOT}/locales/es/interview.json`; read that file first. Keys are written below as `section.key`; replace `{placeholders}` with real values.
- The builder's repo is the current working directory.

## 1. Where the interview stands

```bash
node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" status
```

It prints `stage` and what each file already has. Start at the step of that stage and never ask again what is already answered.

| `stage` | Say | Go to |
|---|---|---|
| `welcome` | `welcome`, `rule` and `how`, in that order, then the opener in the same message. If an old `.sbr/brief.md` exists without `.sbr/problem.md`, keep it untouched until step 6 rewrites it | Step 2 |
| `problem` | `resume.in_progress` with `resume.where.problem` (`problem.component` and `problem.next_question`), or with `resume.where.sources` when `next_question` is `null` | Step 2 at that question, or step 3 |
| `statement` | `resume.in_progress` with `resume.where.statement` | Step 4 |
| `canvas` | `resume.in_progress` with `resume.where.canvas` | Step 5, at the first block of `canvas.missing` |
| `brief` | `resume.in_progress` with `resume.where.brief` | Step 6 |
| `review` | `resume.in_progress` with `resume.where.review` | Step 7 |
| `done` | `resume.approved`; add `resume.approved_without_problem` when `problem` is `null`. Continue only if the builder wants to redo it, from step 2 | Stop, or step 2 |

When resuming, read the files of `.sbr/` that exist before going on.

## 2. The problem module

**The opener.** Ask `problem.opener`. It is not one of the ten questions: it gives you the subject. If the answer describes a solution or names no group of people, say `problem.opener_push` once with `{vague}` replaced by their words, and take the second answer as it comes. Then create `.sbr/problem.md` with the layout below, the opener's answer under question 0 and `confirmed: []`.

**The ten questions.** Four components, in this order, each closed by its sources table (step 3) before the next one starts.

| Component | Id letter | Questions |
|---|---|---|
| `trigger` | `T` | 1, 2, 3 |
| `frequency` | `F` | 4, 5, 6 |
| `relevance` | `R` | 7, 8 |
| `viability` | `V` | 9, 10 |

- Open a component with its `problem.components.<component>.intro`, in the same message as its first question.
- Ask each question with its `problem.questions.<n>.ask`, word for word and alone. The `ask` is never reworded, shortened, explained, illustrated or merged with another. If the builder asks what a question means, explain the term in the abstract, without an example answer.
- After each answer, write it under its question in `.sbr/problem.md` in the builder's words, acknowledge it in one short line without praise and ask the next question. Do not judge whether an answer is good, do not ask for a source yet and do not push: the sources table is where an answer gets checked.
- If an answer already covered a later question of the same component, write it there too and confirm it in one line instead of asking it.
- Viability is about solving the problem in general (what would change, whether it can be done today, who did it elsewhere), not about the builder's product.

```markdown
---
locale: <locale>
confirmed: []
---

# <problem.title, with the subject in a few words and no product name>

**0. <problem.opener>**

<the opener's answer>

## <statement.title>

<statement.pending>

## <problem.components.trigger.title>

**1. <problem.questions.1.ask>**

<the answer, in the builder's words>

**2. <problem.questions.2.ask>**

<the answer>

**3. <problem.questions.3.ask>**

<the answer>

### <sources.table_title>

<the table of step 3>

## <problem.components.frequency.title>
```

Write a component's section when its first answer arrives. A question's line always starts with `**<n>. ` and its answer goes in the lines below it.

## 3. Sources, at the close of each component

Follow [sources.md](sources.md) step by step. In short:

1. Ask `sources.ask` and wait: the builder may have links.
2. Say `sources.searching`. List every claim of the component's answers, one fact per row, with ids `<letter>1`, `<letter>2`…
3. Open the builder's links first, then search. Give each claim its status, its source type, its link and the exact sentence.
4. Write the table under the component in `.sbr/problem.md`, then run both checks and fix what they report:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" check-problem .sbr/problem.md
   node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" verify-sources .sbr/problem.md <component>
   ```

5. Show the builder the table exactly as it is in the file, every row and every sentence whole, with `sources.table_intro`, the notes that apply (`sources.contradicted_note`, `sources.no_source_note`, `sources.unreachable_note`) and `sources.confirm`. **Stop and wait.**
6. Apply what they ask: a corrected claim is checked against its source again, a removed claim loses its row, a new link is opened like any other. Show the changed rows and ask again. A claim's wording never changes between what was shown and what is in the file.
7. Only when the builder confirms, add the component to `confirmed` in the header and start the next component. After `viability`, go to step 4.

## 4. The problem statement

Say `statement.intro`.

1. **Gate.** The statement needs at least one claim with status `supported` and a third-party source (`study`, `official_data`, `news` or `collaborative_index`). If no table has one, say `statement.blocked_no_source`, do not write a statement, and go on only when a search or the builder brings such a source through step 3. If none appears, stop here; the interview resumes at this step.
2. **Draft it.** One paragraph of three or four lines, at most 480 characters, that explains the problem concretely with facts and figures:
   - Every figure in it comes from a `supported` claim, with the same number and the same unit as its quoted sentence. Nothing from a `no_source`, `contradicted`, `other_context` or `own_experience` row.
   - At least one of those claims has a third-party source.
   - It never includes the solution: no product, app, platform, tool or feature, by name or by description, and no sentence that states the problem as the absence of such a thing.
3. Show it with `statement.show`, then `statement.based_on` with the ids and claims it uses, then `statement.confirm`. **Stop and wait.**
4. If the builder asks for a change, apply it and show it again. A change that brings in the solution is answered with `statement.names_solution` and rewritten without it. A change that brings in a new figure first needs its row and its source through step 3.
5. With the builder's written approval, write the statement in the header (`statement`, on one line, between double quotes, with any double quote inside replaced by a single one), the ids it uses (`statement_claims: [T1, R2]`) and the same text under the statement's heading in the body, in place of `statement.pending`. Then:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" approve-statement .sbr/problem.md
   ```

   It checks the file, opens every cited page again, and writes `approved` and `statement_fingerprint`. If it exits with code 1, fix what it lists (a quote that is not on its page is corrected with [sources.md](sources.md)), show the builder anything that changed in the statement, and run it again. It lists as `unreachable` the pages it could not open: tell the builder with `sources.unreachable_note`.
6. Say `statement.approved`.

Whenever the statement changes later, the builder approves it again and you run `approve-statement` again.

## 5. Lean Canvas

Say `canvas.intro`. One block at a time, in this order; write `.sbr/lean-canvas.md` after each answer and run `check-canvas` once the four required blocks are in.

| # | Block | Asked with | Kind | The answer is not enough when |
|---|---|---|---|---|
| 1 | `problem` | Not asked: it is the approved statement, followed by `canvas.problem_sources` | Required | |
| 2 | `segments` | `canvas.questions.segments.ask` | Required | It names a broad category of people or organizations, with no person, situation or moment behind it |
| 3 | The chosen segment | `canvas.questions.chosen_segment.ask` | Required | It names more than one, or none. If the builder listed a single segment, that one is chosen: confirm it in one line and do not ask |
| 4 | `alternatives` | `canvas.questions.alternatives.ask`, with `{segment}` | Required | An alternative has no concrete action, no cost (time, money, mistakes, a consequence), or there is no frustration in words the person would say |
| 5 | `uvp` | `canvas.questions.uvp.ask` | Required | It is a list of features, or marketing words the person would never say |
| 6 | `solution` | `canvas.questions.solution.ask` | Required | Nothing the person could picture using |
| 7 | `channels` | `canvas.questions.channels.ask` | Invited | Never |
| 8 | `key_metrics` | `canvas.questions.key_metrics.ask` | Invited | Never |
| 9 | `unfair_advantage` | `canvas.questions.unfair_advantage.ask` | Invited | Never |
| 10 | `cost_structure`, `revenue_streams` | `canvas.questions.builder_only.ask` | The builder's alone | Never |

- **Required blocks: push once, and only once.** When an answer is not enough, say the `push` phrase of that question (`{vague}` is the builder's own words, `{missing}` is what is missing) and take the second answer as it comes: the reviewer decides, not you. For `alternatives`, say `push_nothing` instead only when the builder says the person does nothing today.
- **Invited blocks never block.** Ask once. With "no sé", "después" or no answer, say `canvas.invited_pending` and write `canvas.pending` in the section.
- **Costs and revenue.** One question for both. If the builder gives them, write each under its section exactly as said and answer only `canvas.builder_only_saved`: no opinion, no question back, no number of your own. If not, leave both sections out.
- What the builder said about the solution during the problem module is a start, not the answer: say in one line what you noted and still ask `canvas.questions.solution.ask`, so they say what it is and what it does in their own words.
- Frustrations are written between double quotes, as the person would say them. If the builder gave them in their own voice, keep their words; do not polish them into copy.

```markdown
---
locale: <locale>
chosen_segment: "<the name of the one segment chosen for this test>"
---

# <canvas.title>

## <canvas.sections.problem>

<the approved statement>

<canvas.problem_sources>

## <canvas.sections.segments>

- **<segment name>** <canvas.chosen_mark>: <who they are, their situation, what they look for>
- **<segment name>**: <the same>

## <canvas.sections.alternatives>

- **<alternative>**: <what the person does and what it costs>
  - "<a frustration, in the person's words>"

## <canvas.sections.uvp>

<one sentence the person would repeat>

## <canvas.sections.solution>

<what it is, and up to three things it does>

## <canvas.sections.channels>

## <canvas.sections.key_metrics>

## <canvas.sections.unfair_advantage>

## <canvas.sections.cost_structure>

## <canvas.sections.revenue_streams>
```

The headings are exactly the phrases of `canvas.sections`. `chosen_segment` equals the bold name of one, and only one, item of the segments list. Then:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" check-canvas .sbr/lean-canvas.md
```

Say `canvas.written`.

## 6. Write the brief

Nothing is asked here: the brief is taken from the canvas. Write `.sbr/brief.md` with the header of the contract, always with `reviewer: pending`:

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

| Key | Comes from | Never from |
|---|---|---|
| `persona` | The chosen segment: who they are and their situation | The other segments |
| `pain` | The sharpest frustration of the alternatives block, in the person's words | The problem statement: a country-size figure is evidence, not what the person feels |
| `current_solution` | The alternatives of the chosen segment, with what they cost | |
| `promise` | The unique value proposition | The solution's feature list |
| `questions` | Written by you for this idea, addressed to the visitor: what they use today, when it last happened and what it cost them, and an invitation to a 15-minute call this week. At most 120 characters each | |

- Every value is one line, in the builder's language, inside double quotes. Replace a double quote inside a value with a single one.
- The body is in the builder's language: a title (`brief.title`, with the product's name or, if it has none, the idea in a few words) and one section per key of `brief.sections`, in that order. `problem` carries the approved statement, unchanged, followed by `brief.problem_sources`. `pain` lists the frustrations between quotes. `receives` lists up to three things from the solution block. Under `limits` write the lines of `brief.limits`.
- Nothing from channels, key metrics, unfair advantage, costs or revenue goes into the brief.

Then check the file, which also checks the other two, and fix what it reports:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" check .sbr/brief.md
```

Say `brief.written`.

## 7. Review

A round is one answer of the reviewer. There are at most three rounds.

1. Call the agent `ship-before-ready:brief-reviewer` with the Agent tool (named `Task` in some versions). Its prompt is only the three absolute paths, for example `Review the brief at /path/to/repo/.sbr/brief.md, with /path/to/repo/.sbr/problem.md and /path/to/repo/.sbr/lean-canvas.md`. Give it nothing else: no summary of the idea, no answers of the builder, no hint of what you expect.
2. Pass the agent's answer, exactly as it came, to the script:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" record-review .sbr/brief.md <<'REVIEW'
   <the agent's answer, verbatim>
   REVIEW
   ```

   The script checks the format of the contract and prints `{"result": …, "findings": […], "reviewer": …}`. With `approved` it writes `reviewer: approved`; with `rejected` it leaves `reviewer: pending`. If it exits with code 2 the answer did not follow the format: call the agent again once, with the same prompt, and do not count that as a round. If the format fails twice in a row, stop and show the builder the agent's answer.
3. `approved`: go to step 8.
4. `rejected`, in round one or two: say `review.rejected`, then one line per finding with its `review.fields.<code>` and the reviewer's sentence. Fix each finding as the table says, without pushing again; when a fix needs an answer from the builder, say `review.ask_again` and ask one thing at a time. Then rewrite what changed, run the checks, leave the brief with `reviewer: pending`, and start the next round.
5. `rejected` in round three: stop. Say `review.stopped`, list the findings the same way, and close with `review.stopped_next`. The brief stays `reviewer: pending`. Do not offer to approve it another way.

| Finding | How it is fixed |
|---|---|
| `persona`, `segment_not_single` | Ask `canvas.questions.segments.ask` or `canvas.questions.chosen_segment.ask` again, update the canvas, then the brief |
| `pain`, `current_solution` | Ask `canvas.questions.alternatives.ask` again, update the canvas, then the brief |
| `promise` | Ask `canvas.questions.uvp.ask` again, update the canvas, then the brief |
| `questions` | Rewrite them yourself, without asking |
| `statement_names_solution`, `statement_too_long` | Rewrite the statement as in step 4, show it, and with the builder's written approval run `approve-statement` again. Copy the new statement to the canvas and the brief |
| `statement_without_source` | Look for a third-party source for a figure of the statement as in step 3. If there is none, the statement changes to figures that have one, and is approved again |
| `claim_without_status`, `quote_does_not_support` | Open the page of each row named, copy the sentence that says it or change the row's status, show the builder the rows that changed, and approve the statement again if it used one of them |

## 8. Close

Say `done.title`, `done.detail` and `done.files`, show the four lines of the header (`persona`, `pain`, `current_solution`, `promise`), and close with `done.next`. Do not commit; the builder decides when.

The ten questions of the problem module, the list of accepted sources and the rule of the statement are the plugin author's. The Lean Canvas is Ash Maurya's adaptation of the Business Model Canvas. The pushes of the canvas questions are adapted from the `/office-hours` skill of gstack (MIT, Garry Tan).
