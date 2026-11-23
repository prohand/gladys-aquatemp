# Gladys Aqua Temp

External integration for [Gladys Assistant](https://gladysassistant.com) that controls
**Aqua Temp** heat pumps — pool heat pumps on the Phnix controller and **Hi Temp** water heaters —
through the **Aqua Temp cloud**, the server of the Aqua Temp mobile app.

Built from the official template
[`GladysAssistant/integration-template-js`](https://github.com/GladysAssistant/integration-template-js)
with the JavaScript SDK
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

User documentation: [English](docs/en.md) · [Français](docs/fr.md) · [Deutsch](docs/de.md) ·
[Español](docs/es.md).

## Features

| Surface                     | What                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| Devices (one per heat pump) | Power, mode (cooling / heating / auto), setpoint, silent mode, water in / out, outdoor °C  |
| Transport badge             | `cloud`, or `unreachable` when the cloud lost the heat pump (manifest `transports: cloud`) |
| Scene triggers              | `fault_detected`, `fault_cleared`, `connection_changed`                                    |
| Scene actions               | `set_mode`, `set_silent_mode`, `read_status`                                               |
| Dashboard widget            | `heat_pump`: live temperatures, status list, Turn on / off and Refresh buttons             |
| Configuration screen button | `test_connection`                                                                          |
| Languages                   | English, French, German, Spanish (manifest, messages, widget, docs)                        |
| Catalog                     | categories `climate`, `leisure`; search keywords; 20 countries                             |

Requires **Gladys ≥ 5.3.0** (the manifest declares `keywords` and `countries`).

## How it talks to the cloud

The Aqua Temp cloud API is not public. The integration uses the same calls as the app and the
community clients (the [Home Assistant integration](https://github.com/radical-squared/aquatemp)
is the reference): login with the e-mail and the MD5 of the password, an `x-token` header,
the account's own and shared heat pumps, a read of "protocol codes" (`Power`, `Mode`, `R02`,
`T02`…) and a control call writing them. Two server generations exist (current, and legacy for
accounts created with app 1.5.8 or older); the **Account type** setting picks one. The codes
depend on the product (`src/aquatemp/profiles.js`).

The certificate of the cloud is checked by default. The **Check the cloud certificate** option
exists because other clients had to skip it; see [SECURITY.md](SECURITY.md).

## Project structure

```
.
├─ index.js                          # SDK wiring (no cloud logic)
├─ src/
│  ├─ config.js                      # defaults + normalization
│  ├─ i18n.js                        # en / fr / de / es helpers
│  ├─ connection.js                  # status messages, "Test the connection"
│  ├─ aquatemp/
│  │  ├─ http.js                     # HTTPS POST JSON
│  │  ├─ api.js                      # Aqua Temp cloud client
│  │  ├─ profiles.js                 # protocol codes per product
│  │  └─ fleet.js                    # heat pumps state, polling, commands, scene events
│  ├─ devices/heatPump.js            # discovery payload + states
│  └─ capabilities/                  # scene triggers, scene actions, widget
├─ docs/{en,fr,de,es}.md             # user documentation (re-hosted by Gladys)
├─ test/                             # node --test, fake Gladys (SDK) + fake Aqua Temp cloud
├─ gladys-assistant-integration.json # manifest
├─ Dockerfile                        # Node 24 Alpine, read-only rootfs ready, non-root
├─ CHANGELOG.md · SECURITY.md · CLAUDE.md
└─ .github/                          # CI, Release, Build, GitHub releases, Dependabot
```

## Development

```bash
npm install
npm test               # unit tests (no network)
npm run lint           # ESLint
npm run format:check   # Prettier
npx github:GladysAssistant/integration-store --skip-image-check .   # store checks
```

Run it against a Gladys instance:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<token>" \
GLADYS_INTEGRATION_SELECTOR="aqua-temp" \
LOG_LEVEL=debug \
npm start
```

## Workflows

Same workflows as [`prohand/gladys-devmel`](https://github.com/prohand/gladys-devmel):

| Workflow             | When                                    | What                                                                            |
| -------------------- | --------------------------------------- | ------------------------------------------------------------------------------- |
| `ci.yml`             | push to `main`, pull requests           | Prettier, ESLint, tests on Node 22 and 24; store checks and Docker build on PRs |
| `release.yml`        | Actions → Release → Run workflow        | bump version, roll the changelog, tag, build, GitHub Release, full store check  |
| `build.yml`          | `v*` tag, manual run, called by Release | multi-arch image (amd64 + arm64) to `ghcr.io/prohand/gladys-aquatemp`           |
| `github-release.yml` | push to `main`, called by Release       | a GitHub Release for every version tag, notes from `CHANGELOG.md`               |
| `dependabot.yml`     | weekly / monthly                        | npm, GitHub Actions and Docker base image updates                               |

## Publish

1. Add the GitHub topic `gladys-assistant-integration` to the repository, and turn on
   **Private vulnerability reporting** (Settings → Security).
2. Describe the changes under `## [Unreleased]` in [CHANGELOG.md](CHANGELOG.md).
3. **Actions → Release → Run workflow**. The repository starts at `0.0.0`: pick `major` for the
   first release (`1.0.0`).
4. Make the `ghcr.io/prohand/gladys-aquatemp` package public (Packages → Package settings), so
   Gladys can pull it.

## License

Apache-2.0
