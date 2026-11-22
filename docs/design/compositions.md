# Canvas artboards

How the canvas of `design` is drawn. Screen 1, the promise, has no composition of its own any more: each direction designs it freely as two boards ([the free screen guide](../../guides/promise-screen.md)), which the plugin wraps in artboards. Screens 2 to 4 are fixed: they were approved once and their artboard templates are filled with each direction's values. This document specifies those fixed screens and the artboard files; it is what step 1c programmed in Astro and what `design` and `landing` draw and compare.

- Approved canvas of the fixed screens: <https://claude.ai/artifact/3dB8aRxXWdVFvwm8g7qq2G> ("Ship Before Ready · Composiciones"). Approved by Rodolfo Rojas on 2026-11-21, with the neutral design and the example copy. Its screen 1 compositions were retired by step 4d.
- Source of every measure below: the artboard templates in [`templates/canvas/`](../../templates/canvas/). Each element there names its tokens in its inline style (`var(--spacing-block)`) and carries its `data-sbr` hook. When this document and a template disagree, the template is what was approved.

Tokens, hooks and text styles come from [tokens.md](../contracts/tokens.md) and [landing.md](../contracts/landing.md). This document only adds layout.

## How to read it

| Written here | Token | Neutral value |
|---|---|---|
| `section` | `--spacing-section` | 96 px |
| `block` | `--spacing-block` | 48 px |
| `group` | `--spacing-group` | 24 px |
| `item` | `--spacing-item` | 8 px |
| `line` | A `--line-width` border in `--color-line` | 1 px |

Screens 2 to 4 were drawn and approved on a phone, at 390 px. Text sizes switch at 768 px, as the tokens contract says.

## Screens 2, 3 and 4

Fixed for every direction. Approved on a phone (390) only.

| Screen | Spec |
|---|---|
| All | `group` on each side. No footer. Titles are `h2` in `heading` |
| Field | Minimum height `block`; padding `item` on the block axis and `group` on the inline axis; `bg-surface`, a `line` border, `rounded-control`; text in `body` and `ink`, placeholder in `ink-muted`. An invalid field changes its border to `danger`. A textarea is three rows tall |
| Label | Above its field, `item` between them, in `label` style and `ink-muted` |
| 2 · Email, progress | One row, `group` above: the brand at the left and the step text (`small`, `ink-muted`) at the right, on the same baseline |
| 2 · Email, body | `block` above and below, `group` between its parts: the title; the label and field; under the field, `item` apart each, the error (`small`, `danger`, only when shown) and the privacy line (`small`, `ink-muted`); then the button as wide as the content |
| 3 · Questions, progress | The same row, then `item`, then the saved note (`small`, `ink-muted`) |
| 3 · Questions, body | `block` above and below, `group` between its parts: the title; the two questions; a row at least `block` tall with the checkbox (`group` × `group`, `accent-accent`), `item` and its label; the call group with its two fields, `group` between them; the error (only when shown) with `item` under it; the button as wide as the content |
| 4 · Done | `section` above, `block` below, `group` between its parts: the title; the notice inside a card, in `body` and `ink`; the next step in `body` |

## Not drawn, so not approved

- Screens 2, 3 and 4 on desktop. Programmed as the same column, centered, between 300 and 500 px wide (R20).
- Hover, active, focus and sending states, and the debug panel.

## Artboard files

`scripts/fill-artboards.mjs <tokens.json> <copy.json> <promise-phone.html> <promise-desktop.html> <output>` draws one direction and writes a folder ready to publish to a Claude Design canvas:

```
<output>/project/canvas.json              index: frames, order, title note
<output>/project/Main.dc.html             screen 1, phone: the free board, wrapped
<output>/project/Promise-desktop.dc.html  screen 1, desktop: the free board, wrapped
<output>/project/Email-phone.dc.html      screen 2
<output>/project/Questions-phone.dc.html  screen 3, with the call group open
<output>/project/Done-phone.dc.html       screen 4
```

It prints the written paths, exits with 0, and with 2 when the arguments are wrong, a file is missing a key of the contract or a board does not start with `<section data-sbr="screen-promise">`. It does not check requirements: run `verify-design.mjs` first, with the two boards. File names never change, so filling again and publishing the same folder repaints the canvas in place. `design.mjs canvas` uses the same functions to draw three directions side by side (screen 1 only) and to measure each free board in Chrome, so the frame is exactly as tall as the board.

| File in `templates/canvas/` | What it is |
|---|---|
| `promise.dc.html` | The artboard around a free board: fonts, the 50 variables, the page background and the body text style |
| `email-phone.dc.html`, `questions-phone.dc.html`, `done-phone.dc.html` | Screens 2 to 4 |
| `partials/tokens.css` | The 50 variables, one hole per token: `--color-canvas:[[color.canvas]]` |
| `frames.mjs` | The height of every fixed frame, estimated from the same spacing as its template, and the fallback height of a free board when there is no Chrome to measure it |
| `fixtures/contrast-tokens.json` | A valid design opposite to the neutral one: dark, serif and monospace, square corners |

Holes use `[[ ]]` so they never collide with the `{{ }}` of Claude Design:

| Hole | Filled with |
|---|---|
| `[[color.canvas]]`, `[[text.title.size]]`, `[[spacing.block]]`… | The path in `tokens.json`, written as the CSS value the tokens contract fixes. `size` becomes `size_desktop` in a desktop artboard |
| `[[copy.email.label]]`… | The key in the copy file, escaped |
| `[[progress.email]]`, `[[progress.questions]]` | `progress` with its placeholders filled |
| `[[board]]` | The free board, as written |
| `[[name]]`, `[[lang]]`, `[[scheme]]`, `[[fonts.href]]`, `[[frame.width]]`, `[[frame.height]]`, `[[pains.count]]` | Values of the direction and of the frame |
| `[[#each list]]…[[/each]]`, `[[#if flag]]`, `[[#unless flag]]` | Blocks; inside `each`: `[[this]]`, `[[index]]`, `[[index2]]`, `[[first]]` |
| `[[> tokens.css]]` | A partial; the rest of the tag reaches it as `[[slot]]` |

Every file on a canvas needs a different name, and a file left on the canvas keeps showing: remove it with `"project/<file>": null` when a direction goes away.

### Limits of the canvas format

Read from the runtime of the Design type (contract 0.2.47) on 2026-11-21.

- A frame clips at its height and has no automatic height. Free boards are measured in headless Chrome before publishing; fixed screens and, without Chrome, free boards are estimated on the tall side.
- The instructions of the Design type ask not to render or open a canvas to check it unless the builder asks. Measuring a board's own file in a local browser is not opening the canvas.
- Fonts load only from Google Fonts, through one `css2` link inside `<helmet>`, and only the families listed in `artifact-type/reference/google-fonts-families.json` of the canvas (1773 on that date).
- `<helmet>` is copied to the head of the artboard's own document, so variables set there do not leak between artboards.
- An inline style is split at every `;`: a value cannot contain one.
- `<form>` is avoided in the templates; the hooks `email-form` and `questions-form` are on a `div`.
- The first artboard is `Main.dc.html`. Without it the canvas takes the first file in alphabetical order as its entry.
- Edits made by hand on the canvas stay in the canvas. Filling again overwrites them.
