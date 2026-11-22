# Landing tests

Value sets that exercise the skin of `templates/landing/`: the fixed screens 2 to 4 and the example free screen of `templates/example/promise/`, which every set copies into `src/promise/`. Each set is a `tokens.json` and a language file; `sets.json` lists them.

| Set | Tokens | Copy | What it proves |
|---|---|---|---|
| `approved` | `templates/neutral-design/tokens.json` | `templates/example/es.json` | The example page builds and passes the gate |
| `limits` | `limits/tokens.json` | `limits/es.json` | Largest values and longest copy the contracts allow: the first view stays whole and nothing overflows at 375 px |
| `elasticity-brisa`, `elasticity-contraste`, `elasticity-gaceta` | `elasticity/*.json` | `templates/example/es.json` | Three opposite skins on the same screens |

`limits/tokens.json` takes every maximum that still passes `verify-design.mjs`: title 36/64 px at line height 1.25 and weight 900, body 18/20 px at 1.65, spacing 128/64/32/16, line width 4, radii 24/32, the strongest soft shadow, `prose` 75, `page` 1280. Every string of `limits/es.json` is at its length limit or a few characters under it.

## Run

```bash
node templates/landing-tests/build.mjs <output> [set...]
```

For each set it copies the template with `scripts/copy-template.mjs`, writes the tokens and the copy, installs with bun, builds, and runs `scripts/verify-landing.mjs`. It prints one line per set (`<name>`, `pass` or `fail`, folder) and exits with 1 if any set fails. Building needs the network for Google Fonts.

To look at one set and measure it:

```bash
cd <output>/<set> && bun run preview
node scripts/capture.mjs http://localhost:4321/ <captures> --measure
```

## Captures

`captures/screens.jpg` shows screens 2 to 4 as step 1c approved them. Screen 1 has no template capture: each builder's free screen is compared with its own canvas.
