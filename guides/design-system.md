# Design system: from the brief to three directions

How the `design` skill turns an approved brief and four answers into three directions that are different on purpose and that pass the gate before anything is drawn. The main thread reads sections 1 and 2; the agent that writes one direction reads the whole guide.

A direction is one `tokens.json` ([tokens contract](../docs/contracts/tokens.md)) and the two boards of its free screen 1 ([promise-screen.md](promise-screen.md)). Screens 2 to 4 never change; they take the skin of the tokens. Everything the builder can change is in those files and in the copy. Numbers below repeat the contract so they are at hand; `templates/contract.json` is what the verifier reads.

Sources of these rules are in [ATTRIBUTIONS.md](../ATTRIBUTIONS.md).

## Inputs and who wins

1. What the builder brought: brand colors, references, things they do not want to look like.
2. The one thing a visitor must remember.
3. The personality traits, up to three.
4. The brief: `persona`, `pain`, `current_solution`, `promise`.
5. `promise.md`: what the builder wants the promise screen to show of the problem, and how.
6. `market.md`, when the market look ran.

An earlier line beats a later one. An answer the builder left to the plugin is derived from the brief and written down as derived.

## 1. Name the world of the subject

Before any value, write four or five lines about the world the persona is in when the pain happens: where they are, what they hold and read, the tools, the objects, the signs, the materials. Take from that world two or three colors that exist in it, the character of its lettering, and whether its objects are sharp or soft, dense or airy.

- Start from this persona, not from the category of the product and not from its obvious opposite. A tool for a bakery draws on flour sacks, proofing baskets and a chalk menu, not on "food is orange".
- Three looks show up when nobody decided. Use one only if the brief asks for it in words: a cream ground with a serif headline and a terracotta accent; a near-black ground with a neon accent and glowing edges; newspaper hairlines with an italic serif headline and tiny tracked monospace labels.
- Light or dark comes from the scene of use: who, where, under what light. Never from the category.
- If a decision cannot cite a line of the brief, it is decoration. Every decision in `system.md` carries its citation (R31).

## 2. Fix the axes before writing values

The main thread fills this table in `.sbr/design/concepts.md` and gives each agent only its own row. That is what makes the three directions differ (criterion B1) instead of converging.

| Axis | Values | Rule across the three |
|---|---|---|
| Layout idea | One line: where the headline sits, how the pains are shown, what leads the eye after the button | All three different: no two share their blocks order, grouping, layout and fills |
| Scheme | `light`, `dark` | From the scene of use; may repeat |
| Accent hue | A hue in degrees | At least 40° apart from the other two, or a different scheme |
| Type pairing | Kind of pair and the two families | No pair repeated |
| Category code | follows, departs, ignores | With `market.md`: one follows it and one departs from it on purpose |
| Leading trait | One of the builder's traits | A different one leads each direction |

- Hue is the HSL hue. The distance between two hues is the smaller of `|a − b|` and `360 − |a − b|`.
- If the builder brought brand colors, the three directions keep them and differ in everything else; the hue rule does not apply and each file says `palette_source: builder`.
- A violet accent (hue 250° to 300° with saturation of 15% or more) is allowed only when the builder asked for it.
- Name each direction for its idea, in the builder's language, in 40 characters or fewer. No direction is presented as the recommended one.

## 3. Design in gray first

Work in this order and do not choose the accent until step 3 reads well without it.

1. The type scale and the weights (section 6).
2. The four spacing levels (section 7).
3. The neutrals: `canvas`, `surface`, `ink`, `ink_muted`, `line`. Check the hierarchy: the headline is the only text that is at once the largest, the heaviest and in the strongest ink; subtitle, labels and small text step back through `ink_muted` and size.
4. Only then `accent` and `on_accent`, then `focus` and `danger`.

Color added to a hierarchy that already works in gray makes it stronger. Color used to create the hierarchy fails R6. Neutrals may carry a little of the accent's hue so they do not look lifeless; the neutral reference design is pure gray on purpose.

## 4. Color: nine roles

| Token | Role | Minimum contrast |
|---|---|---|
| `canvas` | Page background | |
| `surface` | Fields, cards, debug panel | |
| `ink` | Primary text | 7:1 on `canvas` and `surface` |
| `ink_muted` | Secondary text, labels, placeholders | 4.5:1 on both |
| `accent` | Fill of the one filled button, the checkbox, figures | 3:1 on both |
| `on_accent` | Text on the button | 4.5:1 on `accent` |
| `line` | Field and card borders, dividers | 3:1 on both |
| `focus` | Focus ring | 3:1 on both |
| `danger` | Error text, border of an invalid field | 4.5:1 on both |

