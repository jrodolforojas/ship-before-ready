# Reviewers contract

Context-free agents of the plugin. Each one reads a single file, knows nothing else, and answers in a fixed format that its skill parses.

Edit this file only on `main`.

| Agent | File | Reads | Called by | Owner |
|---|---|---|---|---|
| `brief-reviewer` | `agents/brief-reviewer.md` | `.sbr/brief.md` | `interview` | Step 3 |
| `script-reviewer` | `agents/script-reviewer.md` | `.sbr/video-scripts.md` | `video-scripts` | Step 5 |

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

The skill writes `reviewer: approved` in the header of the reviewed file only after an `approved` answer ([state.md](state.md)). After `rejected` the file stays `reviewer: pending`.

## Codes of `brief-reviewer`

Each code is the header key of the brief that falls short.

| Code | The reader cannot tell |
|---|---|
| `persona` | Who the user is |
| `pain` | What hurts |
| `current_solution` | What the user does today and what it costs |
| `promise` | What the product promises |
| `questions` | What the three questions for the visitor ask |

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
