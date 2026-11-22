# Sources: from an answer to a row with its evidence

How `interview` closes a component of the problem module. The risk this procedure exists for: citing a page that does not say what the claim says. A row that says `sin fuente` is honest; a row that says `respaldada` over a page that says something else is the one failure this skill cannot afford.

Phrases are in `sources.*` of the phrases file. The script is `${CLAUDE_SKILL_DIR}/scripts/brief.mjs`.

## 1. List the claims

Read the component's answers and write one row per fact that could be true or false: a figure, a ranking, a frequency, a cost, how many people, a cause.

- One fact per row. A sentence that carries a ranking and a duration is two rows.
- Keep the builder's figure and unit exactly as given. Do not round, convert or improve it.
- Every fact gets a row, also the ones that will end as `sin fuente`. A row is never dropped because nothing was found.
- An answer of "no sé" has no claim yet: research the question itself. What you find becomes a row whose claim ends with `sources.found_by_skill`.
- Something the builder lived or saw, with no data behind it, is a row with status `own_experience`. It is not searched, unless it carries a fact that can be checked.
- Ids are the component's letter and a number, in order: `T1`, `T2`… for `trigger`, `F` for `frequency`, `R` for `relevance`, `V` for `viability`.

## 2. Open pages

Budget per claim: the builder's own links first; then at most two searches and three opened pages. One page often covers several claims: reuse it. When the budget runs out, the row is `no_source`.

1. **The builder's links.** Open each one. A link that does not open, or does not say it, does not count.
2. **Search** with WebSearch, in the language and the country of the claim first, then in English. Prefer, in this order: the study or the official dataset itself, the institution that published it, a news article that reports it. A search result is a lead, never a source.
3. **Open** a candidate with WebFetch. Ask for the sentence, not a summary: "Quote word for word, in the page's own language, every sentence that mentions <the fact>. If none does, say so." If WebFetch is missing or fails, use the script, which prints the page's own sentences that carry the words:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" excerpt "<url>" <a figure or two or three words of the fact>
   ```

4. **Copy the exact sentence** that carries the fact: one or two sentences, at most 300 characters, in the page's language, not translated and not trimmed in the middle. WebFetch may reword; when in doubt, take the sentence from `excerpt`.

## 3. Give each row its status and its type

| Status | Phrase | When |
|---|---|---|
| `supported` | `sources.statuses.supported` | An opened page says the same thing: the same figure, about the same place and the same thing measured |
| `contradicted` | `sources.statuses.contradicted` | An opened page gives a different figure or says the opposite. The quote is the sentence that contradicts it |
| `other_context` | `sources.statuses.other_context` | An opened page says it, but about another country, another population, another product, or a year too old to stand for today |
| `no_source` | `sources.statuses.no_source` | Nothing was found within the budget, or the pages that might say it could not be opened |
| `own_experience` | `sources.statuses.own_experience` | The builder's own observation or perception |

| Type | Phrase | What it is |
|---|---|---|
| `study` | `sources.types.study` | A paper, a research report, a survey with its method |
| `official_data` | `sources.types.official_data` | A government, a statistics office, a regulator, a multilateral body |
| `news` | `sources.types.news` | A media article. An article that reports a study is `news` unless you opened the study itself |
| `collaborative_index` | `sources.types.collaborative_index` | Figures or text contributed by its own users, with no editorial review |
| `own_research` | `sources.types.own_research` | Research the builder ran: a survey, interviews with counts, their own data. Not an observation or a perception |

- Be strict with `supported`. A page about the same subject with another figure is `contradicted`; the same figure about another country is `other_context`; a figure given as a maximum does not support the same figure given as an average. When in doubt, it is not `supported`.
- The builder's own research is `supported` with type `own_research`: the source cell says where it lives (a link or a document's name) and the quote is the result as the builder gave it. It does not count as a third-party source for the statement.
- A `contradicted` row stays in the table. The builder decides whether to correct the claim to what the source says, which makes it `supported`, or to keep it, marked.

## 4. Write the table

Under the component, after its answers:

```markdown
### <sources.table_title>

| # | Afirmación | Estado | Tipo de fuente | Fuente | Frase exacta |
|---|---|---|---|---|---|
| T1 | <the claim> | <status phrase> | <type phrase> | [<site>](<url>) | "<the exact sentence>" |
| T2 | <the claim> | <sources.statuses.no_source> | — | — | — |
```

- The header row is `sources.columns`; the six columns always go in this order.
- Status and type are written with their phrases of the locale, exactly.
- `supported`, `contradicted` and `other_context` rows carry type, link and sentence. `no_source` and `own_experience` rows carry `sources.no_type` in those three cells.
- A `|` inside a cell is written `\|`. A cell is one line.
- A note under the table follows the same rule as a row: it never repeats what a search result said about a page you could not open.

## 5. Check before showing

```bash
node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" check-problem .sbr/problem.md
node "${CLAUDE_SKILL_DIR}/scripts/brief.mjs" verify-sources .sbr/problem.md <component>
```

`verify-sources` opens every cited page again and looks for the quoted sentence in it, ignoring spacing and punctuation.

| Result | What it means | What to do |
|---|---|---|
| `found` | The sentence is on the page | Nothing |
| `not_found` | The page opened and does not carry that sentence | Run `excerpt` on that link, copy the sentence as the page has it and run the check again. If the page does not say it, the row becomes `no_source`, or gets another source within the budget. A row never stays `not_found` |
| `unreachable` | Neither fetch nor curl could open the page (a block, a PDF, a timeout) | Keep the row only if you did open that page yourself in this run. List the link in `sources.unreachable_note` so the builder opens it |

Then show the builder the table as it is in the file, without shortening a sentence, and wait for their confirmation, as step 3 of the skill says.
