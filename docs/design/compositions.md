# Compositions

What was approved for the three compositions of the landing (`centered`, `split`, `editorial`), per screen size, written in tokens. It is the specification for whoever programs them in Astro (step 1c) and for the skill that draws them (`design`, step 4a).

- Approved canvas: <https://claude.ai/artifact/3dB8aRxXWdVFvwm8g7qq2G> ("Ship Before Ready · Composiciones"). Approved by Rodolfo Rojas on 2026-11-21, with the neutral design and the example copy.
- Test canvas, drawn by the script: <https://claude.ai/artifact/Bn3B9ZWFyuTnNQMYsf4EdC> ("Ship Before Ready · Prueba de plantillas"). Row 1 repeats the approved canvas; row 2 is the same artboards with `templates/canvas/fixtures/contrast-tokens.json`.
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
| prose | `--container-prose` | 62ch |
| page | `--container-page` | 1120 px |

- Two sizes were drawn and approved: phone at 390 px and desktop at 1440 px. Text sizes switch at 768 px, as the tokens contract says.
- Nothing between 390 and 1440 was drawn. Recommended, and for step 1c to confirm with captures: phone structure below 768 px, desktop structure from 768 px, and for `split` keep the stacked structure until 1024 px.
- "Band" is one block of screen 1: hero, figure, pains, steps, closing, footer. Order never changes.

## Shared by the three compositions

| Piece | Spec |
|---|---|
| Page | Background `canvas`, text `ink`, font `body` |
| Width, phone | Full width with `group` on each side (342 px of content at 390) |
| Width, desktop | A container of `max-w-page`, centered, with `block` on each side (1024 px of content) |
| Brand | Text style `button` in `ink` |
| Hero text | Title, then `item`, then subtitle; then `group`, then the button. The title is balanced (`text-balance`) |
| Button | Minimum height `block`; padding `item` on the block axis and `group` on the inline axis; `bg-accent`, `text-on-accent`, `rounded-control`, no border; text style `button`. Its label may wrap |
| Card | `bg-surface`, a `line` border, `rounded-card`, `shadow-card`, padding `group` |
| Hairline | One `line` border |
| Lists | `ul` and `ol` without markers or indentation |
| Footer | A hairline above, then `group`, the author, `item`, the privacy line, and `block` under it. Both in `small` and `ink-muted` |
| Closing | The closing line in `heading`, then `group`, then the same button as the hero |

The step numbers are not copy: they are the position of each `li` (1 to 3).

## `centered`

Everything sits on the central axis. Pains are equal cards, steps carry their number in a circle, the closing lives inside a panel.

| Band | Phone (390) | Desktop (1440) |
|---|---|---|
| Brand | Centered. `group` above | Centered. `group` above |
| Hero | Centered text. `block` above and below. Button as wide as the content | Centered text. `section` above and below. The title uses the whole container, the subtitle at most prose, the button the width of its label |
| Figure | A band of its own under the hero: as wide as the content, 16:9, `block` under it | A band of its own under the hero: half the container, centered, 16:9, `section` under it |
| Pains | One card per pain, stacked, `group` between cards. `block` under the band | One row with as many equal columns as there are pains (1 to 3), `group` between them. `section` under the band |
| Steps | One row per step: a circle (`block` × `block`, `line` border, the number in `button` style and `ink`), `group`, the text. Circle and text centered on each other. `group` between rows. `block` under the band | Three equal columns, `group` between them. In each: the circle, `group`, the text, aligned left. `section` under the band |
| Closing | A card with `block` above and below and `group` at the sides, centered text, button as wide as the card allows. `block` under it | A card as wide as the container with `section` on its four sides, centered text, button the width of its label. `section` under it |
| Footer | Centered | Centered |

## `split`

Two sides. On desktop the promise is on the left and the figure with the pains on the right; steps, closing and footer keep the same two columns. On a phone everything stacks, aligned left.

Desktop columns are 7/12 and 5/12 of the container with `block` between them (569 and 407 px with the neutral design).