- Six-digit hex only. `ink` is never `#000000`.
- `scheme: light` needs a `canvas` lighter than `ink`; `dark`, darker.
- `line` at 3:1 is a mid tone, not a faint hairline: the border is what shows a field is a field.
- An accent of middle lightness tends to fail on both sides: too light against the canvas, too dark for white text and too light for dark text. Move its lightness until both pairs pass; keep the hue.
- `accent` is never a text color, and `ink` is never drawn on `accent`.
- When `accent` is red, make `danger` clearly darker; the error also has its text (R16).
- Builder colors: keep the hue. If one fails as a fill, change only its lightness until it passes, and tell the builder which value moved.

Do not estimate contrast. Write the values and run the verifier.

## 5. Type pairing

Fonts come from the Google Fonts catalog and are served by the landing itself. `display` draws the headline and the headings; `body` draws everything else.

1. From the world of section 1, name the lettering the persona already trusts: a newspaper, a terminal, a product label, a school notebook, a road sign. Say its tone in two words.
2. Choose the kind of pair: one family in two weights; a display with character over a quiet body; two classes that contrast (serif with sans, slab with sans, condensed with humanist).
3. Shortlist three candidates for each role and choose the one closest to that tone.
4. Leave out the faces everyone reaches for by default, unless the builder names one. As the display voice: Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Raleway, DM Sans, Plus Jakarta Sans, Space Grotesk, Outfit, Playfair Display, Fraunces, Lora, Syne, IBM Plex Sans, Instrument Sans. Several of them are fine as body when the concept says why. Novelty and script faces are out in any role.
5. Check the exact family name in the catalog, that the weights you need exist in upright style, and that the Latin subset covers the language of the copy. The build downloads the family by that name: a wrong name breaks the build, not the verifier.
6. Stay in budget: at most two families and four (family, weight) pairs, and every listed weight used by a style of that role. A usual budget is one display weight and two body weights, the second one for the button.
7. `fallback` is `sans-serif`, `serif` or `monospace`, the class of the family. There are no italics.

## 6. The scale

Sizes are CSS pixels. Each style has a phone size and a desktop size (from 768 px).

| Style | Family | `size` | `size_desktop` | `line_height` | `font_weight` | `letter_spacing` em |
|---|---|---|---|---|---|---|
| `title` | display | 28 to 36 | 36 to 64 | 1.05 to 1.25 | 400 to 900 | −0.04 to 0.02 |
| `heading` | display | 20 to 32 | 22 to 40 | 1.05 to 1.25 | 400 to 900 | −0.04 to 0.02 |
| `lead` | body | 16 to 20 | 16 to 24 | 1.45 to 1.65 | 300 to 500 | −0.01 to 0.02 |
| `body` | body | 16 to 18 | 16 to 20 | 1.45 to 1.65 | 300 to 500 | −0.01 to 0.02 |
| `small` | body | 14 to 16 | 14 to 16 | 1.45 to 1.65 | 300 to 500 | −0.01 to 0.02 |
| `button` | body | 16 to 18 | 16 to 20 | 1 to 1.5 | 500 to 800 | −0.01 to 0.08 |
| `label` | body | 14 to 16 | 14 to 16 | 1.2 to 1.5 | 400 to 600 | −0.01 to 0.08 |

1. Choose the body size for each viewport.
2. Choose one ratio per viewport: 1.25 for a calm page, 1.333 for more contrast. The two viewports may differ.
3. Take `heading` and `title` from the steps of that ratio, inside their ranges. Every size larger than the body must be a step, within ±4%, so whole pixels are fine.
4. The headline is at least 1.75 times the body on phone and 2 times on desktop, and strictly the largest size. Its weight is the highest, ties allowed.
5. `lead` equals the body or sits one step above it. `small` and `label` sit below the body and are not on the scale.
6. No size is smaller on desktop than on phone.

