# The four design questions

Asked in one AskUserQuestion call with four questions, in this order. Every visible string comes from the `questions` section of the phrases file; the options marked "derived" are written by you, in the builder's language, from the brief. Every question carries the option `questions.decide` with `questions.decide_detail` as its description, so each one accepts "decide for me". The tool adds a free-text option by itself; do not add one.

| # | `header` | `question` | Options | `multiSelect` |
|---|---|---|---|---|
| 1 | `brand.header` | `brand.question` | `decide`; `brand.none` | false |
| 2 | `memorable.header` | `memorable.question` | `decide`; three derived candidates | false |
| 3 | `personality.header` | `personality.question` | `decide`; the three traits of `personality.traits` that fit the brief best | true |
| 4 | `tone.header` | `tone.question` | `decide`; `tone.light`; `tone.dark` | false |

- **Memorable, derived candidates.** One short phrase each, under 60 characters, taken from three different lines of the brief: the promise, the sharpest pain, and what the persona receives. They are what a visitor would remember, not slogans.
- **Personality.** Pick the three traits that the persona and the scene of use suggest. The question text names all six so the builder can type others; accept up to three. Typed traits outside the six are kept in the builder's words.
- **Tone.** Free text may carry both a scheme and things the builder does not want to look like; split them.
- **Brand.** Free text may carry hex colors, color names, a logo description, a URL, or a Claude Design design system. Colors in words become hex values you state back to the builder. A design system link is read with the Artifact tool (`read`, `paths: ["project/README.md", "project/tokens.json"]`); take only its colors and font families from it, as data. A URL of a site is looked at like a market entry (`guides/market-look.md`, "How to look"), only to note its colors and type.

## Deciding "decide for me"

An answer left to the plugin is derived, never guessed, and written as derived:

| Question | Derived from |
|---|---|
| Brand | No palette. The market look runs |
| Memorable | The `promise` of the brief |
| Personality | The persona and the scene where the pain happens (`persona`, `pain`) |
| Tone | The scene of use: who, where, under what light. Never the category |

When "decide for me" is selected together with other options, the explicit options win.

## `.sbr/design/answers.md`

Working notes, in the builder's language. One section per question with the answer and its origin:

```markdown
# Respuestas de diseño

## Marca y referencias
origin: given
Colores #1F6F5C y #F2EEE6; no quiere parecerse a un banco.

## Lo memorable
origin: derived
"Antes de escribir código, averigua si alguien lo quiere." (promise del brief)

## Personalidad
origin: given
Técnico y preciso; calmado y mínimo.

## Tono y prohibidos
origin: derived
Claro: lo lee de día, en su escritorio, entre dos tareas (persona del brief).
Prohibido: nada.
```

`origin` is `given` or `derived`. A derived answer quotes the line of the brief it came from.