| Band | Phone (390) | Desktop (1440) |
|---|---|---|
| Brand | Left. `group` above | Left. `group` above |
| Hero | `block` above and below. Button as wide as the content | `section` above and below. Two columns centered on each other. Left: title, subtitle (at most prose) and the button at the width of its label |
| Figure | Inside the hero, `block` under the button: as wide as the content, 16:9 | At the top of the right column: as wide as the column, 16:9, then `group` |
| Pains | One card with one row per pain: `group` of padding in each row and a hairline between rows. `block` under it | The same card, in the right column of the hero, under the figure. Without a figure the card stays there alone |
| Steps | Stacked, `group` between them. Each one: a hairline, `group`, its number as `01` to `03` in `label` style and `ink-muted`, `item`, the text. `block` under the band | Three equal columns with `block` between them, each built the same way. `section` under the band |
| Closing | The closing line, `group`, the button as wide as the content. `block` under it | The closing line in the left column and the button, at the width of its label, at the start of the right column; centered on each other. `section` under it |
| Footer | Left, stacked | The author in the left column and the privacy line in the right one |

## `editorial`

One narrow column at the left edge, no cards: type and hairlines only, with twice the air of the other two.

| Band | Phone (390) | Desktop (1440) |
|---|---|---|
| Column | The content width | Text never exceeds prose measured at `body` size; it starts at the left edge of the container. Hairlines span the whole container |
| Brand | Left. `group` above and below, then a hairline | The same |
| Hero | `block` above and below. Button at the width of its label, aligned left | `section` above and below. Button at the width of its label |
| Figure | Inside the hero, `block` under the button: as wide as the content, 16:9 | At the right end of the hero, aligned with the top of the title: a quarter of the container, 16:9 |
| Pains | A hairline, `block`, then one paragraph per pain in `body` with `group` between them, then `block` | A hairline, `section`, the same paragraphs, `section` |
| Steps | A hairline, `block`, one row per step, `block`. In each row: the number in `heading` style (display font, `ink`) in a column `block` wide, `group`, the text; both aligned to the top. `group` between rows | The same with `section` instead of `block` around the band |
| Closing | A hairline, `block`, the closing line, `group`, the button, `block` | The same with `section` |
| Footer | Left | Left, inside the column |

Between the content of two bands there are 2 × `block` on a phone and 2 × `section` on desktop, with the hairline in the middle. In `centered` and `split` there is one `block` and one `section`.

## Figure

Drawn only when `decor` is not `none`. Always a 16:9 box; each composition gives it its place and width (tables above). Text is never over it.

| `decor` | `decor-1` | `decor-2` |
|---|---|---|
| `shapes` | A circle in `accent` at 20% opacity: at the left edge, two thirds of the box height, centered vertically, drawn over the rectangle | A rectangle from one quarter of the width to the right edge, full height, no fill, a `line` border, `rounded-card` corners |
| `grid` | The whole box: a grid of `line` lines every `block`, closed by a `line` border at the right and at the bottom. The box clips the cells that do not fit | One cell (`block` × `block`) filled with `accent`: the third column of the second row |

## Screens 2, 3 and 4

The same for the three compositions. Approved on a phone (390) only.

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

- Screens 2, 3 and 4 on desktop. Recommended: the same column, centered, between 300 and 500 px wide (R20).
- Any width between 390 and 1440 px.
- The figure of `centered` was not on the approved canvas; it appears for the first time on the test canvas. `split` was approved with `shapes` and `editorial` with `grid`; the other combinations use the same place and size.
- Hover, active, focus and sending states, and the debug panel.
- The longest allowed copy and the largest allowed values. Step 1c tests them.

## Points for the owner of the contracts

- **R18, 44 px targets.** Buttons, fields and the checkbox row take their height from `block`. A design with `block` under 44 fails R18 by construction, and the contract has no fixed measure for a target.
- **R20, form width.** No token gives 300 to 500 px on desktop; `prose` and `page` are both wider.
- **R3 on a phone.** Above the title there are `group`, the brand line and `block`. With the largest values and the longest copy allowed the button falls out of the first view; step 1c decides what gives way.

## Artboard templates

`scripts/fill-artboards.mjs <tokens.json> <copy.json> <output>` fills the templates for one direction and writes a folder ready to publish to a Claude Design canvas:

```
<output>/project/canvas.json              index: frames, order, title note
<output>/project/Main.dc.html             screen 1, phone, in the composition of tokens.json
<output>/project/Promise-desktop.dc.html  screen 1, desktop
<output>/project/Email-phone.dc.html      screen 2
<output>/project/Questions-phone.dc.html  screen 3, with the call group open
<output>/project/Done-phone.dc.html       screen 4
```

It prints the written paths, exits with 0, and with 2 when the arguments are wrong or a file is missing a key of the contract. It does not check requirements: run `verify-design.mjs` first. File names never change, so filling again and publishing the same folder repaints the canvas in place.

| File in `templates/canvas/` | What it is |
|---|---|
| `<composition>-phone.dc.html`, `<composition>-desktop.dc.html` | Screen 1 of each composition |
| `email-phone.dc.html`, `questions-phone.dc.html`, `done-phone.dc.html` | Screens 2 to 4 |
| `partials/tokens.css` | The 50 variables, one hole per token: `--color-canvas:[[color.canvas]]` |
| `partials/figure.html` | The figure for `shapes` and `grid`; each template passes its width |
| `frames.mjs` | The height of every frame, estimated from the same spacing as its template |
| `fixtures/contrast-tokens.json` | A valid design opposite to the neutral one: dark, serif and monospace, square corners |

Holes use `[[ ]]` so they never collide with the `{{ }}` of Claude Design:

| Hole | Filled with |
|---|---|
| `[[color.canvas]]`, `[[text.title.size]]`, `[[spacing.block]]`… | The path in `tokens.json`, written as the CSS value the tokens contract fixes. `size` becomes `size_desktop` in the desktop templates |
| `[[copy.hero.title]]`, `[[copy.email.label]]`… | The key in the copy file, escaped |
| `[[progress.email]]`, `[[progress.questions]]` | `progress` with its placeholders filled |
| `[[name]]`, `[[lang]]`, `[[scheme]]`, `[[composition]]`, `[[decor]]`, `[[fonts.href]]`, `[[frame.width]]`, `[[frame.height]]`, `[[pains.count]]` | Values of the direction and of the frame |
| `[[#each copy.pains]]…[[/each]]` | One copy per item: `[[this]]`, `[[index]]`, `[[index2]]`, `[[first]]` |
| `[[#if figure.shapes]]`, `[[#unless figure.none]]` | Parts that depend on `decor` |
| `[[> figure.html width: 100%]]` | A partial; the rest of the tag reaches it as `[[slot]]` |

### Several directions on one canvas

The command draws one direction. A canvas with three directions side by side is built from the functions the script exports, without changing its usage:

```js
import { canvasIndex, fillDirection, placeInRow, titleNote, writeCanvas } from '../scripts/fill-artboards.mjs';

const boards = placeInRow(directions.flatMap(({ slug, tokens }) =>
  fillDirection(tokens, copy)
    .filter((board) => board.group === 'promise')
    .map((board) => ({ ...board, group: slug, file: `${slug}-${board.width}.dc.html` }))));
const notes = Object.fromEntries(directions.map(({ slug, tokens }) => [slug, titleNote(tokens.name, boards.filter((board) => board.group === slug))]));
writeCanvas(output, canvasIndex({ title, boards, notes }), boards);
```

Every file on a canvas needs a different name, and a file left on the canvas keeps showing: remove it with `"project/<file>": null` when a direction goes away.

### Limits of the canvas format

Read from the runtime of the Design type (contract 0.2.47) on 2026-11-21.

- A frame clips at its height and has no automatic height. Heights are estimated from character widths, on the tall side; an unusual wide typeface can still need more room than estimated.
- The instructions of the Design type ask not to render or open a canvas to check it unless the builder asks. Nothing here was measured on a drawn artboard.
- Fonts load only from Google Fonts, through one `css2` link inside `<helmet>`, and only the families listed in `artifact-type/reference/google-fonts-families.json` of the canvas (1773 on that date).
- `<helmet>` is copied to the head of the artboard's own document, so variables set there do not leak between artboards.
- An inline style is split at every `;`: a value cannot contain one.
- `<form>` is avoided in the templates; the hooks `email-form` and `questions-form` are on a `div`.
- The first artboard is `Main.dc.html`. Without it the canvas takes the first file in alphabetical order as its entry.
- Edits made by hand on the canvas stay in the canvas. Filling again overwrites them.
