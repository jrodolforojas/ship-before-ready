# The advisor: options with a source, after "no sé"

How `interview` helps when the builder does not know what to put in a block of the Lean Canvas. The risk this procedure exists for: putting the skill's ideas in the builder's mouth. An option the builder chose among others, with its source in sight and marked as the advisor's, is help. A suggestion slipped into a question, or a block filled without asking, is bias.

Phrases are in `canvas.advisor.*` of the phrases file. Sources follow [sources.md](sources.md): only pages opened in this run, with the exact sentence.

## 1. When

Only after the builder said they do not know, or left the block pending and then accepted `canvas.advisor.offer_pending`. Never before the block's question was asked and answered, and never as a hint inside a question, a push or an acknowledgement.

| Block | The advisor |
|---|---|
| `alternatives`, the pains, `uvp`, `solution`, `channels`, `key_metrics`, `unfair_advantage` | Proposes |
| `problem`, `segments`, the chosen segment | Never: they are the builder's |
| `cost_structure`, `revenue_streams` | Never. No option of any block carries a price, a cost or a revenue figure either |

One block at a time. Say `canvas.advisor.researching` before the first search.

## 2. Research

**Search terms are general.** Build them from the category of the segment, the problem space and the kind of product, the way a stranger to this idea would name them. Never the product's name, never a sentence of the builder, never a person's name, never text copied from `.sbr/`. Write the terms down before searching and check each one against this rule.

| Block | What to learn |
|---|---|
| `alternatives` | What people of that segment category do today about this problem, and what each way costs them |
| The pains | What those people report that frustrates them about those ways: surveys, studies, reported complaints |
| `uvp` | What the existing approaches in this space promise, and what their users say they get or still miss |
| `solution` | The usual approach in this space, why it works or fails, and the mistakes it is known for |
| `channels` | Where that segment category already pays attention, and how products at this stage reach it |
| `key_metrics` | Which measures matter before launch, when the question is whether the demand exists |
| `unfair_advantage` | What is hard to copy or to buy in this space, and what the established players rely on |

Budget per block: three searches and four opened pages. Open a page, ask for the sentence, copy it exactly; a search result is a lead, never a source.

## 3. Form a criterion

Three layers, in this order:

1. **What is usual.** What everyone in that space already does or repeats. This comes from general knowledge and is a hypothesis, not a source.
2. **What the pages say now.** What the opened pages report, and whether they confirm or contradict layer 1.
3. **What this builder left written.** The approved statement, the rows of the sources tables with their status, the chosen segment, the alternatives and the supported pains. Look for a reason, in that evidence, why the usual way is wrong or weaker for this segment.

Then test each idea before it becomes an option:

- Write its premise in one sentence: what has to be true for it to work.
- Check the premise against layer 3. Evidence of the builder that contradicts it (a `contradicted` row, or a `supported` row that says the opposite) drops the idea. Evidence that backs it makes it stronger. Silence keeps it, with the premise stated.
- Ask whether the block would be better left pending than filled with it. If so, drop it.

When the usual way holds up, say so: do not manufacture a contrarian option. When the builder's evidence points away from it, say which row does.

## 4. Options

Two or three, never one and never four, and different in substance, not three wordings of one idea.

| Part | What it is |
|---|---|
| The proposal | Text that could go into the block as it is, in the block's own format, in plain words. No invented person, no figure that is not in the exact sentence of a `supported` row, no price |
| The reason | One or two lines with `canvas.advisor.reason`: which layer it comes from, and its premise with `canvas.advisor.premise` |
| The source | With `canvas.advisor.source`: the link and the exact sentence of a page opened in this run |

- Exactly one option is marked with `canvas.advisor.recommended`. Give the reason with `canvas.advisor.recommendation`, grounded in what the builder left written, not in taste.
- An idea without an opened page behind it is not an option. With fewer than two options left, say `canvas.advisor.nothing_found` and leave the block pending.
- For the pains, each option is one pain: what the page reports those people live, stated plainly. It needs a `supported` row like any pain, checked as [sources.md](sources.md), section 6, says. It is evidence about the segment, not the builder's voice.
- For `alternatives` and the pains the builder may keep several: ask with `canvas.advisor.choose_several`. For the other blocks, one: ask with `canvas.advisor.choose`.

Show, in one message: `canvas.advisor.options_intro`; a line with `canvas.advisor.conventional` and, when layer 3 has something to say, one with `canvas.advisor.builder_evidence`; the options, lettered; the recommendation; the question. **Stop and wait.**

## 5. Write what the builder decides

| The builder | Write |
|---|---|
| Keeps an option | Its text in the block, then the mark line: `canvas.advisor.mark`, a period, and `canvas.advisor.mark_sources` with the ids of its rows. One row `A1`, `A2`… per source in the table of `canvas.sources.title`, status `supported`, with type, link and exact sentence. The claim cell is the fact the page gives, not the proposal |
| Changes an option | Their version. The mark and the rows stay while anything of the proposal remains |
| Answers in their own words instead | Their answer, as any answer: no mark and no rows |
| Keeps a pain | The pain between double quotes under its alternative, followed by `canvas.advisor.pain_mark`. Its row is a `P` row whose claim cell ends with the same mark |
| Leaves it pending | `canvas.pending` in the block. Nothing of the options is written |

Rows of options the builder did not keep are not written. Then run the checks and fix what they report:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" check-canvas .sbr/lean-canvas.md
node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" verify-sources .sbr/lean-canvas.md advisor
```

Say `canvas.advisor.saved`.

The method (general search terms, three layers, premise before proposal) is adapted from the `/office-hours` skill of gstack (MIT, Garry Tan).
