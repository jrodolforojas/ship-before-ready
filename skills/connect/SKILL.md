---
name: connect
description: Verifica las conexiones del builder antes de empezar. Pregunta el gestor de paquetes, comprueba Node, la sesión de Vercel y la de PostHog, publica una página de prueba, envía un evento de prueba y guarda todo en .sbr/connections.json sin pedir ni guardar llaves.
---

# connect

Leave the builder with a package manager chosen, a Vercel session that can publish and a PostHog session that can read, both proven with a real probe. The result is `.sbr/connections.json` in the builder's repo, following [the state contract](../../docs/contracts/state.md).

## Rules that hold for every step

- **Never ask for a key, never store a secret, never show a key.** The builder signs in to Vercel with its CLI and to PostHog in the browser. The only key that exists is the public project key (`phc_…`), which you read from the PostHog session and pass to the script; never print it in a message.
- If the builder pastes any key, do not use it and do not write it anywhere. Say the phrase `posthog.key_not_needed` and continue.
- When a session is missing, say the exact phrase for it, **stop, and wait** for the builder to say it is done. Then check again. Do not continue past a missing session and do not offer a way around it.
- Speak to the builder in Spanish, addressing them as "usted". Every fixed phrase comes from `${CLAUDE_PLUGIN_ROOT}/locales/es/connect.json`; read that file first. Keys are written below as `section.key`. Replace `{placeholders}` with real values.
- Run the script as `node "${CLAUDE_SKILL_DIR}/scripts/probe.mjs" <command>`. It prints one JSON line. Exit code 0 is success, 1 is a failed check, 2 is a usage or environment error; on 1 or 2 read stderr.
- The builder's repo is the current working directory. If `.sbr/connections.json` already exists, read it and offer its values as the defaults, then verify everything again.

## 1. Package manager and Node

1. Ask with AskUserQuestion, using `package_manager.question` and the four options of `package_manager.options` in this order: `bun`, `pnpm`, `npm`, `yarn`. Use each option's `label` and `description` as written; bun is the recommended one and goes first.
2. Run `<manager> --version`. If the command is missing, say `package_manager.missing` and wait; the builder installs it or picks another one.
3. Run `node --version`. If Node is missing say `node.missing`; if it is older than 22.23.4 say `node.too_old`. Wait either way.

## 2. Vercel

1. Run `vercel --version`. If the CLI is missing, ask with AskUserQuestion using `vercel.install_question` and `vercel.install_options`. The install command depends on the manager chosen in step 1:

   | Manager | Command |
   |---|---|
   | bun | `bun add -g vercel` |
   | pnpm | `pnpm add -g vercel` |
   | npm | `npm install -g vercel` |
   | yarn | `yarn global add vercel` (yarn 1 only; with yarn 2 or newer use `npm install -g vercel`) |

   Install only after the builder accepts. If they decline, wait until they say it is installed.
2. Run `vercel whoami`. If it reports no session, say `vercel.sign_in` and wait. Check again when the builder comes back.
3. Run `vercel teams list`. With one team, use it. With several, ask which one with `vercel.team_question`. The team's slug is `vercel_team`; with no team at all it is `none`. Pass `--scope <slug>` to every later `vercel` command when there is a team.
4. Propose a project name: the name of the repo folder in lowercase, with every run of characters outside `a-z`, `0-9` and `-` replaced by one `-`, trimmed to 100 characters. Ask with `vercel.project_question`, offering the proposed name as the first option; the builder may type another. A name must match `^[a-z0-9][a-z0-9._-]{0,99}$`; otherwise say `vercel.project_invalid` and ask again. This is `vercel_project`.

## 3. PostHog

The plugin declares PostHog's MCP server under the name `posthog` in its `.mcp.json`. Its tools are named `mcp__plugin_ship-before-ready_posthog__<tool>`. If the builder also has PostHog's own plugin, Claude Code may connect through that one instead, and the same tools are named `mcp__plugin_posthog_posthog__<tool>`. Use whichever is connected; they are the same server and the same session.

1. Look for the tool `exec` of that server (`mcp__plugin_ship-before-ready_posthog__exec`, then `mcp__plugin_posthog_posthog__exec`, then `mcp__posthog__exec`). If tools are loaded on demand, search for it with ToolSearch, using the server's name as the query (`plugin:ship-before-ready:posthog`, then `plugin:posthog:posthog`). If no PostHog tool is available after searching, there is no session in this conversation, whatever a listing made elsewhere says:
   - The server's name is the one this session reports as needing authentication. If the session names none, use `plugin:ship-before-ready:posthog`.
   - Say `posthog.sign_in` with that name as `{server}` and wait. The desktop app has no `/mcp`; there the builder signs in with `claude mcp login <server>`, so the phrase gives both ways.
   - When the builder comes back, search for the tool again with the server's name: after a sign-in that search is what reconnects the server, without a restart.
2. `exec` takes `command`, one string, and `context`, a few words on why you call it; `context` is required and never carries names, emails or keys. Its answer brings a `conversation_id`: leave it out on the first call and **pass that same `conversation_id` on every later call.** Without it PostHog refuses `switch-organization` and `switch-project`, and every other call reads whichever project the builder has open in PostHog. A switch only changes this conversation; it does not move the builder inside PostHog. The commands used here:

   | Purpose | `command` |
   |---|---|
   | List the organizations of the signed-in user | `call organizations-get` |
   | Make one organization the active one | `call switch-organization {"orgId": "<id>"}` |
   | List the projects of the active organization | `call projects-get` |
   | Make one project the active one | `call switch-project {"projectId": <id>}` |
   | Read one project, with its public key | `call project-get {"id": <id>}` |
   | Get the address of a page of the PostHog app | `call generate-app-url {"url": "<path>", "params": {}}` |
   | Run a query | `call execute-sql {"query": "<HogQL>"}` |
   | Read the input of any tool | `info <tool>` |

   Some clients expose the tools directly instead of through `exec` (`…__projects-get`, `…__switch-project`, `…__execute-sql`). Then call them with the same input.
