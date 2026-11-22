---
name: start
description: Punto de entrada de Ship Before Ready. Da la bienvenida, mira en qué fase va la idea y corre la skill que sigue, una fase a la vez, esperando al builder entre una y otra.
argument-hint: "[locale]"
---

# start

Guide the builder through the whole journey, one phase at a time. This skill never does the work of a phase: it reads where the idea stands, runs the skill of the next phase and, when that one closes, asks before going on. The state files follow [the state contract](../../docs/contracts/state.md).

## Rules that hold for every step

- **One phase at a time.** Run one skill, let it finish, show where things stand and stop. Never chain two phases without the builder saying so.
- **Never skip a phase and never do its work here.** Each phase has its own skill and its own gates; if a phase is not finished, the next one does not start.
- **Read the state, do not trust memory.** Decide the next phase from the files in `.sbr/`, every time, even in the middle of a session.
- **Do not suggest answers.** Do not give examples of ideas, problems, segments or designs. The builder answers each skill with their own words.
- The project's language is the locale: `$ARGUMENTS` if it carries one (it matches `^[a-z]{2}(-[A-Z]{2})?$`), otherwise the `locale` of `.sbr/brief.md`, otherwise `es`. Speak to the builder in that language; in Spanish, address them as "usted". Fixed phrases come from `${CLAUDE_PLUGIN_ROOT}/locales/<locale>/start.json`, falling back to `${CLAUDE_PLUGIN_ROOT}/locales/es/start.json`; read that file first. Keys are written below as `section.key`.
- The builder's repo is the current working directory.

## 1. Where the idea stands

Read the files below in the current directory and take the first phase, in this order, whose condition is not met. That is the next phase.

| # | Phase | Skill | It is done when |
|---|---|---|---|
| 1 | `interview` | `ship-before-ready:interview` | `.sbr/brief.md` has `reviewer: approved` in its header |
| 2 | `rules` | `ship-before-ready:rules` | `.sbr/rules.md` and `.sbr/seal.json` both exist |
| 3 | `design` | `ship-before-ready:design` | `.sbr/design/choice.md` has `approved` in its header |
| 4 | `connect` | `ship-before-ready:connect` | `.sbr/connections.json` exists and has `verified_at` |
| 5 | `landing` | `ship-before-ready:landing` | `.sbr/landing.json` exists and has `url` |
| 6 | `video-scripts` | `ship-before-ready:video-scripts` | `.sbr/video-scripts.md` has `reviewer: approved` in its header |
| 7 | `verdict` | `ship-before-ready:verdict` | It is never done for good: it can run again whenever there are new numbers |

The accounts come late on purpose: the builder connects Vercel and PostHog only when there is an approved design to publish, never before defining the problem.

A file that exists but does not meet its condition means the phase was started and not finished: the next phase is still that one, and its skill knows how to resume.

## 2. Open

- If no phase is done, say `welcome` and then `journey.title` followed by the seven lines of `journey.phases`, numbered.
- Otherwise say `resume.title` and list every phase with `status.done` or `status.pending`, using its name from `journey.phases`.
- In both cases close with `next.ask`, with `{phase}` replaced by the name of the next phase and `{about}` by its line in `journey.about`. Wait for the builder.

If the builder asks for a phase other than the next one, say `next.out_of_order` with the name of the phase that is missing, and offer the next phase again. The only exception is `verdict` when phases 1 to 5 are done: it may run without the video scripts.

## 3. Run the phase

When the builder agrees, invoke the skill of that phase with the Skill tool, passing the locale as its argument. Follow that skill to its end; its own rules and gates apply, not this skill's.

If the Skill tool is not available, say `next.manual` with the command of that phase (`/ship-before-ready:<skill>`) and stop.

## 4. After the phase

Read the state again as in step 1.

- If the phase is now done, say `after.done` with its name, then `next.ask` for the following phase. Wait for the builder.
- If it is still not done, say `after.not_done` with its name and what its condition is still missing, in one line. Offer to run it again; do not move on.
- After `verdict`, say `after.verdict` and stop: the decision to go on belongs to the builder.
