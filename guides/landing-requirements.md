# Landing requirements

The 32 requirements every landing built by the plugin meets, and how each one is checked. Skills read this guide; the builder never does. Thresholds that are also names or ranges live in the contracts ([tokens](../docs/contracts/tokens.md), [landing](../docs/contracts/landing.md)) and in `templates/contract.json`, which the scripts read. Where this guide and a contract disagree, the contract wins: stop and report it.

Sources of the rules are in [ATTRIBUTIONS.md](../ATTRIBUTIONS.md).

## Who checks what

| Tool | Key | Reads | Call |
|---|---|---|---|
| `verify-design.mjs` | `design` | One `tokens.json` and one language file, before anything is drawn | `node "${CLAUDE_PLUGIN_ROOT}/scripts/verify-design.mjs" <tokens.json> <copy.json>` |
| `verify-landing.mjs` | `landing` | The Astro project and its `dist/`, after the build. It repeats every `design` check on `src/data/tokens.json` and `src/i18n/<locale>.json` | `node "${CLAUDE_PLUGIN_ROOT}/scripts/verify-landing.mjs" <folder>` |
| `capture.mjs --measure` | `capture` | The page drawn by Chrome | `node "${CLAUDE_PLUGIN_ROOT}/scripts/capture.mjs" <url> <output> --measure` |
| `design-reviewer` agent | `reviewer` | What no script can decide: values, copy and `system.md` before drawing; screenshots after building | See [agents/design-reviewer.md](../agents/design-reviewer.md) |

For the reviewer's page mode, run `capture.mjs` twice into the same folder, once without and once with `--gray`, and give it the sixteen images: R6 compares each color screenshot with its gray twin.

### Reading the output

Each script prints 32 lines to stdout, `R1` to `R32` in order, tab-separated: `<id>`, `<status>`, `<detail>`.

- `pass`: this tool checked its part of the requirement and it holds.
- `fail`: the detail names every problem, separated by `; `, with the token or key, its value and the threshold.
- `skip`: this tool did not check it in this run. The detail says who does, or why it could not.

| Exit code | Meaning | What the skill does |
|---|---|---|
| 0 | No `fail` | Go on |
| 1 | At least one `fail` | Fix what the details name and run again. Never draw, show or publish with a `fail` |
| 2 | Wrong arguments, a file that is missing or is not JSON, a project that is not built, a page that does not open | Fix the call or the environment. It is not a design problem |
| 3 | `capture.mjs` found no Chrome | Say it in one line and use the manual checklist below |

A requirement **passes** when every tool in its "Checked by" cell reported `pass`. It **fails** when any of them reported `fail`. Otherwise it is **skipped**. `.sbr/landing.json` records the three lists.

A file with the wrong shape is not an exit 2: a `tokens.json` with a missing or unknown key, a wrong type, a value outside an enum or a color that is not six-digit hex fails **R14**, and a language file with a missing or unknown key, an empty string, HTML, Markdown, a line break or a wrong `lang` fails **R32**. The rows that depend on that file are then `skip` until its shape is right.

## The table

**When:** *design* is before drawing, over values and copy; *page* is after building; *template* is a property of the skeleton, proven in the template's own steps and repeated at the gate. **Origin:** RU Refactoring UI, WG Web Interface Guidelines, HIG Apple's Human Interface Guidelines, TS Taste Skill, GS gstack, SBR this plugin's own design.

