# GDE - Copilot Instructions

GeoGuessr-style game over Mapy.cz street panoramas of the Czech Republic. Vanilla-JS
frontend served by a Go backend that doubles as a Mapy.cz API proxy and a WebSocket
multiplayer server. No frontend framework, no bundler, no build step for the client.

## Commands

Backend lives in two files that share `package main` and **must be compiled together**:

```bash
go run server.go multiplayer.go        # run locally, serves http://localhost:8000
go build -o server server.go multiplayer.go
go vet ./...                           # primary backend check
go test ./...                          # no tests exist yet, but this is the runner
```

- `go run server.go` alone fails - multiplayer symbols are undefined without `multiplayer.go`.
- Frontend has no test/build tooling. Syntax-check a changed file with `node --check app.js`.
- Env vars: `PORT` (default 8000), `LOG_LEVEL` (DEBUG/INFO/WARN/ERROR, default INFO),
  `MAPY_API_KEYS` (comma-separated fallback when no YAML is present).
- Docker: `docker build -t gde-game .`; CI (`.github/workflows/docker-build.yml`) builds and
  pushes to `ghcr.io` on every push to `main`.
- The committed `.go` files are **not** `gofmt`-clean. Don't blanket-reformat - keep diffs
  surgical or you'll bury real changes in whitespace noise.

## Architecture

**The API-key proxy trick.** The client calls real `https://api.mapy.cz/` URLs, but
`panorama-proxy.js` monkey-patches `XMLHttpRequest`, `fetch`, and `Image` to rewrite those
hosts to `/api/mapy/*`. The Go `proxyHandler` injects the real API key server-side, so keys
never reach the browser. This is why `panorama-proxy.js` must load before the external Mapy
panorama script in `index.html`.

**Backend routing** is a single `mainHandler` in `server.go` (no router lib):
`/ws` -> WebSocket, `/api/cache` -> cache stats, `/api/mapy/*` -> Mapy proxy, everything
else -> static files from the working directory. The proxy rotates API keys and retries the
next key on 401/403. Map/panorama tiles are cached to `.tile_cache/` (TTL/size configurable).

**API keys** load from `settings.yaml` first, then `api_keys.yaml`, then `MAPY_API_KEYS`.
YAML shape is a list of single-entry maps: `- key_name: "value"`. Copy `settings.example.yaml`
to `settings.yaml` (gitignored). The README still references the older `api_keys.yaml`/
`config.js` naming - `settings.yaml` is the current path.

**Multiplayer** (`multiplayer.go`, gorilla/websocket) keys in-memory `GameSession`s by code.
Every message is `{ "type": ..., "payload": ... }`. Server handles types in the
`handleMessage` switch (`createSession`, `joinSession`, `toggleReady`, `updateSettings`,
`kickPlayer`, `startGame`, `submitGuess`, `requestLocation`, `nextRound`, `locationFailed`);
the client mirrors them in the `multiplayer.js` message switch. Add a feature on both sides.

**Regions/boundaries.** `boundaries/index.json` indexes polygon files grouped as
`misc`/`cities`/`regions`/`districts`. The frontend loads the index, builds the `REGIONS`
map, and lazy-loads individual boundary files on demand - bounds are derived from polygons,
never hardcoded. Districts/regions also drive challenge mode.

## Frontend conventions

- **No modules.** Scripts load as plain `<script>` tags in a fixed order
  (`panorama-proxy.js` -> external libs -> `i18n.js` -> `challenge.js` -> `app.js` ->
  `multiplayer.js`) and share one global scope. Cross-file calls go through `window.*`
  (e.g. `window.t`, `window.sendCustomRegionUpdate`, `window.closeMultiplayerConnection`),
  often guarded with `typeof window.fn === 'function'` so optional pieces can be absent.
- **Adding a frontend file requires two edits or it won't ship:** a `<script>`/`<link>` tag
  in `index.html` AND the `COPY` line in the `Dockerfile` (see commit "add challenge.js to
  Dockerfile static files").
- **i18n.** `i18n.js` holds `translations = { en, cs }` keyed by dot-strings (`region.select`).
  Use `t('key', { replacements })`; markup uses `data-i18n="key"` applied by
  `updatePageLanguage`. Add every new user-facing string to **both** `en` and `cs`. Language
  persists in `localStorage['gde_language']`.
- **Challenge mode** (`challenge.js`) is an IIFE (`ChallengeMode`) that persists progress to
  `localStorage['gde_challenge_<type>']` and rebuilds restored state with
  `Object.create(null)` / explicit field copying to stay prototype-pollution safe.

## Don't touch / out of scope

- `settings.yaml`, `config.js`, `api_keys.yaml`, `.tile_cache/` are gitignored - never commit
  keys or cache.
- `decode_*.js` plus the `.har` files are one-off Node scripts for reverse-engineering Mapy.cz
  boundary data (they pull in `@seznam/fastrpc` / `@mapbox/polyline`, the only reason
  `package.json` exists). They are dev tooling, not part of the runtime.
