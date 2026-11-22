# Landing contract

What every landing built by the plugin has, whatever its design: the four screens, the files, the `data-sbr` hooks, the copy keys, the configuration keys, the URL parameters and the plugin scripts.

- Machine-readable copy: [`templates/contract.json`](../../templates/contract.json).
- Design values: [tokens.md](tokens.md). Events: [events.md](events.md). Builder state: [state.md](state.md).

Edit this file only on `main`.

## Anatomy

Four screens in one HTML document. Screen 1, the promise, is designed freely for each builder: its layout, the order and grouping of its blocks and its drawings belong to the approved boards, while its hooks and the rules of [the free screen](../../guides/promise-screen.md) are fixed. Screens 2 to 4 are fixed: the design changes only their skin (the tokens), never their blocks or their order.

| Screen | Block | Hooks | Contains | Presence |
|---|---|---|---|---|
| 1 · Promise (free) | Brand | `brand` | Product name. No menu | Required |
| | Hero | `title`, `subtitle`, `cta` | Headline (the promise), subtitle (who it is for and what changes) and the early-access button. Fits whole in the first view | Required |
| | Pains | `pains` | One to three situations the user recognizes, taken from the brief: the problem, shown | Required |
| | How it works | `steps` | Three steps of what the visitor will get | Required |
| | Closing | `closing`, `cta-closing` | The promise in one line and the same button | Required |
| | Footer | `footer` | Who is behind it and the privacy line | Required |
| | Figures | `figure` | Decorative drawings of the free design, drawn with tokens, without text | Optional, any number |
| 2 · Email | Progress | `progress`, `brand` | Brand and "step 1 of 2" | Required |
| | Signup | `email-title`, `email-form`, `email-field`, `privacy`, `email-submit` | Title, email field with its label, privacy line, submit button | Required |
| | Error | `email-error` | Under the field, only when something fails | Conditional |
| 3 · Questions | Progress | `progress`, `brand` | Brand, "step 2 of 2" and the note that the email is already saved | Required |
| | Two questions | `questions-title`, `questions-form`, `field-current-solution`, `field-last-time` | What they use today; when it last happened and what it cost them | Required |
| | Call | `field-wants-call`, `call-group`, `field-whatsapp`, `field-time-slot` | WhatsApp and a time slot | Optional for the visitor |
| | Submit | `questions-submit`, `questions-error` | Button, and the error only when something fails | Required |
| 4 · Done | Confirmation | `done-title` | Title | Required |
| | Notice | `notice` | "It does not exist yet", in plain view | Required |
| | What is next | `next-steps` | One line | Required |

**Where the email signup goes:** on its own screen, after the button. The click is measured separately in the verdict; that is why they are two steps.

**Never present, with any design:** navigation menu, prices or plans, testimonials, customer logos or invented figures, outbound links or social networks, pop-ups, chat, carousels, background video.

## Document rules

- `page` is the `<body>`. It carries `data-scheme` with the value from `tokens.json` and `data-screen` with the number of the visible screen (`1` to `4`).
- Each screen is a `<section>`. Exactly one is visible; the others carry the `hidden` attribute. In the built HTML screen 1 is visible and `data-screen` is `1`.
- A hook is unique inside its screen. `brand` occurs three times (screens 1, 2 and 3), `progress` twice (screens 2 and 3) and `figure` any number of times inside screen 1; every other hook occurs once in the document. Select them through their screen: `[data-sbr="screen-email"] [data-sbr="brand"]`.
- One `h1` in the document: `title`. The other titles are `h2` and carry `tabindex="-1"`; when the screen changes, focus moves to the title of the new screen.
- One filled button per screen: `cta` (repeated as `cta-closing`), `email-submit`, `questions-submit`. Screen 4 has none. There are no links.
- A text hook contains exactly the string of its copy key and nothing else. No component or script holds a visible phrase.
- Elements that are hidden until something happens (`email-error`, `questions-error`, `call-group`, `debug-panel`) are always in the HTML and carry `hidden` until then.

## Hooks (`data-sbr`)

36 hooks. "Required" means the element must be in the built HTML.

### Structure

