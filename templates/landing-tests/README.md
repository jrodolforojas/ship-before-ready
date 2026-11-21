# Landing tests

Value sets that exercise the three compositions of `templates/landing/` (step 1c). Each set is a `tokens.json` and a language file; `sets.json` lists them, with an optional `override` of `composition` and `decor`.

| Set | Tokens | Copy | What it proves |
|---|---|---|---|
| `approved-centered`, `approved-split`, `approved-editorial` | `templates/neutral-design/tokens.json` | `templates/example/es.json` | The page matches the approved artboards (`centered` without figure, `split` with `shapes`, `editorial` with `grid`) |
| `limits-centered`, `limits-split`, `limits-editorial` | `limits/tokens.json` | `limits/es.json` | Largest values and longest copy the contracts allow: the first view stays whole and nothing overflows at 375 px |
| `elasticity-brisa`, `elasticity-contraste`, `elasticity-gaceta` | `elasticity/*.json` | `templates/example/es.json` | Three opposite designs look like three different products |

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

`captures/` holds the comparison sheets of the pull request of step 1c: each approved artboard next to the built page at 390 and 1440 px, the widths that were not drawn (768 and 1024), the limits at 375 px with the first view marked, screens 2 to 4, and the three opposite designs.
