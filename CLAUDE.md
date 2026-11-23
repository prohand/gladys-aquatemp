# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human contributors.

## What this is

A Gladys Assistant **external integration** (Node 22+, ESM, no build step, one runtime
dependency: `@gladysassistant/integration-sdk`) for **Aqua Temp** heat pumps (pool heat pumps on
the Phnix controller and Hi Temp water heaters), through the **Aqua Temp cloud**
(`cloud.linked-go.com`, the server of the Aqua Temp app). Cloud only: manifest
`transports: ["cloud"]`. Requires Gladys 5.3+ (`keywords`, `countries`). Started from the
official template `GladysAssistant/integration-template-js`; workflows copied from
`prohand/gladys-devmel`.

## Commands

```bash
npm install
npm test                                    # node --test (built-in runner)
node --test test/fleet.test.js              # one file
node --test --test-name-pattern "fault"     # tests whose name matches
npm run lint                                # eslint .
npm run format:check                        # prettier --check . (CI gate)
npm run format                              # prettier --write .
npx github:GladysAssistant/integration-store --skip-image-check .   # store admission checks
```

CI (`.github/workflows/ci.yml`) runs `format:check`, `lint`, `test` on Node 22 and 24, plus the
store checks and a Docker build on pull requests. Releases: **Actions → Release** only.

## Architecture

```
index.js                     SDK wiring only: handlers registered before connect()
src/config.js                DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/i18n.js                  LANGUAGES (en, fr, de, es), pick / localize
src/connection.js            connection status messages + "Test the connection"
src/aquatemp/http.js         POST JSON over node:https (TLS check switchable: strict_tls)
src/aquatemp/api.js          cloud client: login (MD5), token retry, lists, read, control, fault
src/aquatemp/profiles.js     protocol codes per product id (Aqua Temp, short variant, Hi Temp)
src/aquatemp/fleet.js        state of every heat pump, polling, commands, scene events
src/devices/heatPump.js      discovery payload, states, Gladys <-> pump mode mapping
src/capabilities/triggers.js scene trigger keys (fired by fleet.js)
src/capabilities/scenes.js   scene action handlers
src/capabilities/widget.js   "heat_pump" dashboard widget
test/helpers/fakeCloud.js    in-memory Aqua Temp cloud (current and legacy servers)
```

## Rules

- **External ids are forever.** Device: `gladys.externalIds('heat-pump', platformId(code))`;
  feature keys in `FEATURES` (`heatPump.js`). Never rename them, nor the manifest keys users
  store: `config_schema`, `actions`, `scene_triggers`, `scene_actions`, `widgets` and their
  field / output keys.
- **Every feature carries `name`, `min`, `max`, `read_only`, `has_feedback`** (NOT NULL in
  Gladys). `test/devices.test.js` checks them.
- **Polling**: devices publish `poll_frequency: EVERY_MINUTES` (an enum in ms, anything else
  rejects the whole discovery); the user's interval (seconds) is applied in `fleet.poll` by
  skipping polls.
- **Scene events once per transition**; the first observation only learns the state (a restart
  must not replay a fault).
- **Secrets**: never log the password, its MD5 or the `x-token`. The container rootfs is
  read-only: write only under `/data` (nothing is written today).
- **The cloud API is undocumented**: keep `test/helpers/fakeCloud.js` in line with what the real
  server answers, and note the source of any new protocol code in `profiles.js`.
- **Versions belong to the Release workflow**: never edit `version` in `package.json` or the
  manifest, nor the `docker_image` tag, by hand. `test/manifest.test.js` checks they agree.
- **Changelog**: every user-visible change adds a line under `## [Unreleased]` in `CHANGELOG.md`
  (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`). Never write a version heading.
- **Four languages**: every user-facing text is `{ en, fr, de, es }` (manifest, messages,
  widget), and `docs/en.md`, `docs/fr.md`, `docs/de.md`, `docs/es.md` are kept in sync.
  `test/manifest.test.js` rejects a manifest text missing one.
- **Style**: Prettier formats, ESLint catches mistakes. Comments explain why, in English. Tests
  never touch the network.