| Body | Steps at 1.25 | Steps at 1.333 |
|---|---|---|
| 16 | 20 · 25 · 31.3 · 39.1 · 48.8 · 61 | 21.3 · 28.4 · 37.9 · 50.5 |
| 17 | 21.3 · 26.6 · 33.2 · 41.5 · 51.9 | 22.7 · 30.2 · 40.3 · 53.7 |
| 18 | 22.5 · 28.1 · 35.2 · 43.9 · 54.9 | 24 · 32 · 42.6 · 56.8 |
| 19 | 23.8 · 29.7 · 37.1 · 46.4 · 58 | 25.3 · 33.8 · 45 · 60 |
| 20 | 25 · 31.3 · 39.1 · 48.8 · 61 | 26.7 · 35.5 · 47.4 · 63.1 |

On phone the range of the headline leaves one step per ratio: with a body of 16, 31 or 28; with 17, 33 or 30; with 18, 35 or 32.

Tighten the tracking of large display type a little (−0.01 to −0.03 em) and leave running text at 0.

## 7. Space, shape, measure and motion

| Token | Range | Reading |
|---|---|---|
| `spacing.section` | 64 to 128 | Between the bands of the first screen |
| `spacing.block` | 32 to 64 | Between blocks inside a band or a screen |
| `spacing.group` | 16 to 32 | Between groups: one field and the next, a text and its button |
| `spacing.item` | 4 to 16 | Inside a group: a label and its field |
| `shape.radius_control` | 0 to 24 | Buttons and fields |
| `shape.radius_card` | 0 to 32 | Cards |
| `shape.line_width` | 1 to 4 | Every border and divider |
| `shape.shadow_card` | `x` 0 to 12, `y` 0 to 24, `blur` 0 to 48, `opacity` 0 to 1 | Black only; with any blur, opacity is at most 0.25 |
| `measure.prose` | 45 to 75 | Width of running text in `ch` |
| `measure.page` | 960 to 1280 | Width of the page content |
| `measure.motion_duration` | 0 to 400 | Every transition, in ms |

- The four spacing levels are multiples of 4 and strictly decreasing, so there is always more space between groups than inside them. A calm page takes the upper half of each range; a dense, technical one the lower half.
- Start with more space than feels necessary and take away.
- Corners say character: 0 to 4 reads exact and serious, 8 to 12 neutral, 16 and above warm and friendly.
- A shadow is depth, so it has an offset. A soft shadow stays faint; a hard one (`blur: 0`) may be solid. Opacity 0 is a flat page.

## 8. The free screen

- Screen 1 is designed freely for each direction, as two boards: [promise-screen.md](promise-screen.md) is how, and what it always has. Screens 2 to 4 have no layout to decide.
- Its layout follows the direction's layout idea and the builder's answers in `promise.md`. Drawings are optional `figure` elements, flat and drawn only with tokens. A drawing never fixes an empty section; better copy and grouping do.

These never appear, so no concept promises them: gradients on text or buttons, glows, emoji as icons, glass panels, decorative blobs, icons inside colored circles, a pill label above the headline, a menu, prices, testimonials, logos, counters.

## 9. The copy

