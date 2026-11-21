# Events contract (PostHog)

The landing emits these events and `verdict` reads them. Event names, property names and values do not change without updating this contract.

Machine-readable copy: [`templates/contract.json`](../../templates/contract.json), keys `events` and `sources`. Edit this file only on `main`.

## Events

Five events. A complete visit emits them in this order.

| Event | When | Properties | The flow waits for the response |
|---|---|---|---|
| `$pageview` | The page loads | `source` | No |
| `sbr_cta_click` | Click on `cta` or `cta-closing` | `source`, `place` | No |
| `sbr_signup` | The email form is submitted and valid | `source`, `email` | Yes |
| `sbr_answers` | The questions form is submitted and valid | `source`, `current_solution`, `last_time`, `wants_call`, `whatsapp`, `time_slot` | Yes |
| `sbr_done` | Screen 4 is shown | `source` | No |

The email is sent when screen 2 ends, so it is saved even if the visitor leaves during the questions.

## Properties

| Property | Type | Value |
|---|---|---|
| `source` | string | See [Source](#source). On every event |
| `place` | string | `hero` for `cta`, `closing` for `cta-closing`. The button appears twice |
| `email` | string | The email as typed, trimmed |
| `current_solution` | string | Answer of `field-current-solution`, trimmed |
| `last_time` | string | Answer of `field-last-time`, trimmed |
| `wants_call` | boolean | Whether `field-wants-call` is checked |
| `whatsapp` | string | Value of `field-whatsapp`, trimmed. Empty string when `wants_call` is `false` |
| `time_slot` | string | Value of `field-time-slot`, trimmed. Empty string when left blank or when `wants_call` is `false` |

Property names are the `name` of the form fields ([landing.md](landing.md#fields)). Events carry these properties and nothing else of the plugin's own; PostHog's standard `$`-prefixed properties (such as `$current_url`) may be added.

`email` and `whatsapp` are personal data. They go only to the builder's own PostHog project.

## Source

`source` comes from the `src` parameter of the link.

| `?src=` | `source` | Counts as |
|---|---|---|
| `v1`, `v2`, `v3` | The same value | Cold traffic, one per video script |
| `friends` | `friends` | Friends and community, counted apart |
| `test` | `test` | Test visits. `verdict` excludes them |
| Missing, empty or anything else | `untagged` | Counted apart; not cold traffic |

The list is closed: a value outside it is recorded as `untagged`.

## Sending

- With `src/data/config.json`: `events.ts` sends each event with `fetch`, `POST`, JSON body, to `capture_path` on the landing's own origin. No third-party script is loaded and no request leaves the domain.
- Body: `{ "api_key": <posthog_key>, "event": <event>, "distinct_id": <id>, "properties": { … } }`, the format of PostHog's capture API.
- `distinct_id` is an anonymous UUID created on the first visit and kept in `localStorage` under `sbr_distinct_id`, so a returning browser counts as one visitor. The visitor is never identified by email.
- For `sbr_signup` and `sbr_answers` the flow waits for the response. A network error or a status outside 200 to 299 shows the error of that form, keeps the visitor on the screen and re-enables the button. The other three events never block.
- A 200 means the request arrived, not that PostHog stored the event; `landing` confirms storage with a test visit using `?src=test`.
- Without `config.json` nothing is sent and the forms advance as if the request had succeeded. Previews never pollute the verdict.
- With `?debug=1` every event, sent or not, is listed in `debug-panel` in order.

If the direct API gives trouble in step 2, the transport may change to PostHog's official snippet. Events, properties and values stay as written here.