| # | Requirement | Threshold | Checked by | When | Origin |
|---|---|---|---|---|---|
| R1 | One action | One `h1`, the `title`. The only buttons are the filled ones of the contract: `cta` and `cta-closing` on screen 1, one submit on screens 2 and 3, none on screen 4. No other text on an `accent` fill. No menu, no link | design, landing | design, template | GS, RU |
| R2 | Short copy | Headline ≤ 70 characters, subtitle ≤ 160, buttons ≤ 24, one to three pains and exactly three steps of ≤ 90, and the limit of every other key of the contract | design, landing | design | GS |
| R3 | Whole first view | At 375×667 and 1440×900 the headline, the subtitle and the whole button are inside the window without scrolling | capture | page | GS, HIG |
| R4 | A scale with a ratio | Per viewport, every size above the body is the body times 1.25^k or 1.333^k within ±4%; the headline is at least 2 times the body on desktop and 1.75 on phone; no size shrinks on desktop | design, landing | design | GS |
| R5 | Emphasis by three levers | Only the headline has the largest size, the heaviest weight and the strongest ink together; labels and small text are smaller than the body, the lead is not; weights stay in their ranges | design, landing | design | RU |
| R6 | Works in gray | The hierarchy holds in a screenshot without color | reviewer | page | RU |
| R7 | Five-second test | From the first view alone a stranger says who it is for and what it promises; the eye goes headline, button, subtitle | reviewer | page | GS |
| R8 | Legible sizes | Body ≥ 16 px, small text and labels ≥ 14 px, field text in the body style; every size inside its range | design, landing | design | GS, TS |
| R9 | Line height | 1.45 to 1.65 for body, lead and small; 1.05 to 1.25 for headline and headings; the ranges of the contract for button and label | design, landing | design | GS |
| R10 | Comfortable reading | `prose` between 45ch and 75ch; page width and tracking in their ranges; text never justified; headings balanced | design, landing | design, template | GS, HIG, WG |
| R11 | Contained type | At most two families and four (family, weight) pairs, every listed weight used; font files served by the landing itself | design, landing | design, page | GS |
| R12 | Contrast of the values | `ink` ≥ 7:1 on `canvas` and `surface`; ≥ 4.5:1 for `ink-muted`, `danger` and `on-accent` on `accent`; ≥ 3:1 for `line`, `focus` and `accent`; ink never pure black; `scheme` matches the values | design, landing | design | TS, GS |
| R13 | Real contrast | Every drawn text, placeholder and typed text ≥ 4.5:1 on the background actually behind it; ≥ 3:1 from 24 px | capture | page | GS |
| R14 | Tokens only | `tokens.json` has the closed shape of the contract; no class sets a color, size, space, radius, shadow, border or duration outside the token utilities; no value in square brackets | design, landing | design, template | GS |
| R15 | No clichés | Accent outside violet unless the builder asked; shape values in range, no glow; no gradient in the built styles; no emoji, no phrase of the banned list, no generic button label | design, landing | design, page | GS, TS |
| R16 | Never color alone | Errors carry their text and the sending state has its own text | landing | template | HIG |
| R17 | Space with a hierarchy | Four levels, multiples of 4, strictly decreasing, each in its range; zoom is never blocked | design, landing | design, template | RU, GS |
| R18 | Touch size | Every control is at least 44×44 px and 8 px from the next one | capture | page | HIG, GS |
| R19 | No overflow | No sideways scroll and no cut text at 375, 768, 1024 and 1440 px, on the four screens | capture | page | GS |
| R20 | Proper fields | Visible label in the label style; `type`, `autocomplete`, `inputmode`, `maxlength` of the contract; no spellcheck on the email; `lang` set; forms 300 to 500 px wide | landing, capture | template | WG, RU |
| R21 | Useful errors | `role="alert"`, inside the form, after its fields and before the button; the form carries `novalidate`; an empty submit shows the error, marks the field and moves the focus to it | landing, capture | template | WG |
| R22 | Keyboard and states | Tab reaches every control; focus ring ≥ 2 px; entering a screen moves the focus to its title; the button changes under the pointer | capture | page | WG |
| R23 | Contained motion | `motion_duration` ≤ 400 ms; a reduced-motion rule; only opacity and transform move; nothing lasts more than 400 ms or loops forever | design, landing | design, template | GS, WG |
| R24 | Honest submit | The submit button starts enabled and has a sending text; a valid submit either advances or shows the error | landing, capture | template | WG |
| R25 | Visible notice | The "it does not exist yet" notice is on the final screen in the body style and in `ink`; at 375×667 it fits in the first view at body size and 4.5:1 | landing, capture | page | SBR |
| R26 | Privacy | A privacy line next to the email, not empty, within its limit, drawn at 14 px or more | design, landing | design | SBR |
| R27 | No prices, nothing invented | No currency symbol, amount of money or price word; no figure, testimonial or guarantee the brief does not give | design, landing, reviewer | design | SBR |
| R28 | Skeleton intact | The boards of the free screen and the built page have the hooks and screens of the contract, and the two boards show the same texts in the same styles; outside `src/data/`, `src/i18n/`, `src/promise/`, `vercel.json` and the lockfile the project is byte-identical to the template; `src/promise/` holds `.astro` components with token classes only | design, landing | design, page | SBR |
| R29 | No third parties, light | The built page requests nothing from another domain; its own HTML, CSS and JavaScript weigh at most 100 KB | landing | page | SBR |
| R30 | Complete head | Title ≤ 60 characters, description 70 to 160; `<title>`, description, `og:title`, `og:description` equal to the copy; `theme-color` equal to `canvas` | design, landing | design, page | WG |
| R31 | Made for this idea | The headline would not work for another product; every decision of `system.md` cites a line of the brief | reviewer | design | GS |
| R32 | Copy outside the code | The language file has exactly the keys of the contract, as plain text; every text hook shows exactly its key; no visible text or text attribute exists that is not in the language file | design, landing | design, template | SBR |