| Hook | Element | Screens | Required | Content |
|---|---|---|---|---|
| `page` | `body` | Whole document | Yes | The attributes above |
| `brand` | `p` | 1, 2, 3 | Yes | Copy key `brand`. On screens 2 and 3 it sits inside `progress` |
| `progress` | `div` | 2, 3 | Yes | `brand`, the `progress` text with its placeholders filled, and on screen 3 `questions.saved` |
| `figure` | `div` | 1 | No | A decorative drawing of the free screen. `aria-hidden="true"`, no text, any number. Opacity modifiers are allowed inside it ([tokens.md](tokens.md#utilities)) |
| `footer` | `footer` | 1 | Yes | `footer.author` and `footer.privacy` |
| `debug-panel` | `aside` | Outside the screens | Yes | Hidden unless `?debug=1`. One `<li data-event="<event>">` per emitted event, in order, with the event name and its properties as JSON |

### Screen 1 · Promise

| Hook | Element | Required | Content |
|---|---|---|---|
| `screen-promise` | `section` | Yes | The screen |
| `title` | `h1` | Yes | `hero.title` |
| `subtitle` | `p` | Yes | `hero.subtitle` |
| `cta` | `button type="button"` | Yes | `cta`. Goes to screen 2 |
| `pains` | `ul` | Yes | One `li` per entry of `pains` |
| `steps` | `ol` | Yes | One `li` per entry of `steps` |
| `closing` | `h2` | Yes | `closing` |
| `cta-closing` | `button type="button"` | Yes | `cta`. Goes to screen 2 |

### Screen 2 · Email

| Hook | Element | Required | Content |
|---|---|---|---|
| `screen-email` | `section` | Yes | The screen |
| `email-title` | `h2` | Yes | `email.title` |
| `email-form` | `form novalidate` | Yes | The field, its label, `privacy`, `email-error` and `email-submit` |
| `email-field` | `input` | Yes | See [Fields](#fields) |
| `privacy` | `p` | Yes | `email.privacy` |
| `email-submit` | `button type="submit"` | Yes | `email.submit`; `status.sending` while sending |
| `email-error` | `p role="alert"` | Yes | `email.error`. Directly under the field. Hidden until the field is invalid or the request fails |

### Screen 3 · Questions

| Hook | Element | Required | Content |
|---|---|---|---|
| `screen-questions` | `section` | Yes | The screen |
| `questions-title` | `h2` | Yes | `questions.title` |
| `questions-form` | `form novalidate` | Yes | The fields, their labels, `questions-error` and `questions-submit` |
| `field-current-solution` | `textarea` | Yes | See [Fields](#fields) |
| `field-last-time` | `textarea` | Yes | See [Fields](#fields) |
| `field-wants-call` | `input type="checkbox"` | Yes | See [Fields](#fields) |
| `call-group` | `div` | Yes | `field-whatsapp` and `field-time-slot` with their labels. Hidden until `field-wants-call` is checked |
| `field-whatsapp` | `input` | Yes | See [Fields](#fields) |
| `field-time-slot` | `input` | Yes | See [Fields](#fields) |
| `questions-submit` | `button type="submit"` | Yes | `questions.submit`; `status.sending` while sending |
| `questions-error` | `p role="alert"` | Yes | `questions.error`. Directly above `questions-submit`. Hidden until a field is invalid or the request fails |

### Screen 4 · Done

| Hook | Element | Required | Content |
|---|---|---|---|
| `screen-done` | `section` | Yes | The screen |
| `done-title` | `h2` | Yes | `done.title` |
| `notice` | `p` | Yes | `done.notice` |
| `next-steps` | `p` | Yes | `done.next` |

## Fields

Every field has a visible `<label for>` in the `label` style. The `name` is also the event property ([events.md](events.md)).

| Hook | `name` | Label key | `type` | Required | `autocomplete` | `inputmode` | `maxlength` | Other |
|---|---|---|---|---|---|---|---|---|
| `email-field` | `email` | `email.label` | `email` | Yes | `email` | `email` | 254 | `placeholder` from `email.placeholder`, `spellcheck="false"`, `autocapitalize="none"`, `autocorrect="off"` |
| `field-current-solution` | `current_solution` | `questions.current_solution` | `textarea` | Yes | `off` | | 500 | `rows="3"` |
| `field-last-time` | `last_time` | `questions.last_time` | `textarea` | Yes | `off` | | 500 | `rows="3"` |
| `field-wants-call` | `wants_call` | `questions.wants_call` | `checkbox` | No | | | | Unchecked by default. Shows `call-group` |
| `field-whatsapp` | `whatsapp` | `questions.whatsapp` | `tel` | Only while `field-wants-call` is checked | `tel` | `tel` | 30 | |
| `field-time-slot` | `time_slot` | `questions.time_slot` | `text` | No | `off` | | 80 | |

Validation is the browser's own (`required`, `type`, `checkValidity()`), with the plugin's messages instead of the browser bubbles: an invalid field gets `aria-invalid="true"` and `aria-describedby` pointing at the error of its form, the error is shown, and focus moves to the first invalid field.

## Copy keys

The language file `src/i18n/<locale>.json` holds every visible string. `.sbr/design/copy.<locale>.json` has the same schema; `landing` copies it unchanged.

- 32 keys, closed set: no other keys.
- Strings are plain text: no HTML, no Markdown, no line breaks, no leading or trailing spaces, never empty.
- Length is counted in Unicode code points.
- `<locale>` matches `^[a-z]{2}(-[A-Z]{2})?$` (`es`, `pt-BR`). `src/i18n/` holds exactly one file.

| Key | Shown in | Limit |
|---|---|---|
| `lang` | `<html lang>` | Equal to `<locale>` |
| `brand` | `brand` | ≤ 30 |
| `hero.title` | `title` | ≤ 70 |
| `hero.subtitle` | `subtitle` | ≤ 160 |
| `cta` | `cta`, `cta-closing` | ≤ 24 |
| `pains` | `pains` | List of 1 to 3 strings, each ≤ 90 |
| `steps` | `steps` | List of exactly 3 strings, each ≤ 90 |
| `closing` | `closing` | ≤ 70 |
| `footer.author` | `footer` | ≤ 80 |
| `footer.privacy` | `footer` | ≤ 160 |
| `progress` | `progress` | ≤ 30. Must contain `{current}` and `{total}`; the template fills them with `1` and `2` on screen 2, `2` and `2` on screen 3 |
| `status.sending` | `email-submit`, `questions-submit` while sending | ≤ 24 |
| `email.title` | `email-title` | ≤ 70 |
| `email.label` | Label of `email-field` | ≤ 40 |
| `email.placeholder` | Placeholder of `email-field` | ≤ 40 |
| `email.submit` | `email-submit` | ≤ 24 |
| `email.privacy` | `privacy` | ≤ 160 |
| `email.error` | `email-error` | ≤ 120. One message for an invalid email and for a failed request |
| `questions.title` | `questions-title` | ≤ 70 |
| `questions.saved` | `progress` on screen 3 | ≤ 90 |
| `questions.current_solution` | Label of `field-current-solution` | ≤ 120 |
| `questions.last_time` | Label of `field-last-time` | ≤ 120 |
| `questions.wants_call` | Label of `field-wants-call` | ≤ 120 |
| `questions.whatsapp` | Label of `field-whatsapp` | ≤ 40 |
| `questions.time_slot` | Label of `field-time-slot` | ≤ 40 |
| `questions.submit` | `questions-submit` | ≤ 24 |
| `questions.error` | `questions-error` | ≤ 120. One message for a missing answer and for a failed request |
| `done.title` | `done-title` | ≤ 70 |
| `done.notice` | `notice` | ≤ 200 |
| `done.next` | `next-steps` | ≤ 120 |
| `meta.title` | `<title>`, `og:title` | ≤ 60 |
| `meta.description` | `<meta name="description">`, `og:description` | 70 to 160 |

The limits of `hero.title`, `hero.subtitle`, the three buttons, `pains` and `steps` come from R2; `meta.*` from R30. The rest are fixed here so that `templates/landing-tests/` can build the template with the longest text allowed. Copy also follows R26 (`email.privacy` is a real privacy line) and R27 (no currency symbols, amounts or price words; no invented figures or testimonials).

## Files of a landing

The project lives in `landing/` at the root of the builder's repo.

| File | Changes per builder | Written by |
|---|---|---|
| The whole Astro project: `package.json`, `astro.config.mjs`, `src/layouts`, `src/components`, `src/scripts`, `src/styles`, `src/pages` | No | `scripts/copy-template.mjs` |
| `src/promise/*.astro`: the free screen, entry `Promise.astro` | Yes | Skill `landing`, from the approved boards ([guide](../../guides/promise-screen.md#4-from-the-boards-to-astro)) |
| `src/i18n/<locale>.json` | Yes | Skill `landing`, from the approved copy |
| `src/data/tokens.json` | Yes | Skill `landing`, from the approved design |
| `src/data/config.json` and `vercel.json` | Yes; they do not exist until publishing | `scripts/configure-landing.mjs` |

- Everything except `src/data/`, `src/i18n/`, `src/promise/`, `vercel.json` and the lockfile is identical to `templates/landing/` (R28). `--pm` therefore never edits `package.json`.
- `src/promise/` holds only `.astro` components written with token classes: no `style` attribute, `<style>`, `<script>`, `set:html` or `is:inline` (R14). `src/pages/index.astro` renders `src/promise/Promise.astro` as screen 1 and fails the build without it.
- Named files inside the skeleton: `src/styles/global.css`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/scripts/flow.ts`, `src/scripts/events.ts`, and the components `Brand`, `FilledButton`, `EmailScreen`, `QuestionsScreen`, `DoneScreen`, `DebugPanel`. The free screen uses `Brand` and `FilledButton` for the brand and the two buttons.
- Package scripts: `dev`, `build`, `preview`, run as `<manager> run <script>`. The build output is `dist/`; the page is `dist/index.html`.
- Publishing always uses `--cwd landing`. Publishing from the repo root would publish `.sbr/`.

### `config.json`

| Key | Value |
|---|---|
| `posthog_key` | The public project key of the builder's PostHog (`phc_…`) |
| `capture_path` | Absolute path on the landing's own origin, starting with `/`. `events.ts` sends each event with `POST` to exactly this path; `vercel.json` forwards it to the PostHog of the builder's region |

Without `config.json` nothing is sent: previews never pollute the verdict.

## URL parameters

| Parameter | Values | Effect |
|---|---|---|
| `src` | `v1`, `v2`, `v3`, `bio`, `friends`, `test` | Source of the visit, sent as `source` on every event. Missing or any other value counts as `untagged`. `test` is reserved for test visits and `verdict` excludes it |
| `debug` | `1` | Shows `debug-panel` |
| `screen` | `1` to `4` | Opens that screen directly. Only works without `config.json` |

## Plugin scripts

All live in `scripts/`, are `.mjs` with no dependencies, and are called from skills as `node "${CLAUDE_PLUGIN_ROOT}/scripts/<script>"`.

| Exit code | Meaning |
|---|---|
| 0 | Fine |
| 1 | A requirement fails |
| 2 | Wrong usage or environment |
| 3 | Chrome is not available |

| Script | Usage | What it does | Owner |
|---|---|---|---|
| `fill-artboards.mjs` | `fill-artboards.mjs <tokens.json> <copy.json> <promise-phone.html> <promise-desktop.html> <output>` | Wraps the two boards of the free screen in artboards with the direction's values, fills the templates of the fixed screens 2 to 4 of `templates/canvas/`, and writes them into the `<output>` folder | 0c |
| `copy-template.mjs` | `copy-template.mjs <destination> [--pm <manager>] [--example]` | Copies `templates/landing/` without `node_modules` and never overwrites `src/data/`, `src/i18n/` or `src/promise/`. `--pm` is `bun` (default), `pnpm`, `npm` or `yarn`. `--example` adds `templates/neutral-design/tokens.json` as `src/data/tokens.json`, `templates/example/es.json` as `src/i18n/es.json` and `templates/example/promise/` as `src/promise/` | 1 |
| `verify-design.mjs` | `verify-design.mjs <tokens.json> <copy.json> [<promise-phone.html> <promise-desktop.html>]` | Design requirements over values and text, and over the two boards of the free screen when they are given | 1b |
| `verify-landing.mjs` | `verify-landing.mjs <folder>` | The full gate over the project and its `dist/` | 1b |
| `capture.mjs` | `capture.mjs <url> <output> [--measure] [--gray]` | Screenshots with Chrome of the four screens at 375×667 and 1440×900, and with `--measure` the measurements on the drawn page. `--gray` takes them without color | 1b |
| `configure-landing.mjs` | `configure-landing.mjs <folder> --connections <json>` | Writes `src/data/config.json` and `vercel.json` for the region in `connections.json` | 2 |

Output:

- Both verifiers and `capture.mjs --measure` print one line per requirement to stdout, tab-separated: `<id>`, `<status>`, `<detail>`. `<id>` is `R1` to `R32`; `<status>` is `pass`, `fail` or `skip` (cannot be checked in this run). Any `fail` exits with 1.
- `capture.mjs` writes `screen-<n>-<width>x<height>.png` into `<output>`: eight files, `screen-1-375x667.png` to `screen-4-1440x900.png`. With `--gray` the names end in `-gray.png`.
