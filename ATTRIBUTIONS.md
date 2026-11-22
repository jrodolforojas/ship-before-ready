# Attributions

Ship Before Ready is MIT ([LICENSE](LICENSE)). Its landing requirements, its design guides and the rubric of its reviewer build on rules that other people worked out and published under open licenses. This file says whose they are.

**What was taken and what was not.** The rules were restated in this project's own words and reconciled with its contracts; thresholds such as 44 px, 4.5:1 or 45 to 75 characters are facts those sources report. No text, code, asset, font, script, hook, tool or binary of any of these projects is included here, none is installed, and none is a dependency, with one exception: the type library of Taste Skill, as data, described in its section below. The word lists in `scripts/verify-design.mjs` were written for this project in Spanish and English; the idea of a closed list, and several of its English entries, come from the sources below.

Where the rules live: [guides/landing-requirements.md](guides/landing-requirements.md) (the "Origin" column uses the abbreviations below), [guides/design-system.md](guides/design-system.md), [guides/promise-screen.md](guides/promise-screen.md), [guides/market-look.md](guides/market-look.md), [agents/design-reviewer.md](agents/design-reviewer.md), [agents/design-critic.md](agents/design-critic.md), and the three scripts that enforce them: `scripts/verify-design.mjs`, `scripts/verify-landing.mjs` and `scripts/capture.mjs`.

## Sources

### GS · gstack

- **Author and license:** Copyright (c) 2026 Garry Tan. MIT License.
- **Source:** <https://github.com/garrytan/gstack>, read at commit `64795163af36f9129b5d8b32627ace4f7ac39292` (version 1.102.0.0).
- **Read:** `review/design-checklist.md`, `design-consultation/` (the product context phase and the proposal section), `design-html/sections/craft.md`, `design-review/sections/craft-audit.md`.
- **Used for:** the single action per page and the hero that fits at 375×667 (R1, R3); short, specific copy and the headline that only fits this product (R2, R31); the five-second reading of the first view (R7); legible sizes, line height, measure and a contained font budget (R8 to R11); the catalog of defaults nobody chose, among them gradient text, glow, emoji as icons, violet by default, generic hero lines and generic button labels (R15); focus rings that are never removed, 44 px targets, no sideways scroll (R18, R19, R22); motion limited to opacity and transform under a reduced-motion rule (R23); the procedure for choosing typefaces from the reader's world, the three predictable looks, light or dark decided by the scene of use, and the question about the one thing to remember, in `guides/design-system.md` and in the design questions.

gstack credits two projects for part of that material. They were read only through gstack, at the commits gstack names in its own `NOTICE.md`:

#### Elaya · ai-design-skills and redesign-skill

- **Author and license:** Copyright (c) 2026 Elaya. MIT License.
- **Source:** <https://github.com/elayadesign/ai-design-skills> and <https://github.com/elayadesign/redesign-skill>.
- **Used for:** the structure of a page that asks for one action, claims that come only from what the user supplied, no invented figures or testimonials (R27), the states of the primary action: invalid, sending, failed, done (R21, R24), and a complete document head (R30).

#### impeccable

- **Author and license:** Copyright Paul Bakaus. Apache License 2.0, <https://www.apache.org/licenses/LICENSE-2.0>.
- **Source:** <https://github.com/pbakaus/impeccable>.
- **Used for:** the idea of several anti-pattern checks (gradient text, crushed tracking, justified text, tiny text, overused display faces, transitions on layout), the font-selection procedure and the calibration against three default looks. Everything was rewritten; this notice states the change as the license asks.

### RU · Refactoring UI, through wondelai's `refactoring-ui` skill

- **Author and license of the skill:** Copyright (c) 2025 Wondel.ai sp. z o.o. MIT License.
- **Source:** <https://github.com/wondelai/skills>, `refactoring-ui/SKILL.md`, read at commit `c5265583b1a9740f06831e1d3e89b35bba3eb430`.
- **Ideas originally from:** *Refactoring UI* by Adam Wathan and Steve Schoger, <https://www.refactoringui.com/>.
- **Used for:** emphasis through size, weight and color, with only the most important element using the three at once, and labels quieter than what they label (R5); designing in gray first and checking that the hierarchy survives without color (R6); a constrained spacing scale with more space between groups than inside them (R17); text 45 to 75 characters wide and forms 300 to 500 px wide (R10, R20); one filled button and text-only secondary actions (R1); near-black instead of pure black and tinted neutrals (R12); and the critic's checks of hierarchy, grouping by space and nesting in `agents/design-critic.md`.

