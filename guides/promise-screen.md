# The free promise screen

Screen 1 of the landing, the promise, is designed freely for each idea: there is no template to fill. Screens 2 to 4 (email, questions, final notice) stay fixed and only take the skin of the tokens. This guide is how a direction's screen 1 is designed as two boards, the rules the boards always meet, and how `landing` turns the approved boards into Astro components.

Read it with [design-system.md](design-system.md) (values) and the [landing contract](../docs/contracts/landing.md) (hooks and copy).

## 1. Design it like a designer

1. **Start from the message, then the design.** `.sbr/design/structure.md` says what the visitor must understand, in what order, and the order of the blocks; it comes from `.sbr/design/promise.md`, where the builder said which moment of the problem the visitor should see first, how they imagine it shown, and what must stand out after the headline. The three directions share that structure and change only how it is designed.
2. **One idea per direction, from the builder's words.** The axes row of the direction quotes the builder's words it answers and names its layout idea in one line: where the headline sits, how the pains are shown, what leads the eye after the button. Build that idea, not a generic hero with three cards under it, and never a literal picture of the subject. The three directions must not share a composition: different grouping, different layouts, different fills, in the same order.
3. **The problem is visible.** The pains are not a list at the bottom: they are what the persona recognizes, shown with the weight the builder asked for. The headline is still the one thing that leads.
4. **Design in gray first.** Lay out with `ink`, `ink-muted`, `canvas`, `surface` and `line`; add `accent` last, on the two buttons and, if you want, on a drawing.
5. **Space before decoration.** Start with more space than feels necessary; group with `item` and `group`, separate with `block` and `section`. A drawing never fills an empty section; better grouping does.

## 2. What the screen always has

These are not asked; every board meets them and the verifier checks them.

| Rule | How it is checked | Row |
|---|---|---|
| One `h1`, the title (`hero.title`), and no other heading than `closing` | Script | R1 |
| Two filled buttons, `cta` and `cta-closing`, both `type="button"`, filled with `accent` and `on-accent`; no other text on an `accent` fill | Script | R1 |
| No links, no menu, no images, no video, no forms on this screen | Script | R1, R28 |
| The hooks of the screen, once each: `brand`, `title`, `subtitle`, `cta`, `pains` (one `li` per pain, in order), `steps` (one `li` per step, in order), `closing`, `cta-closing`, `footer` (author and privacy) | Script | R28, R32 |
| The hooks in the order of `order` in `structure.md`, on both boards | Script, with `structure.md` as the fifth argument | R28 |
| Only the copy: every text comes from those copy keys; numbers alone (step numbers) may be drawn, inside `aria-hidden="true"` | Script | R32 |
| The title alone uses the `title` style and `ink`; each block uses a style allowed for it (table below) | Script | R5 |
| Each style is set in its own family: `title` and `heading` in `--font-display`, the rest in `--font-body`; upright only | Script | R11 |
| Text sits only on allowed pairs: `ink` and `ink-muted` on `canvas` or `surface`, `on-accent` on `accent` | Script | R12 |
| Only tokens: colors, sizes, spacing, radii, shadow and line width are variables; no length or color written by hand | Script | R14 |
| No gradient, glow, blur, text shadow or blend | Script | R15 |
| Never justified; `h1` and `h2` carry `text-wrap: balance` | Script | R10 |
| No motion on a board | Script | R23 |
| The phone and desktop boards show the same texts, in the same order, styles and fills | Script | R28 |
| Title, subtitle and the whole `cta` inside the first view (375×667 and 1440×900) | Measured on the boards when Chrome is there, then on the page | R3 |
| The button says it is early access and leads to the email step | Copy review; the flow script sends both buttons to screen 2 | R7 |
| No prices, testimonials, invented figures; the notice that it does not exist yet stays on screen 4 | Copy check | R25, R27 |

Styles each block may use:

