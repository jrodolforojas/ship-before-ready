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
<what the builder said, colors as hex values>

## Lo memorable
origin: derived
"<the line of the brief, quoted>" (promise del brief)

## Personalidad
origin: given
<one to three traits, in the builder's words>

## Tono y prohibidos
origin: derived
<light or dark, and the scene of use it comes from> (persona del brief)
Prohibido: <what the builder does not want to look like, or nada>
```

`origin` is `given` or `derived`. A derived answer quotes the line of the brief it came from.

## The promise screen

Three open questions, asked one at a time in plain text after the four above: `promise.show`, `promise.how`, `promise.emphasis`. They have no options, no examples and no suggested answer; the builder answers in their own words, or says to decide.

| Question | Derived from, when the builder leaves it to the plugin |
|---|---|
| What moment of the problem the visitor sees first | The sharpest `pain` of the brief and the scene where it happens |
| How it is shown | The scene of use and the personality traits: plain words, or words with a drawing made of shapes |
| What stands out after the headline | The memorable answer, or the `promise` of the brief |

### `.sbr/design/promise.md`

Working notes, in the builder's language. One section per question with the answer and its origin, the given answers word for word:

```markdown
# Primera pantalla

## Qué muestra primero
origin: given
<the builder's answer, word for word>

## Cómo se ve
origin: given
<the builder's answer, word for word>

## Qué destaca
origin: derived
"<the line of the brief, quoted>" (<the field it comes from>)
```