3. Choose the project that receives this idea's events. Two products never share a project: `verdict` counts every `sbr_` event it finds there.
   1. Read every project the session reaches: list the organizations and, for each one, switch to it and list its projects. A project carries the id of its organization, not its name; take the name from the list of organizations. Leave out the projects with `is_demo: true`. With no project at all, say `posthog.no_projects` and wait.
   2. If `.sbr/connections.json` names a `posthog_project_id` that is in that list, say `posthog.saved_project` and use it.
   3. Otherwise look at `ingested_event`, which stays `false` until a project receives its first event.
      - One project in all, and it has never received an event: the builder is new to PostHog. Say `posthog.single_project` and use it, without asking.
      - Several projects, and exactly one has never received an event: say `posthog.empty_project` and use it.
      - Several that have never received an event: ask which one with `posthog.project_question`, by name and organization.
   4. If every project already receives events, the builder uses PostHog for something else. Ask with AskUserQuestion using `posthog.busy_question`. The first option is `posthog.busy_options.new_organization`; after it comes one option per project, up to three, built from `posthog.busy_options.existing`.
      - **New organization.** PostHog's free plan allows one project per organization, and this session cannot create organizations, so the builder creates it in the browser. Get the address with `call generate-app-url {"url": "/create-organization", "params": {}}`, say `posthog.create_organization` with it, and wait. When the builder comes back, read the projects again as in item 1 and use the one that has never received an event; the session sees the new organization without signing in again. If there is none, say `posthog.organization_missing` and wait again.
      - **An existing project.** Use it and say `posthog.shared_project`.
4. Switch to the chosen project. PostHog moves the conversation to its organization too, so the project's id is enough. That id, as a string of digits, is `posthog_project_id`.
5. Read the public project key with `call project-get {"id": <id>}`: it is the field `api_token` and must start with `phc_`. `projects-get` does not carry it.
6. Find the region with the script, which asks both PostHog regions which one accepts that key:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/probe.mjs" region <public_key>
   ```

   The answer is `posthog_region`, `us` or `eu`. If it fails, the key is not a valid project key: read it again from the session.

## 4. Probe

1. If `.sbr/landing.json` exists, a landing is already live on that Vercel project: say `vercel.landing_live`, **do not publish the probe page**, keep the `probe_url` already saved in `.sbr/connections.json` (or the landing's `url` if there is none), and go to item 5.
2. Prepare the probe page in a temporary folder outside the repo:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/probe.mjs" prepare --locale es
   ```

   It answers `{"probe_id": "<uuid>", "folder": "<folder>"}`. Keep both: `probe_id` identifies this run in the page and in the event.
3. Say `probe.publishing` and publish that folder to production. Vercel previews can ask for a login, so the probe goes to production; it only says "Pronto".

   ```bash
   vercel deploy --cwd "<folder>" --project <vercel_project> --create-if-missing --prod --yes
   ```

   **Always publish with `--cwd` pointing at the probe folder. Never publish from the root of the builder's repo:** that would publish `.sbr/`.
4. The command prints the deployment URL. Read the project's production address with `vercel inspect <deployment URL>` and take the alias ending in `.vercel.app` (normally `https://<vercel_project>.vercel.app`). Check that it serves this run's page:

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/probe.mjs" page <url> <probe_id>
   ```

   It retries for about 40 seconds. If it fails on the alias, try the deployment URL. If both fail, say `probe.page_failed` and wait. The address that passed is `probe_url`.
5. Send the probe event, `sbr_probe`, with `source: test` and `probe_id` as its `distinct_id` ([events contract](../../docs/contracts/events.md#probe-event)). When item 1 skipped the page, create the id with `node -e "console.log(crypto.randomUUID())"`.

   ```bash
   node "${CLAUDE_SKILL_DIR}/scripts/probe.mjs" send <posthog_region> <public_key> <probe_id>
   ```

   Say `probe.event_sent`.
6. Look the event up through the PostHog session, in the project chosen in step 3:

   ```sql
   SELECT event, distinct_id, properties.source AS source, timestamp
   FROM events
   WHERE event = 'sbr_probe' AND distinct_id = '<probe_id>' AND timestamp > now() - INTERVAL 1 HOUR
   LIMIT 1
   ```

   A 200 from PostHog means the request arrived, not that the event was stored, and storing takes a few seconds. If the query returns no row, wait 10 seconds and run it again, up to three times. If the row appears, the event is seen. If it still returns nothing, say `probe.event_pending` and go on: PostHog accepted the event and can take minutes to show it. Do not make the builder wait for it; `landing` checks the five real events after it publishes.

## 5. Save

When the page answered and PostHog accepted the probe event, whether or not the row was seen yet:

```bash
node "${CLAUDE_SKILL_DIR}/scripts/probe.mjs" save . \
  --package-manager <manager> \
  --posthog-region <posthog_region> \
  --posthog-public-key <public_key> \
  --posthog-project-id <posthog_project_id> \
  --vercel-project <vercel_project> \
  --vercel-team <slug or none> \
  --probe-url <probe_url>
```

The script writes `.sbr/connections.json` with the keys of the contract and `verified_at`, and refuses any key that is not a public project key. Do not write that file by hand and do not add keys to it.

Close with the phrases of `done`: `done.title`, `done.page`, then `done.event` if the row was seen or `done.event_pending` if it was not, then `done.saved` and `done.next`. Do not commit; the builder decides when.