## What each failure asks for

The gate never changes an approved design. When a row fails, the skill names it and proposes the smallest change; in `landing` that change goes back to `design` for approval.

| Row | Smallest change |
|---|---|
| R2, R26, R30 | Rewrite the key the detail names within its limit. Do not cut meaning to fit: say less |
| R4 | Move the size to one of the two "nearest steps" in the detail, or change the body so the others land on the scale |
| R5 | Restore the order: headline largest and heaviest, lead at or above the body, small and label below it. On a board, draw the block the detail names in one of the styles it lists |
| R8, R9, R10, R17, R23 | Bring the value inside the range in the detail |
| R11 | Drop a weight no style uses, or move a style to a weight already listed |
| R12 | Darken or lighten the foreground of the pair in the detail until it reaches the ratio; keep the hue |
| R14 | Remove the unknown key or fix the type; on a board, replace the hand-written value with its token; in `src/promise/`, replace the class or the style with its token utility |
| R15 | Move the accent out of 250° to 300°, or ask the builder and set `palette_source: builder`; rewrite the phrase with what the product does |
| R27 | Remove the price talk. The plugin never fixes, suggests or tests prices |
| R3, R13, R18, R19, R25 | These fail only on the drawn page. Propose the token that causes it (a smaller headline, a darker muted ink, more `item` spacing, shorter copy) and send it back to `design` |
| R1, R28, R32 on a board | Fix the board: the hook, the element or the text the detail names. The free screen keeps its anatomy whatever its layout |
| R1, R5, R14, R28, R32 naming `src/promise/` or a hook of screen 1 on the page, while the boards pass | The free screen was programmed apart from the boards. Fix the component in `src/promise/` until `landing.mjs match` passes |
| R1, R16, R20, R21, R22, R24, R28, R29, R32 elsewhere on the page | The skeleton was edited or the template is broken. Restore the file from the template; never patch the builder's copy by hand |

## Without Chrome

When `capture.mjs` exits 3, say in one line that Chrome is missing and give the builder this list. They open the preview at 375 px wide and answer each line:

1. On the first screen, without scrolling: do you see the whole headline, the subtitle and the whole button? (R3)
2. Is any text hard to read against its background, on any of the four screens? (R13)
3. Can you tap every button and field comfortably with a thumb, without hitting its neighbor? (R18)
4. Does any screen scroll sideways or cut a word? Check 375 px and a full desktop window. (R19)
5. Send the email form empty: does the message appear under the field, and does the cursor go to the field? (R21)
6. Go through the four screens with Tab and Enter only: can you always see where the focus is? (R22)
7. On the final screen, without scrolling: do you see the notice that it does not exist yet? (R25)

Record every line the builder did not confirm as `skipped` in `.sbr/landing.json`, never as passed.

## Limits of the scripts

These parts of the requirements are not checked by any script. A rule that cannot be decided by reading text or measuring the page without false positives is not in the scripts.

- **R5.** "At most three levels of text per screen" holds by construction: the seven text styles draw in two inks and two weight families. Nothing counts levels on the page.
- **R10.** "Paragraphs aligned to the left" belongs to each free design and is approved on the canvas. The scripts only refuse justified text and unbalanced headings.
- **R12, R13 on the free screen.** The boards check the token pair of every text against its nearest fill; a text placed over a figure by absolute position is not caught on the board, only measured on the page.
- **Fidelity of the free screen.** `landing.mjs match` compares the texts of screen 1 in order with their style, color and fill. Layout, sizes of blocks and drawings are compared by the builder, who sees the page next to the canvas.
- **R11.** A family name that is not in the Google Fonts catalog is not caught here: the build fails when it tries to download it.
- **R13, R22.** Contrast is measured at rest. The pointer state is measured on `cta` only, and the pressed state is not measured.
- **R15.** The scripts match a closed list of phrases. Words that fit any product but have honest uses ("potente", "simple", "transforma tu") go to the reviewer under R31.
- **R20.** On phone the scripts only check that the form is not wider than 500 px: a 375 px window cannot hold 300 px plus the side padding of every design.
- **R24.** Without `config.json` nothing is sent, so the path where the request fails cannot run in the gate. `landing` covers it with the test visit after publishing.
- **R27.** The scripts cannot tell an invented figure from a real one, and price words are a closed list: a product whose subject is prices or payments will trip it and needs the builder to rephrase. Figures, testimonials and guarantees are compared with the brief by the reviewer.
- **R28.** Any file a package manager writes besides its lockfile is reported as a file outside the template.
- **R6, R7, R31.** Judgment. They belong to the reviewer.