### HIG · Apple's Human Interface Guidelines, through wondelai's `ios-hig-design` skill

- **Author and license of the skill:** Copyright (c) 2025 Wondel.ai sp. z o.o. MIT License.
- **Source:** <https://github.com/wondelai/skills>, `ios-hig-design/SKILL.md`, read at commit `c5265583b1a9740f06831e1d3e89b35bba3eb430`.
- **Ideas originally from:** Apple's Human Interface Guidelines, <https://developer.apple.com/design/human-interface-guidelines/>.
- **Used for:** the smallest screen first, 375 wide (R3); touch targets of at least 44 by 44 (R18); never conveying meaning through color alone (R16); a 4.5:1 floor for text (R13).

### WG · Web Interface Guidelines

- **Author and license:** Copyright (c) 2025 Vercel Labs. MIT License.
- **Source:** <https://github.com/vercel-labs/web-interface-guidelines>, `command.md`, read at commit `434b7f91364665f2f733b310ec54809bf8f37937`.
- **Used for:** fields with a label, the right `type`, `autocomplete` and `inputmode`, and no spellcheck on an email (R20); errors next to their field with the focus on the first one (R21); a visible focus state and hover, active and focus states stronger than rest (R22); `prefers-reduced-motion`, transform and opacity only, never `transition: all` (R23); a submit button that stays enabled until the request starts (R24); balanced headings (R10); a `theme-color` that matches the page background and zoom that is never blocked (R30, R17); specific button labels and error messages that say what to do next.

### TS · Taste Skill

- **Author and license:** Copyright (c) 2026 Leonxlnx. MIT License.
- **Source:** <https://github.com/Leonxlnx/taste-skill>, read as installed (version 2.5.1; the repository's `main` was at `f6b76575f949707b4e3c37cd86cb44b0b98643e8`). Read: `SKILL.md`, `references/system.md`, `references/layout-v4.md`, `references/copy-tells.md` and `library/type.json`.
- **Used for:** running text at 16 px or more in an ink at 7:1 with muted text at 4.5:1, and an ink that is never `#000` (R8, R12); no violet unless asked (R15); the tells of machine-written copy, among them stock phrases, empty intensifiers and invented specifics (R15, R27, R31); type that is dealt from a curated library rather than picked; and the critic's checks in `agents/design-critic.md` and section 5 of `guides/promise-screen.md`: equal edges and at most two left text lines, no centred block wider than half the page, no dead space beside a short text, the first view never ending on something cut, sentence case without tracked capitals, lines of about 62 characters at most, highlight by contrast and an accent kept small, one box deep, nothing tilted, staggered, cut or overlapping. Its rules on photographs, sections per screen, the navigation, effects, motion and page kinds do not apply to a one-screen promise with a fixed anatomy and were left out. Its checker, its gate and its session hook are not used.
- **Included as data:** `templates/type-library.json` is derived from its `library/type.json`: the pairings whose display face is not in this project's list of default faces and that reach a weight of 500, with their class, moods, families, weights and display tracking. Its page kinds, descriptions of what each pairing suits, mono faces and axes were left out. The MIT notice below covers it.

### Standards

- Contrast is the WCAG 2 ratio over sRGB relative luminance, from the W3C's Web Content Accessibility Guidelines, <https://www.w3.org/TR/WCAG22/>.

## The MIT License

gstack, Elaya's skills, wondelai's skills, Web Interface Guidelines and Taste Skill are each published under the MIT License, each with the copyright line given above:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## If something here is yours

If a rule is credited to the wrong source, or a source is missing, open an issue at <https://github.com/jrodolforojas/ship-before-ready/issues>.
