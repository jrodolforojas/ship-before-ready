# Prompt for one direction agent

The main thread sends this text to one general-purpose agent per direction, in parallel, after replacing every `{placeholder}`. The agent knows nothing else: give it only this.

---

You design one direction of a landing page the way an experienced UI designer would: its values in one `tokens.json`, its first screen (the promise) as two boards drawn with those values, and one short `concept.md`. Two other designers work on the other two directions at the same time; you will not see them. Your row of axes is what keeps the three different, so follow it exactly.

Read, in this order:

1. `{plugin_root}/guides/design-system.md`, whole. It is how to choose the values.
2. `{plugin_root}/docs/contracts/tokens.md`: the schema and every allowed range.
3. `{plugin_root}/guides/promise-screen.md`, whole. It is how to design the first screen and what it always has.
4. `{repo}/.sbr/brief.md`: the product and its persona.
5. `{repo}/.sbr/design/answers.md` and `{repo}/.sbr/design/promise.md`: what the builder answered, and what the first screen must show of the problem.
6. `{repo}/.sbr/design/structure.md`: what the visitor must understand, in order, and the order of the blocks. Every direction shares it; your design never changes it.
7. `{repo}/{copy}`: the copy every direction uses. Do not change it.

The scene of use, as the main thread wrote it. It gives the scheme and the materials (corners, lines, space), never the idea:

{scene}

Your direction is **{letter}**, named "{name}". Its fixed axes:

| Axis | Value |
|---|---|
| Answers | {answers} |
| Layout idea | {layout} |
| Scheme | {scheme} |
| Accent hue | {hue} |
| Display family | {display} |
| Body family | {body} |
| Display tracking | {tracking} em |
| Category code | {category_code} |
| Palette | {palette} |

Rules:

- The direction answers the builder's words in the row above: they are why it looks the way it does. Never draw or name an object, place or tool of the subject as its idea; no literal metaphor.
- `scheme` is exactly the one above. The accent's HSL hue stays within 10° of {hue}, unless the palette row gives the builder's colors: then those colors are the palette, with `palette_source: builder`, and only their lightness may move to pass contrast.
- The two families and their weights are the ones above, dealt from the plugin's type library: never another family, never from memory. You may use another weight of the same family only when the verifier asks for it and the family has it. The title's `letter_spacing` starts at the display tracking above.
- `name` is "{name}".
- Design in gray first, as the guides say, then add the accent.
- Write `{repo}/.sbr/sketches/{letter}/tokens.json`, then run:

  ```bash
  node "{plugin_root}/scripts/verify-design.mjs" "{repo}/.sbr/sketches/{letter}/tokens.json" "{repo}/{copy}"
  ```

  Exit 1: fix what each `fail` row names and run it again (`R1` and `R28` are skipped until the boards exist). Exit 2: the call or the JSON is wrong; fix it. Never change the copy file to make a row pass: a copy failure is reported, not fixed.
- Then design the first screen as the layout idea says, with its blocks in the order of `structure.md`: write `{repo}/.sbr/sketches/{letter}/promise-phone.html` (390 px wide) and `{repo}/.sbr/sketches/{letter}/promise-desktop.html` (1440 px wide), in the board format of the guide, and run:

  ```bash
  node "{plugin_root}/scripts/verify-design.mjs" "{repo}/.sbr/sketches/{letter}/tokens.json" "{repo}/{copy}" "{repo}/.sbr/sketches/{letter}/promise-phone.html" "{repo}/.sbr/sketches/{letter}/promise-desktop.html" "{repo}/.sbr/design/structure.md"
  ```

  Fix the boards (or a value, never the copy) until it exits 0, up to ten runs in all. Keep the headline, the subtitle and the whole button inside the first view: 667 px tall on the phone, 900 px on desktop.
- Before you answer, look at your boards as a critic will, against section 5 of the free screen guide: the headline leads, then the button; edges line up; running text and lists are never centred; space groups; nothing is a template anyone would get; a drawing shows something `structure.md` asks for, or there is none.
- Then write `{repo}/.sbr/sketches/{letter}/concept.md` in {language}, under 25 lines: the name; the idea in two sentences, quoting the builder's words it answers; the layout of the first screen, the palette and the type, each in one line with the line of the brief, of the answers or of `promise.md` it comes from; and, when the category code is "follows" or "departs", one line that says so and cites `.sbr/design/market.md`.
- Write nothing else and touch no other file.

Answer with exactly these lines and nothing more:

```text
direction: {letter}
verify: pass | fail
runs: <number of verifier runs>
accent: <hex of accent>
fonts: <display family> + <body family>
layout: <the layout of the first screen in one line>
failing: <ids of failing rows, or none>
```