| Hook | Styles |
|---|---|
| `title` | `title` |
| `subtitle` | `lead`, `body` |
| `brand` | `button`, `body`, `small`, `label` |
| `cta`, `cta-closing` | `button` |
| `pains`, `steps` items | `body`, `lead`, `heading` |
| `closing` | `heading` |
| `footer` | `small` |

## 3. The board files

Each direction has two boards in `.sbr/sketches/<letter>/`: `promise-phone.html` (drawn 390 px wide) and `promise-desktop.html` (1440 px wide). A board is one fragment, never a whole document:

```html
<section data-sbr="screen-promise" aria-labelledby="title" style="…">
  …
</section>
```

The plugin wraps it in the artboard: the fonts, the token variables of the direction, the page background (`canvas`), the body text style and `ink`. Write only what is inside.

- **Elements:** `section`, `header`, `footer`, `div`, `p`, `h1`, `h2`, `ul`, `ol`, `li`, `span`, `button`. Inside a figure, also `svg`, `g`, `path`, `circle`, `rect`, `line`, `polyline`, `polygon`, `ellipse`.
- **Inline styles only.** No `<style>`, no classes, no scripts, no event attributes.
- **Text styles** are set with their four variables together: `font-size: var(--text-<style>); line-height: var(--text-<style>--line-height); font-weight: var(--text-<style>--font-weight); letter-spacing: var(--text-<style>--letter-spacing)`, plus `font-family: var(--font-display)` or `var(--font-body)`.
- **Colors:** `var(--color-<token>)`, `transparent` or `currentColor`. Backgrounds with `background-color`.
- **Buttons:** `cta` and `cta-closing` keep the padding of the filled button, `var(--spacing-item) var(--spacing-group)`, and its `min-height: var(--spacing-block)`; only their width is free.
- **Lengths:** `var(--spacing-section|block|group|item)`, `var(--container-prose|page)`, `var(--radius-control|card)`, `var(--line-width)`, `0`, `auto`, and percentages that are simple fractions (50%, 33.333%, 25%, 41.667%). Borders: `var(--line-width) solid var(--color-line)`. Shadow: `var(--shadow-card)` or `none`. Round shapes: `border-radius: 50%`.
- **Layout:** flex freely; grids only as `grid-template-columns: repeat(<n>, minmax(0, 1fr))` with `grid-column: span <n> / span <n>`. A 12-column grid gives any split (7 and 5, 8 and 4).
- **Figures.** A decorative drawing goes inside `<div data-sbr="figure" aria-hidden="true">`. There may be several. A figure holds no text; only inside one may `opacity` be used. Draw with token colors only; a stroke is `stroke: var(--color-line)` or `var(--color-accent)` with `stroke-width: var(--line-width)`.