One copy file serves the three directions, so the builder compares design and not wording. Its keys and limits are in the [landing contract](../docs/contracts/landing.md#copy-keys).

| Key | What it says | Limit |
|---|---|---|
| `hero.title` | The promise of the brief, as an outcome | 70 |
| `hero.subtitle` | Who it is for and what changes for them | 160 |
| `cta`, `email.submit`, `questions.submit` | A verb and what the click gets | 24 |
| `pains` | One to three situations the persona recognizes, in their words | 90 each |
| `steps` | Exactly three things they will receive | 90 each |
| `closing` | The promise in one line | 70 |
| `done.notice` | That it does not exist yet, in plain words | 200 |
| `email.privacy`, `footer.privacy` | What the email is used for | 160 |
| `questions.*` | The three questions of the brief, unchanged | 120 |
| `meta.title`, `meta.description` | For search results and shared links | 60; 70 to 160 |

- Test the headline: put another product's name next to it. If it still works, it is not specific enough (R31).
- Plain text only: no HTML, no Markdown, no line breaks, no empty strings. `progress` keeps `{current}` and `{total}`.
- An error says what happened and what to do next. One message serves an invalid value and a failed request.
- No prices in any form, and no figure, testimonial or guarantee that the brief does not give (R27).
- No emoji.

The verifier matches the three lists below as whole words, ignoring case and accents, which is why they are written without accents.

**Banned phrases (R15), Spanish:** `bienvenido a`, `bienvenida a`, `bienvenidos a`, `descubre el poder`, `desata el poder`, `libera el poder`, `desbloquea el poder`, `desbloquea tu potencial`, `libera tu potencial`, `todo en uno`, `solucion integral`, `al siguiente nivel`, `revoluciona`, `revolucionamos`, `revolucionario`, `revolucionaria`, `innovador`, `innovadora`, `disruptivo`, `disruptiva`, `de vanguardia`, `de ultima generacion`, `de clase mundial`, `sin esfuerzo`, `sin friccion`, `sin fricciones`, `sin complicaciones`, `en el mundo actual`, `en el mundo de hoy`, `en la era digital`, `el futuro de`, `el futuro es hoy`, `el futuro ya esta aqui`, `di adios a`, `dile adios a`, `unete a miles`, `miles de usuarios`, `miles de clientes`, `miles de empresas`, `no busques mas`, `imagina un mundo`, `en solo unos clics`, `en pocos clics`, `al alcance de tu mano`, `al alcance de un clic`, `cambia las reglas del juego`, `un antes y un despues`, `sinergia`, `empodera`, `empoderamos`, `lider del mercado`, `numero uno en`, `la mejor solucion`, `el mejor del mercado`, `optimiza tu flujo de trabajo`, `agiliza tu flujo de trabajo`

**Banned phrases (R15), English:** `welcome to`, `unlock the power`, `unleash the power`, `unlock your potential`, `all-in-one`, `all in one`, `one-stop shop`, `next level`, `next-level`, `next-gen`, `next generation`, `cutting-edge`, `cutting edge`, `state-of-the-art`, `state of the art`, `world-class`, `world class`, `best-in-class`, `best in class`, `game-changer`, `game changer`, `game-changing`, `revolutionize`, `revolutionary`, `seamless`, `seamlessly`, `effortless`, `effortlessly`, `supercharge`, `streamline your`, `elevate your`, `empower`, `empowers`, `the future of`, `say goodbye to`, `join thousands`, `trusted by`, `imagine a world`, `look no further`, `at your fingertips`, `in just a few clicks`, `in today's fast-paced world`, `ready to transform`, `synergy`

**Generic button labels (R15), when they are the whole label:** `empezar`, `comenzar`, `empieza ahora`, `comienza ahora`, `saber mas`, `mas informacion`, `leer mas`, `continuar`, `siguiente`, `enviar`, `aceptar`, `ok`, `clic aqui`, `haz clic aqui`, `get started`, `start now`, `learn more`, `read more`, `continue`, `next`, `submit`, `send`, `click here`

**Price words (R27):** `precio`, `precios`, `gratis`, `gratuito`, `gratuita`, `gratuitos`, `gratuitas`, `descuento`, `descuentos`, `tarifa`, `tarifas`, `suscripcion`, `suscripciones`, `mensualidad`, `mensualidades`, `sin costo`, `costo cero`, `reembolso`, `reembolsos`, `plan basico`, `plan pro`, `plan premium`, `plan mensual`, `plan anual`, `planes y precios`, `oferta de lanzamiento`, `oferta especial`, `price`, `prices`, `pricing`, `discount`, `discounts`, `for free`, `free trial`, `free plan`, `free forever`, `subscription`, `subscriptions`, `refund`, `refunds`, `money-back`, `money back`

R27 also refuses any currency symbol and any amount next to a currency word or code. Words about effort are not price words: "barato", "costó" and "sigue costando semanas" pass.

The reviewer looks for what a list cannot hold: verbs that would sell any product ("potencia", "impulsa", "transforma", "optimiza"), adjectives standing in for a fact, a run of slogan-like fragments, exclamation marks.

## 10. Verify, then draw

1. Write the `tokens.json` of the direction.
2. Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/verify-design.mjs" <tokens.json> <copy.json>`.
3. Exit 1: change what each `fail` row names and run it again. Exit 2: the call or a file is wrong, not the design. Reading the rows is explained in [landing-requirements.md](landing-requirements.md#reading-the-output).
4. A direction is drawn only after exit 0 (criterion B2).
5. Then the boards of screen 1 are written and checked the same way, with the two boards added to the call.
6. With the three directions passing, the main thread checks B1: no shared composition between the boards, no repeated pair of families, accents 40° apart or different schemes.

Every change the builder asks for during iteration goes through the same loop before the canvas is repainted.

## 11. `system.md`

Written at the final approval, in the builder's language. One short section per decision: the world, scheme, palette, type, scale, space and shape, and the free screen (what it shows of the problem and how). Each one states the value and quotes the line of the brief that justifies it. The reviewer checks those quotes against the brief (R31).
