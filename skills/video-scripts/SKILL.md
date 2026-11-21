---
name: video-scripts
description: Escribe tres guiones de video, cada uno con una sola idea y su link rastreado. Muestra la idea de cada video antes de escribir, nombra el producto solo al cierre y como acceso anticipado, y pasa los guiones por un revisor sin contexto. El builder los graba y los publica él mismo.
---

# video-scripts

Write three video scripts into `.sbr/video-scripts.md`, each one about a single idea, so the builder can record them and send cold traffic to the landing. The file follows [the state contract](../../docs/contracts/state.md); the reviewer follows [the reviewers contract](../../docs/contracts/reviewers.md); the links follow [the events contract](../../docs/contracts/events.md#source).

## Rules that hold for every step

- **One video, one idea.** Each video has an SMP 1, one plain sentence that says what the video is about, and an SMP 2, the short list of the only things the video says. If the idea needs two sentences, it is two videos: pick one.
- **The video is about the problem.** The product is named only in the call to action, and always as early access to something that does not exist yet. A description of the product without its name ("una herramienta que…", "mi app") counts as naming it.
- **Never** write that the product is available, a price, a plan, a discount, or a figure or testimonial that nobody measured or said. The only figures allowed are the ones the builder gave, in the brief or in this conversation.
- **No target length.** Do not write, suggest or check a duration in seconds or a range of seconds, anywhere. A video lasts what its SMP needs; when a script grows long, there are two videos in it.
- **Write only what the brief and the builder said.** Do not invent a story, a customer or a result.
- **`reviewer: approved` is written only by the script, after the reviewer answers `approved`.** Never edit that line yourself and never review the scripts yourself in place of the agent.
- **You do not record, publish or configure anything.** No ManyChat setup, no posting. The builder does that.
- The project's language is the `locale` of the brief. Speak to the builder and write the scripts in that language; in Spanish, address the builder as "usted". Fixed phrases come from `${CLAUDE_PLUGIN_ROOT}/locales/<locale>/video-scripts.json`, falling back to `${CLAUDE_PLUGIN_ROOT}/locales/es/video-scripts.json`; read that file first and remember its path as the phrases file. Keys are written below as `section.key`.
- Run the script as `node "${CLAUDE_SKILL_DIR}/scripts/video-scripts.mjs" <command>`. It prints one JSON line. Exit code 0 is success, 1 is a failed check, 2 is wrong usage; on 1 or 2 read stderr.
- The builder's repo is the current working directory.

## 1. Before writing

1. Read `.sbr/brief.md`. If it is missing, say `missing.brief` and stop. If its header does not say `reviewer: approved`, say `missing.brief_pending` and stop.
2. Compute the links:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/video-scripts.mjs" links .sbr/landing.json
   ```

   If it fails, say `missing.landing` and stop. Otherwise it prints `bio_link`, `friends_link` and one link per script. Use these strings exactly; never build a link yourself.
3. Find the product's name, in this order: `brand` in `landing/src/i18n/<locale>.json`, the title of the brief's body, the builder (`missing.product_name`).
4. If `.sbr/video-scripts.md` exists with `reviewer: approved`, show the visits per link ([section 6](#6-visits-per-link)), say `resume.approved` and continue only if the builder wants to change the scripts.
5. If it exists with `reviewer: pending`, say `resume.pending`, keep the SMPs it already has and go on from step 3 or 4, whichever is missing.

## 2. Fix the idea of each video

Three videos, with these ids and angles. They never change.

| `id` | `angle` | What the video is | Comes from |
|---|---|---|---|
| `v1` | `pain` | "¿Le ha pasado que…?": the real problem and how it is solved | `pain` of the brief |
| `v2` | `top3` | Three common mistakes, problems or causes behind that pain | `current_solution` of the brief |
| `v3` | `founder` | The builder on camera, in their own voice, on why this matters to them | `promise` of the brief and the builder's own story |

For each video decide:

- **SMP 1:** one sentence, no adornment, about the problem. No "y además", no semicolon, no list. It does not name the product.
- **SMP 2:** two to four short points, the only things the video will say. Every later sentence of the script must fall under one of them. For `v2` the points are the three mistakes.

Then show them to the builder, before writing any script: say `smp.intro`, and for each video its `smp.videos.<id>` line, its SMP 1 and its SMP 2. If neither the brief nor the conversation carries the builder's own story, add `smp.founder_story`. Close with `smp.confirm`, **stop and wait** for the answer.

- If the builder changes an SMP, apply it and show that video again.
- If the builder tells their story, use it in `v3` in their words. If it changes the idea of `v3`, show its SMP again before writing. If they decline, write `v3` from the brief alone, with no personal anecdote.

## 3. Write the scripts

Each script has four parts, in this order:

1. **Reveal**, three pieces: the visual that catches the eye; the headline written on screen, which works as the H1 of the video and can be read at a glance; and the first sentence the person says. After the reveal the viewer knows what the video is about.
2. **Build up:** builds the need or the tension. Nothing that solves the problem appears here.
3. **Value:** everything the video resolves, inside SMP 2. It is useful to the viewer even if they never sign up: the way out is told as a practice, not as the product.
4. **Call to action:** sign up on the landing. The only place where the product is named, as early access to something that is being built.

The call to action is written in two forms, each a complete closing sentence that names the product as early access:

- **Profile link:** the sentence sends the viewer to the link in the profile.
- **Comment keyword:** the sentence asks the viewer to comment one word, and a message with the link of that video is sent to them. The keyword is one word of 3 to 20 capital letters or digits, tied to the idea of the video and different for each video. Write the message too: one or two sentences, early access, the link of that video.

Each script also carries:

- **Subtitles:** the spoken lines from the reveal sentence to the end of the value, exactly as said, cut into short lines, one idea per line.
- **Safe zone:** the fixed note.
- **Description:** two or three sentences for social search, about the problem, using the words the persona would type. It does not name the product and ends by pointing to the profile link. Under it, three to six search terms taken from the persona and the pain of the brief.

Write `.sbr/video-scripts.md` with this layout, always with `reviewer: pending`. Headings and labels come from the `document` section of the phrases file; copy them exactly, because the check reads them.

```markdown
---
reviewer: pending
locale: <locale>
bio_link: "<bio_link>"
friends_link: "<friends_link>"
scripts:
  - id: v1
    angle: pain
    smp: "<SMP 1 of v1>"
    keyword: <KEYWORD>
    link: "<link of v1>"
  - id: v2
    angle: top3
    smp: "<SMP 1 of v2>"
    keyword: <KEYWORD>
    link: "<link of v2>"
  - id: v3
    angle: founder
    smp: "<SMP 1 of v3>"
    keyword: <KEYWORD>
    link: "<link of v3>"
---

## v1

**<smp1>:** <SMP 1, the same sentence as in the header>

**<smp2>:**

- <point>
- <point>

### <parts.reveal>

- **<reveal.visual>:** <what is seen first>
- **<reveal.headline>:** <headline on screen>
- **<reveal.line>:** <first sentence said>

### <parts.build_up>

<spoken text>

### <parts.value>

<spoken text>

### <parts.call_to_action>

- **<call_to_action.profile>:** <closing sentence, profile form>
- **<call_to_action.profile_link>:** <bio_link>
- **<call_to_action.comment>:** <closing sentence, keyword form>
- **<call_to_action.message>:** <message with the link of this video>

<call_to_action_note>

### <extras.subtitles>

<subtitles_note>

<one short line per spoken line>

### <extras.safe_zone>

<safe_zone_note>

### <extras.description>

<description>

**<search_terms>:** <term>, <term>, <term>

## v2

## v3

## <links.title>

- <links.bio>
- <links.video> (one line per video)
- <links.friends>

<links.warning>

## <sources.title>

- <one line per entry of sources.lines>
```

- `v2` and `v3` have the same layout as `v1`.
- Header values are one line each. Put a string in double quotes when it contains `:` or `#`, and replace a double quote inside a value with a single one.
- The lines of `sources.lines` go in unchanged: they credit where the structure comes from.

Check the file and fix what it reports until it passes:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/video-scripts.mjs" check .sbr/video-scripts.md .sbr/landing.json "<phrases file>"
```

Say `review.written`.

## 4. Review

A round is one answer of the reviewer. There are at most three rounds.

1. Call the agent `ship-before-ready:script-reviewer` with the Agent tool (named `Task` in some versions). Its prompt is only the absolute path of the file, for example `Review the scripts at /path/to/repo/.sbr/video-scripts.md`. Give it nothing else: no brief, no summary of the idea, no hint of what you expect.
2. Pass the agent's answer, exactly as it came, to the script:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/video-scripts.mjs" record-review .sbr/video-scripts.md <<'REVIEW'
   <the agent's answer, verbatim>
   REVIEW
   ```

   It prints `{"result": …, "findings": […], "reviewer": …}`. With `approved` it writes `reviewer: approved`; with `rejected` it leaves `reviewer: pending`. If it exits with code 2 the answer did not follow the format: call the agent again once, with the same prompt, and do not count that as a round. If the format fails twice in a row, stop and show the builder the agent's answer.
3. `approved`: go to step 5.
4. `rejected`, in round one or two: say `review.rejected`, then one line per finding with its `review.findings.<code>` and the reviewer's sentence. Say `review.fixing`, rewrite only what the findings name, run the check again and start the next round. A finding of `smp_not_one_sentence` or `outside_smp` changes the idea of a video: show that video's new SMP to the builder before rewriting it.
5. `rejected` in round three: stop. Say `review.stopped`, list the findings the same way, and close with `review.stopped_next`. The file stays `reviewer: pending`. Do not offer to approve it another way.

## 5. Close

Say `done.title` and `done.detail`, then for each video one line with its id, its headline on screen and its keyword. Say `done.links` and show the five links. Close with `done.next`. Do not commit; the builder decides when.

### When the builder asks for a change

Any change to an approved file sets `reviewer: pending` again and goes through step 4.

If the builder asks for a line that breaks a rule (that the product is available, a price, an unmeasured figure, the product before the close), do not argue and do not refuse: say `request.warning` with the matching `request.rules.<code>`, write it as asked, and let the reviewer answer. When the reviewer rejects it, show the finding, put the script back as it was before that change, say `request.reverted`, and review again. That rejection does not count toward the three rounds.

## 6. Visits per link

Only when the skill runs again over an approved file. It is a courtesy: never block on it, never ask the builder to sign in here, and never judge the numbers; `verdict` does that.

1. Look for PostHog's `exec` tool: `mcp__plugin_ship-before-ready_posthog__exec`, then `mcp__plugin_posthog_posthog__exec`, then `mcp__posthog__exec`. If tools are loaded on demand, search for it with ToolSearch (`posthog exec`). If there is none, or `.sbr/connections.json` is missing, say `visits.unavailable` and go on.
2. Make the builder's project the active one with `call switch-project {"projectId": <posthog_project_id>}`, the id from `.sbr/connections.json`.
3. Run:

   ```text
   call execute-sql {"query": "SELECT properties.source AS source, count(DISTINCT distinct_id) AS visitors FROM events WHERE event = '$pageview' AND properties.source IN ('bio', 'v1', 'v2', 'v3', 'friends') GROUP BY source"}
   ```

   If any call fails, say `visits.unavailable` and go on.
4. Say `visits.title` and one `visits.row` per source, in the order `bio`, `v1`, `v2`, `v3`, `friends`, with the label of `visits.sources` and the raw count; a source with no rows counts 0.

The structure of the scripts (SMP; reveal, build up, value, call to action) and the three kinds of video were taught by Guillie Collado to the author of this plugin. It is not verified in a public source.
