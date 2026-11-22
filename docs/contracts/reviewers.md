# Reviewers contract

Context-free agents of the plugin. Each one receives only what its row says, knows nothing else, and answers in a fixed format that its skill parses.

Edit this file only on `main`.

| Agent | File | Receives | Called by | Owner |
|---|---|---|---|---|
| `brief-reviewer` | `agents/brief-reviewer.md` | `.sbr/brief.md`, `.sbr/problem.md` and `.sbr/lean-canvas.md` | `interview` | Steps 3 and 3b |
| `script-reviewer` | `agents/script-reviewer.md` | `.sbr/video-scripts.md` | `video-scripts` | Step 5 |
| `verdict-reviewer` | `agents/verdict-reviewer.md` | Only the numbers and the thresholds of the verdict | `verdict` | Step 6 |
| `design-critic` | `agents/design-critic.md` | `.sbr/design/structure.md` and the two screenshots of one direction's free screen written by `design.mjs shots` | `design` | Design taste |

`design-reviewer` (`agents/design-reviewer.md`) is defined by step 1b and is not covered here.

## Answer format

```text
rejected
persona: <one sentence>
current_solution: <one sentence>
```

- First line: `approved` or `rejected`, alone.
- Then one line per finding: `<code>: <one sentence>`.
- A `rejected` answer has at least one finding, so the skill can tell the builder what is missing.
- `<code>` is one of the codes of that agent, below. No other code is allowed.

The skill writes `reviewer: approved` in the header of its file (`.sbr/brief.md`, `.sbr/video-scripts.md`, `.sbr/verdict.md`) only after an `approved` answer ([state.md](state.md)). After `rejected` the file stays `reviewer: pending`.

## Codes of `brief-reviewer`

The first five are the header key of the brief that falls short.

| Code | The reader cannot tell |
|---|---|
| `persona` | Who the user is |
| `pain` | What hurts |
| `current_solution` | What the user does today and what it costs |
| `promise` | What the product promises |
| `questions` | What the three questions for the visitor ask |

The other seven are about `.sbr/problem.md` and `.sbr/lean-canvas.md`.

| Code | Finding |
|---|---|
| `statement_names_solution` | The problem statement names or describes the product or a solution |
| `statement_too_long` | The problem statement does not fit in four lines |
| `statement_without_source` | The problem statement carries no figure backed by a third-party source, or carries a figure that no cited sentence gives |
| `claim_without_status` | A claim of a sources table, of the problem or of the canvas, has no status, or lacks the link or the exact sentence its status needs; or an advisor's proposal names no supported row |
| `quote_does_not_support` | The sentence quoted for a `supported` claim does not say what the claim says |
| `segment_not_single` | There is not exactly one segment chosen for this test, or the `persona` of the brief is not that segment |
| `pain_without_source` | A pain of the canvas or of the brief has no supported row in the sources table of the canvas, or carries a figure that no supported sentence gives |

## Codes of `script-reviewer`

| Code | Finding |
|---|---|
| `smp_not_one_sentence` | The single idea of a video (`smp`) does not fit in one sentence |
| `outside_smp` | A script says something outside the short list fixed for that video |
| `reveal_incomplete` | The reveal lacks one of its three pieces: the visual, the on-screen headline or the spoken line |
| `value_before_build_up` | The value appears before the build-up |
| `product_before_cta` | The product is named before the call to action |
| `claims_it_exists` | A script speaks as if the product already existed |
| `price` | A script mentions a price |
| `invented_figure` | A script uses a figure that nobody measured |

## Codes of `design-critic`

The skill writes the answer to `.sbr/sketches/<letter>/critique.txt`. A rejected direction is redone by its agent with the findings, at most twice; then it is shown with the findings still open.

| Code | Finding |
|---|---|
| `hierarchy` | The headline does not lead, the button is not next, or the lists read as loud as the headline |
| `message` | What `structure.md` says the visitor must understand is hidden or out of order |
| `first_view` | Headline, subtitle or button below the first view, or the first view ends on something cut in half |
| `edges` | Blocks do not share their edges |
| `centred` | Running text or lists centred, or a centred block wider than half the page |
| `space` | Space does not group, or a short block floats alone |
| `template` | A composition anyone would get |
| `decoration` | A drawing that is mood, not meaning |
| `accent` | The accent spread beyond the buttons, or color carrying the hierarchy |
| `type` | Tracked capitals, too many small levels, over-long lines, a single word alone on the headline's last line |
| `nesting` | Boxes in boxes, cards in cards |
| `broken` | Overlap, cut edges, tilt or touching elements |

## Codes of `verdict-reviewer`

| Code | Finding |
|---|---|
| `result_not_supported` | The numbers and the thresholds do not lead to the result given |
| `rate_without_count` | A rate appears without its raw count |
| `non_cold_counted` | Traffic that is not cold was counted toward the result |
| `test_counted` | A `test` visit was counted |
| `rules_changed_not_shown` | The rules changed after the seal and the verdict does not say so |