A board that fails is fixed and checked again before it reaches the canvas:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/verify-design.mjs" <tokens.json> <copy.json> <promise-phone.html> <promise-desktop.html> <structure.md>
```

Every `fail` row names the board, the element or the declaration.

## 4. From the boards to Astro

`landing` writes the approved boards as components of the builder's project, in `landing/src/promise/`. The entry is `Promise.astro`, which renders the `<section data-sbr="screen-promise">`; any other component it needs sits in the same folder. Everything else in the project is the template and is never edited.

- Texts come from `copy` (`import { copy } from '../lib/copy'`): `{copy.hero.title}`, `{copy.pains.map(…)}`. No visible phrase is written in a component. Step numbers are computed from the position: `{String(index + 1).padStart(2, '0')}` inside `aria-hidden="true"`.
- The two buttons are the template's `FilledButton`: `<FilledButton hook="cta" label={copy.cta} />` and `hook="cta-closing"`. Its `class` prop sets only the width (`w-full`, `w-auto`, `md:w-auto`). The brand is the template's `<Brand />`, unless the board draws the brand in another style: then a `<p data-sbr="brand">` with the classes of the board.
- `margin: 0` and `padding: 0` need no class: the template already resets them. Never write `m-0` or `p-0`.
- The phone and desktop boards may nest their blocks differently. Then add a wrapper with layout classes only (no fill, border, spacing token of its own or text) so one structure serves both; never add anything that shows.
- The phone board is the base classes; what the desktop board changes is the same class with the `md:` prefix (768 px, where the text sizes switch). Use `lg:` (1024 px) instead when the 768 px capture overflows.
- No `style` attribute, no `<style>`, no `<script>`, no `set:html`, no other file type: only Tailwind classes of the tokens.

| Board | Class |
|---|---|
| `font-size: var(--text-lead)` and its three companions | `text-lead` |
| `font-family: var(--font-display)` | `font-display` |
| `color: var(--color-ink-muted)` | `text-ink-muted` |
| `background-color: var(--color-surface)` | `bg-surface` |
| `padding: var(--spacing-group)`, `gap: var(--spacing-item)`, `margin-top: var(--spacing-block)` | `p-group`, `gap-item`, `mt-block` |
| `padding: var(--spacing-block) var(--spacing-group)` | `py-block px-group` |
| `max-width: var(--container-page)`, `var(--container-prose)` | `max-w-page`, `max-w-prose` |
| `border: var(--line-width) solid var(--color-line)`; only on top | `border border-line`; `border-t border-line` |
| `border-radius: var(--radius-card)`; `50%` | `rounded-card`; `circle` |
| `box-shadow: var(--shadow-card)` | `shadow-card` |
| `width: 50%`, `41.667%`, `100%` | `w-1/2`, `w-5/12`, `w-full` |
| `grid-template-columns: repeat(3, minmax(0, 1fr))`; `grid-column: span 7 / span 7` | `grid grid-cols-3`; `col-span-7` |
| `text-wrap: balance`; `text-align: center` | `text-balance`; `text-center` |
| `opacity: 0.2` inside a figure; `fill: var(--color-accent)`; `stroke: var(--color-line)`; `stroke-width: var(--line-width)` | `opacity-20`; `fill-accent`; `stroke-line`; `stroke-line-width` |
| `position: absolute; inset: 0` | `absolute inset-0` |

After building, `landing.mjs match` compares the page with the phone board: the texts of screen 1 in order, each with its style, color and fill. A difference names the first text that differs. The layout is compared by eye: the builder sees the page next to the canvas before publishing.

## 5. What the critic looks for

Before the builder sees a direction, a critic who knows nothing else looks at screenshots of its two boards next to `structure.md` (`agents/design-critic.md`). Design so none of these holds:

- **Hierarchy.** The headline leads the first view; the button is the next thing the eye lands on; the pains and steps step back. Size, weight and contrast together only on the headline.
- **The message.** What `structure.md` says the visitor must understand shows, in its order, not hidden under a drawing.
- **The first view.** Headline, subtitle and the whole button inside it, and the fold never slices a filled card, a bordered box or a drawing in half; a list may simply continue below it.
- **Edges.** Blocks start on at most two left lines and share their right edges. Running text and lists are never centred; only the headline group may be, and no centred block is wider than half the page on desktop.
- **Space.** More space between groups than inside them; no short block alone in an empty band; no dead space beside a short text.
- **No template.** Not a centred headline over three equal cards, icons in colored circles, a pill above the headline, a stack of identical bands, or the phone layout simply stretched on desktop.
- **Drawings mean something.** A figure shows something `structure.md` asks for; it never fills space, illustrates the subject literally or sits under text.
- **The accent stays small.** On the two buttons and a few marks; color never makes the hierarchy.
- **Type.** No tracked capitals or small caps; one quieter level of small text in the headline group at most; running text under about 75 characters a line, the widest `measure.prose` allows; the headline never ends on a single word alone.
- **One box deep, nothing broken.** No box in a box in a box, no cards in cards; nothing overlaps, touches, tilts or is cut at an edge.

These come from the Taste Skill and Refactoring UI, restated for one screen with a fixed anatomy: [ATTRIBUTIONS.md](../ATTRIBUTIONS.md).
