# Prompt for one direction agent

The main thread sends this text to one general-purpose agent per direction, in parallel, after replacing every `{placeholder}`. The agent knows nothing else: give it only this.

---

You write the values of one design direction for a landing page: one `tokens.json` file and one short `concept.md`. Two other agents write the other two directions at the same time; you will not see them. Your row of axes is what keeps the three different, so follow it exactly.

Read, in this order:

1. `{plugin_root}/guides/design-system.md`, whole. It is how to do this job.
2. `{plugin_root}/docs/contracts/tokens.md`: the schema and every allowed range.
3. `{repo}/.sbr/brief.md`: the product and its persona.
4. `{repo}/.sbr/design/answers.md`: what the builder answered.
5. `{repo}/{copy}`: the copy every direction uses. Do not change it.

The world of the subject, as the main thread wrote it:

{world}

Your direction is **{letter}**, named "{name}". Its fixed axes:

| Axis | Value |
|---|---|
| Composition | {composition} |
| Scheme | {scheme} |
| Accent hue | {hue} |
| Type pairing | {pairing} |
| Category code | {category_code} |
| Leading trait | {trait} |
| Decor | {decor} |
| Palette | {palette} |

Rules:

- `composition`, `scheme`, the two font families and `decor` are exactly the ones above. The accent's HSL hue stays within 10° of {hue}, unless the palette row gives the builder's colors: then those colors are the palette, with `palette_source: builder`, and only their lightness may move to pass contrast.
- `name` is "{name}".
- Design in gray first, as the guide says, then add the accent.
- Both families must appear, spelled exactly, in {fonts_list}. Use only weights that the family has in upright style.
- Write `{repo}/.sbr/sketches/{letter}/tokens.json`, then run:

  ```bash
  node "{plugin_root}/scripts/verify-design.mjs" "{repo}/.sbr/sketches/{letter}/tokens.json" "{repo}/{copy}"
  ```

  Exit 1: fix what each `fail` row names and run it again, up to eight runs. Exit 2: the call or the JSON is wrong; fix it. Never change the copy file to make a row pass: a copy failure is reported, not fixed.
- Then write `{repo}/.sbr/sketches/{letter}/concept.md` in {language}, under 25 lines: the name; the idea in two sentences; palette, type pairing and composition, each in one line with the line of the brief or of the answers it comes from; and, when the category code is "follows" or "departs", one line that says so and cites `.sbr/design/market.md`.
- Write nothing else and touch no other file.

Answer with exactly these lines and nothing more:

```text
direction: {letter}
verify: pass | fail
runs: <number of verifier runs>
accent: <hex of accent>
fonts: <display family> + <body family>
failing: <ids of failing rows, or none>
```
