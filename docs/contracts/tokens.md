# Tokens contract

A design direction is one `tokens.json` file. The same file feeds two painters: the Claude Design artboards (`scripts/fill-artboards.mjs`) and the Astro landing (`src/layouts/Base.astro`). What the builder approves on the canvas and what gets published come from the same values.

- Machine-readable copy of this contract: [`templates/contract.json`](../../templates/contract.json), key `tokens`.
- Reference file that must always pass the verifier: [`templates/neutral-design/tokens.json`](../../templates/neutral-design/tokens.json).
- Utility generation was checked by compiling with Tailwind CSS 4.3.5 (2026-11-20).

Edit this file only on `main`.

## `tokens.json` schema

The key set is closed: no other keys are allowed at any level. Keys are `snake_case`; the CSS name of a token is the key with `_` replaced by `-` (`ink_muted` is `ink-muted`).

| Key | Type | Allowed values |
|---|---|---|
| `name` | string | Name of the direction shown to the builder, 1 to 40 characters, in the builder's language |
| `scheme` | string | `light` or `dark` |
| `composition` | string | `centered`, `split` or `editorial` |
| `decor` | string | `none`, `shapes` or `grid` |
| `palette_source` | string, optional | `derived` (default) or `builder`. `builder` means the builder brought these colors or asked for them |
| `fonts` | object | `display` and `body`, see [Fonts](#fonts) |
| `color` | object | Nine colors, see [Color](#color) |
| `text` | object | Seven text styles, see [Text styles](#text-styles) |
| `spacing` | object | `section`, `block`, `group`, `item`, see [Spacing](#spacing) |
| `shape` | object | `radius_control`, `radius_card`, `shadow_card`, `line_width`, see [Shape](#shape) |
| `measure` | object | `prose`, `page`, `motion_duration`, see [Measures](#measures) |

Every length is a plain number of CSS pixels at a 16 px root. Painters convert; `tokens.json` never carries units.

```json
{
  "name": "Neutral",
  "scheme": "light",
  "composition": "centered",
  "decor": "none",
  "palette_source": "derived",
  "fonts": {
    "display": { "family": "Public Sans", "weights": [700], "fallback": "sans-serif" },
    "body": { "family": "Public Sans", "weights": [400, 600], "fallback": "sans-serif" }
  },
  "color": { "canvas": "#FAFAFA", "surface": "#FFFFFF", "ink": "#1C1C1C", "ink_muted": "#5C5C5C", "accent": "#2E2E2E", "on_accent": "#FFFFFF", "line": "#858585", "focus": "#1C1C1C", "danger": "#B3261E" },
  "text": {
    "title": { "size": 35, "size_desktop": 55, "line_height": 1.1, "font_weight": 700, "letter_spacing": -0.02 }
  },
  "spacing": { "section": 96, "block": 48, "group": 24, "item": 8 },
  "shape": { "radius_control": 8, "radius_card": 12, "shadow_card": { "x": 0, "y": 1, "blur": 2, "opacity": 0.08 }, "line_width": 1 },
  "measure": { "prose": 62, "page": 1120, "motion_duration": 200 }
}
```

(The example shows one text style; a real file has all seven.)

## Variables, values and utilities

50 CSS variables. Each one comes from exactly one path of `tokens.json`.

| Family | Variable | `tokens.json` path | CSS value written by the painters |
|---|---|---|---|
| Color | `--color-canvas`, `--color-surface`, `--color-ink`, `--color-ink-muted`, `--color-accent`, `--color-on-accent`, `--color-line`, `--color-focus`, `--color-danger` | `color.<key>` | The hex string as is |
| Font family | `--font-display`, `--font-body` | `fonts.display`, `fonts.body` | `"<family>", <fallback>` |
| Text size | `--text-<style>` | `text.<style>.size`, and `text.<style>.size_desktop` from 768 px | `<px / 16>rem` |
| Text line height | `--text-<style>--line-height` | `text.<style>.line_height` | The number, unitless |
| Text weight | `--text-<style>--font-weight` | `text.<style>.font_weight` | The number |
| Text tracking | `--text-<style>--letter-spacing` | `text.<style>.letter_spacing` | `<number>em` |
| Spacing | `--spacing-section`, `--spacing-block`, `--spacing-group`, `--spacing-item` | `spacing.<key>` | `<px / 16>rem` |
| Shape | `--radius-control`, `--radius-card` | `shape.radius_control`, `shape.radius_card` | `<px / 16>rem` |
| Shape | `--shadow-card` | `shape.shadow_card` | `<x>px <y>px <blur>px rgb(0 0 0 / <opacity>)` |
| Shape | `--line-width` | `shape.line_width` | `<number>px` |
| Measure | `--container-prose` | `measure.prose` | `<number>ch` |
| Measure | `--container-page` | `measure.page` | `<px / 16>rem` |
| Measure | `--motion-duration` | `measure.motion_duration` | `<number>ms` |

`<style>` is one of `title`, `heading`, `lead`, `body`, `small`, `button`, `label` (7 styles × 4 variables = 28).

`rem` values are `px / 16` rounded to four decimals with trailing zeros removed: `35` is `2.1875rem`, `14` is `0.875rem`.

**Phone first, desktop from 768 px.** Every variable is written once on `:root`. The seven `--text-<style>` sizes are written again inside `@media (min-width: 48rem)` with `size_desktop`. Nothing else changes with the viewport: line height, weight, tracking, spacing, shape and measures have one value. The only breakpoint tied to tokens is `md` (`--breakpoint-md: 48rem`); other layout breakpoints are template internals and never change a token value.

### Utilities

Token utilities are the only way to set color, font family, font size, line height, font weight, letter spacing, space between elements, radius, shadow, border width, text measure and motion duration.

| Variable | Utilities the template may use |
|---|---|
| `--color-canvas` | `bg-canvas` |
| `--color-surface` | `bg-surface` |
| `--color-ink` | `text-ink` |
| `--color-ink-muted` | `text-ink-muted`, `placeholder:text-ink-muted` |
| `--color-accent` | `bg-accent`, `accent-accent` (native checkbox), `border-accent`, `fill-accent`, `stroke-accent` |
| `--color-on-accent` | `text-on-accent` |
| `--color-line` | `border-line`, `stroke-line` |
| `--color-focus` | `outline-focus` |
| `--color-danger` | `text-danger`, `border-danger` |
| `--font-display`, `--font-body` | `font-display`, `font-body` |
| `--text-<style>` and its three companions | `text-title`, `text-heading`, `text-lead`, `text-body`, `text-small`, `text-button`, `text-label`. Each sets size, line height, weight and tracking together |
| `--spacing-*` | Any spacing or sizing utility with the four names: `py-section`, `mt-block`, `gap-group`, `p-item`, `size-block`, and so on |
| `--radius-control`, `--radius-card` | `rounded-control`, `rounded-card` and their side variants |
| `--shadow-card` | `shadow-card` |
| `--line-width` | `border`, `border-t`, `border-r`, `border-b`, `border-l`, `border-x`, `border-y`, always without a number |
| `--container-prose`, `--container-page` | `max-w-prose`, `max-w-page` |
| `--motion-duration` | `transition-opacity`, `transition-transform`, always without a `duration-*` utility |

Variants (`md:`, `hover:`, `focus-visible:`, `aria-invalid:`, `disabled:`) may prefix any of them.

Not allowed anywhere in the template:

- Arbitrary values or properties in square brackets (`text-[13px]`, `bg-[#fff]`).
- `text-accent`, `text-canvas`, `text-surface`, `text-line`, `text-focus`, and any `bg-*` other than `bg-canvas`, `bg-surface` and `bg-accent`.
- Opacity modifiers on colors (`bg-accent/50`), except on `decor-1` and `decor-2`.
- Numeric border widths (`border-2`), `duration-*`, `delay-*`, `ease-*`, `leading-*`, `tracking-*`, `font-<weight>`.

The focus ring is the one fixed, non-token measure: `outline-2 outline-offset-2 outline-focus`. Layout utilities without a token (`flex`, `grid`, `w-full`, `w-1/2`, `min-h-dvh`, `text-balance`, `sr-only`, `opacity-0`) are free.

## Color

Colors are six-digit hex strings matching `^#[0-9A-Fa-f]{6}$`. No alpha, no named colors, no `oklch()`.

| Token | Role |
|---|---|
| `canvas` | Page background |
| `surface` | Raised background: form fields, cards, debug panel |
| `ink` | Primary text |
| `ink-muted` | Secondary text and placeholders |
| `accent` | Fill of the one filled button per screen, the native checkbox, and decor |
| `on-accent` | Text on `accent` |
| `line` | Borders of fields and cards, dividers, decor lines |
| `focus` | Focus ring |
| `danger` | Error text and the border of an invalid field |

### Pair rules

- Text in `ink` or `ink-muted` is drawn only on `canvas` or `surface`.
- Text in `on-accent` is drawn only on `accent`.
- `accent` is never a text color.
- Text is never drawn over `figure`, `decor-1` or `decor-2`.
- Any pair not listed below is not allowed.

Contrast is the WCAG 2 ratio `(L1 + 0.05) / (L2 + 0.05)` over sRGB relative luminance.

| Foreground | Background | Minimum ratio |
|---|---|---|
| `ink` | `canvas`, `surface` | 7 |
| `ink-muted` | `canvas`, `surface` | 4.5 |
| `on-accent` | `accent` | 4.5 |
| `danger` | `canvas`, `surface` | 4.5 |
| `line` | `canvas`, `surface` | 3 |
| `focus` | `canvas`, `surface` | 3 |
| `accent` | `canvas`, `surface` | 3 |

Other color rules:

- `ink` is never `#000000`.
- `scheme: light` requires `canvas` lighter than `ink`; `scheme: dark` requires `canvas` darker than `ink` (by relative luminance).
- Hue means the HSL hue in degrees. `accent` is violet when its HSL hue is between 250 and 300 and its HSL saturation is 15% or more. A violet `accent` is allowed only with `palette_source: builder`.

## Fonts

```json
"fonts": {
  "display": { "family": "Public Sans", "weights": [700], "fallback": "sans-serif" },
  "body": { "family": "Public Sans", "weights": [400, 600], "fallback": "sans-serif" }
}
```

| Key | Rule |
|---|---|
| `family` | A family name exactly as listed in the Google Fonts catalog |
| `weights` | Non-empty ascending list of multiples of 100 from 100 to 900 |
| `fallback` | `sans-serif`, `serif` or `monospace` |

- `display` and `body` may name the same family. At most two distinct families.
- At most four distinct `(family, weight)` pairs across both roles. That is the number of font files.
- Every weight used by a text style is listed in the `weights` of its role, and every listed weight is used by at least one text style of that role.
- Fonts are loaded in `normal` style only, `latin` subset, and served from the landing's own domain. No italics.

## Text styles

Each style is `{ size, size_desktop, line_height, font_weight, letter_spacing }`. The family, the color and the places where a style is used are fixed here for every composition; a composition changes layout, never which style a hook uses.

| Style | Family | Drawn in | Used by (hooks from [landing.md](landing.md)) |
|---|---|---|---|
| `title` | `display` | `ink` | `title` |
| `heading` | `display` | `ink` | `closing`, `email-title`, `questions-title`, `done-title` |
| `lead` | `body` | `ink-muted` | `subtitle` |
| `body` | `body` | `ink` | Items of `pains` and `steps`, `notice`, `next-steps`, and the text typed in every field |
| `small` | `body` | `ink-muted`; errors in `danger` | `privacy`, `footer`, the step text and the saved note inside `progress`, `email-error`, `questions-error`, `debug-panel` |
| `button` | `body` | `on-accent` on buttons; `ink` on `brand` | `cta`, `cta-closing`, `email-submit`, `questions-submit`, `brand` |
| `label` | `body` | `ink-muted` | The `<label>` of every field |

Allowed ranges (inclusive):

| Style | `size` px | `size_desktop` px | `line_height` | `font_weight` | `letter_spacing` em |
|---|---|---|---|---|---|
| `title` | 28 to 36 | 36 to 64 | 1.05 to 1.25 | 400 to 900 | -0.04 to 0.02 |
| `heading` | 20 to 32 | 22 to 40 | 1.05 to 1.25 | 400 to 900 | -0.04 to 0.02 |
| `lead` | 16 to 20 | 16 to 24 | 1.45 to 1.65 | 300 to 500 | -0.01 to 0.02 |
| `body` | 16 to 18 | 16 to 20 | 1.45 to 1.65 | 300 to 500 | -0.01 to 0.02 |
| `small` | 14 to 16 | 14 to 16 | 1.45 to 1.65 | 300 to 500 | -0.01 to 0.02 |
| `button` | 16 to 18 | 16 to 20 | 1 to 1.5 | 500 to 800 | -0.01 to 0.08 |
| `label` | 14 to 16 | 14 to 16 | 1.2 to 1.5 | 400 to 600 | -0.01 to 0.08 |

`font_weight` is a multiple of 100. The upper bounds are the "largest allowed values" that step 1c tests each composition with.

## Spacing

Four levels, one value each for every viewport. A composition adapts to small screens by using a lower level (`py-block md:py-section`), never a value outside the four.

| Token | Meaning | Range px |
|---|---|---|
| `section` | Between the bands of screen 1 (hero, pains, steps, closing, footer) | 64 to 128 |
| `block` | Between blocks inside a band or a screen | 32 to 64 |
| `group` | Between groups of related elements: one field and the next, text and its button | 16 to 32 |
| `item` | Inside a group: a label and its field, a title and its subtitle | 4 to 16 |

All four are multiples of 4 and strictly decreasing: `section > block > group > item`.

## Shape

| Key | Meaning | Range |
|---|---|---|
| `radius_control` | Corner radius of buttons and fields | 0 to 24 px |
| `radius_card` | Corner radius of cards | 0 to 32 px |
| `line_width` | Width of every border and divider | 1 to 4 px |
| `shadow_card` | Shadow of cards: `{ x, y, blur, opacity }` | `x` 0 to 12 px, `y` 0 to 24 px, `blur` 0 to 48 px, `opacity` 0 to 1 |

The shadow color is always black at `opacity`. When `blur` is above 0, `opacity` is at most 0.25: a soft shadow stays subtle, a hard one (`blur` 0) may be solid. There are no colored shadows, so no glows.

## Measures

| Key | Meaning | Range |
|---|---|---|
| `prose` | Maximum width of running text, in `ch` | 45 to 75 |
| `page` | Maximum width of the page content, in px | 960 to 1280 |
| `motion_duration` | Duration of every transition, in ms | 0 to 400 |

## Composition and decor

- `composition` picks the layout of the hero and of the page: `centered`, `split` or `editorial`. Their look is approved in step 0c and specified in `docs/design/compositions.md`.
- `decor` picks the decorative motif of the hero. Every motif is drawn only with tokens, is flat (no gradients, no blur) and is `aria-hidden`.

| `decor` | `figure` | `decor-1` | `decor-2` |
|---|---|---|---|
| `none` | Not rendered | Not rendered | Not rendered |
| `shapes` | Rendered | A circle filled with `accent` | A rectangle with `--radius-card` corners, no fill, and a `--line-width` border in `line` |
| `grid` | Rendered | A square grid of `--line-width` lines in `line`, with cells of `--spacing-block` | One cell of that grid filled with `accent` |

Position and size of the motif belong to each composition.

## Value rules

`scripts/verify-design.mjs` enforces the schema, the ranges above and these rules. The number is the requirement in `docs/plan.md`.

| Req. | Rule on values |
|---|---|
| R4 | For each viewport (`size`, then `size_desktop`) there is a ratio `r`, 1.25 or 1.333, such that every style larger than `body` measures `body × r^k` for a whole `k ≥ 1`, within ±4%. The two viewports may use different ratios. Styles not larger than `body` only follow R8 |
| R4 | `title / body` is at least 2 with `size_desktop` and at least 1.75 with `size` |
| R4 | `size_desktop ≥ size` for every style |
| R5 | `title` has the strictly largest `size` and `size_desktop`, and its `font_weight` is the highest of the seven (ties allowed). It is drawn in `ink`, so no other style combines the three |
| R5 | `label` is smaller than `body` in both viewports and is drawn in `ink-muted` |
| R5 | In both viewports `lead` is at least `body` and `small` is smaller than `body` |
| R5 | Three levels by construction: `ink` at display weight (`title`, `heading`), `ink` at body weight (`body`), `ink-muted` (`lead`, `small`, `label`). The weight ranges keep muted text from being heavy |
| R8 | `body` ≥ 16 px, every style ≥ 14 px. Field text uses `body` |
| R9 | `line_height` ranges of the table above |
| R10 | `prose` between 45 and 75 |
| R11 | Font rules above: at most two families and four `(family, weight)` pairs |
| R12 | Pair table above; `ink` is not `#000000` |
| R15 | No violet `accent` unless `palette_source: builder`. Gradients and glows cannot be expressed in this schema |
| R17 | Spacing rules above |
| R23 | `motion_duration` ≤ 400 |
| R30 | `theme-color` is `color.canvas` |

Sketch criterion B1 ("accents at least 40° apart") uses the same HSL hue.

## Tailwind 4 wiring

The names above are binding. This is the mechanism that was verified to produce them; step 1 may change the mechanism only if every utility still resolves to the same variable.

```css
@import "tailwindcss";

@theme {
  --*: initial;
  --breakpoint-md: 48rem;

  --color-canvas: #fafafa;
  --font-display: "Public Sans", sans-serif;
  --text-title: 2.1875rem;
  --text-title--line-height: 1.1;
  --text-title--font-weight: 700;
  --text-title--letter-spacing: -0.02em;
  --spacing-section: 6rem;
  --radius-control: 0.5rem;
  --container-prose: 62ch;

  --line-width: 1px;
  --default-border-width: var(--line-width);
  --motion-duration: 200ms;
  --default-transition-duration: var(--motion-duration);
}

@utility shadow-card {
  box-shadow: var(--shadow-card);
}
```

Facts from the compile:

- `--*: initial` turns the default theme off: `bg-red-500`, `p-4`, `text-xl`, `font-bold`, `rounded-lg`, `shadow-md`, `max-w-md`, `leading-tight` and `tracking-tight` produce no CSS.
- Utilities read the variable (`color: var(--color-ink)`), so the values that `Base.astro` writes on `:root` win over the defaults in `@theme`.
- `text-title` sets `font-size`, `line-height`, `letter-spacing` and `font-weight` from the four `--text-title*` variables.
- `--default-border-width: var(--line-width)` makes `border`, `border-t` and `border-b` use the token. `--default-transition-duration: var(--motion-duration)` does the same for `transition-*`. `duration-motion` does not exist.
- A shadow declared inside `@theme` is copied into the utility as a literal, so a `:root` override would be ignored. `shadow-card` is declared with `@utility` and `--shadow-card` lives on `:root` only.
- These still compile with the default theme off and are caught by the verifier, not by the compiler: square-bracket values, and bare numbers such as `border-2`, `outline-2` and `duration-200`.
- An opacity modifier (`bg-accent/50`) compiles with the `@theme` default as a literal fallback for browsers without `color-mix()`; only browsers with `color-mix()` read the variable. That is why modifiers stay on decor.
