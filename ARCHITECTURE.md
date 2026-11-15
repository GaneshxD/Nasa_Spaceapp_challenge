# Orbit Ranger: architecture

How the game is put together: the frontend, its data, and the optional server
for team play on separate devices.

- [1. The shape of the system](#1-the-shape-of-the-system)
- [2. Frontend](#2-frontend)
- [3. Data](#3-data)
- [4. Backend: the room server](#4-backend-the-room-server)
- [5. Testing](#5-testing)
- [6. How the game answers the challenge](#6-how-the-game-answers-the-challenge)
- [7. Rules for changing the code](#7-rules-for-changing-the-code)

## 1. The shape of the system

```
                        ┌────────────────────────── browser ───────────────────────────┐
                        │                                                              │
 assets/ (NASA data) ──▶│  core  ──▶  scene  ──▶  ui                                   │
                        │  rules      3D view     screens, levels, input               │
                        │    ▲                      │                                  │
                        │    │                      ▼                                  │
                        │    │                    net/room.js  (optional)              │
                        └────┼──────────────────────┼──────────────────────────────────┘
                             │ same files           │ WebSocket, JSON
                        ┌────┼──────────────────────▼──────────────────────────────────┐
                        │  game/core  ◀──  rooms  ◀──  ws/gateway      http/app        │
                        │                                                 server/      │
                        └──────────────────────────────────────────────────────────────┘
```

Two things can be run:

| What | How | Needs |
| --- | --- | --- |
| The game | Double-click `index.html`, or serve the folder | A browser with WebGL 2. Nothing to install, works offline. |
| The game plus team play on separate devices | `cd server && npm install && npm start`, then open the printed address on each device | Node 18 or newer. One dependency: `ws`. |

The game never depends on the server. Opened from a file there is no server,
the "play on your own phones" option is hidden, and up to four players share
one screen.

### Layers

Each layer may use the ones to its left and nothing to its right.

| Layer | Folder | Job | Knows about the browser? |
| --- | --- | --- | --- |
| core | `js/core/` | The rules: parts, orbits, physics, the design checker, the mission simulation, rocket flight, scoring | No. Runs in Node too (tests, tools, server). |
| scene | `js/scene/` | Everything drawn in 3D with three.js | Yes |
| ui | `js/ui/` | Screens, levels, input, sound, saved progress | Yes |
| net | `js/net/` | Messages to and from the room server | Yes |

## 2. Frontend

### 2.1 Technology

- Plain HTML, CSS and JavaScript. No framework, no build step, no package to install.
- three.js r149 (`vendor/three.min.js`) for 3D. It is the only third-party code.
- Classic `<script>` tags instead of ES modules. Browsers refuse to load modules
  from `file://`, and the game has to run from a double-click.
- Because of that, each file is an IIFE that adds one object to a single global
  namespace, `RG`. `index.html` loads the files in dependency order, and that
  list is the module graph.

### 2.2 Files

```
index.html                 the page and the script order
css/
  base.css                 colours, fonts, buttons, top bar, plates
  designer.css             level 5: sheet, tiles, title, crew, go/no-go, HUD, dialogs, report
  levels.css               the map, the level frame, gauges and controls of levels 1 to 4
  play.css                 drag and drop, Pip's moods, x-ray, replays, badges, cards
  team.css                 room card, locked consoles, toasts
  responsive.css           phones, upright and sideways (loaded last)
js/
  core/
    data.js                every part, orbit, rocket, fire zone, role and line of teaching text
    physics.js             orbit geometry: period, shadow, swath, station contact
    model.js               design checker, Go/No-go checks, mission codes
    sim.js                 the three-year mission, scoring and the written debrief
    flight.js              rocket physics for levels 2 to 4
  scene/
    engine.js              renderer, camera rig, labels, quality step-down
    earth.js               globe, coverage paint, orbits, fires, ground stations
    satellite.js           the satellite model, built from the chosen parts
    rocket.js              launch pad, the build-it-yourself rocket, flames and smoke
    views.js               which scene shows when
  net/
    room.js                client for the room server
  ui/
    audio.js               sound effects made with the Web Audio API
    icons.js               the icon set and Pip, as inline SVG
    drag.js                drag and drop, and the dock of drop slots
    replay.js              "what went wrong" cartoons
    widgets.js             gauges, tile numbers, the worked-out line, the sensor picture
    progress.js            saved progress
    rewards.js             badges and NASA mission cards
    levels/
      kit.js               what every level shares: frame, finish and failure screens, gauges
      map.js               the level map
      level1.js … level4.js   one file per level
      index.js             starts and stops levels, routes buttons and keys, frame loop
    designer/
      context.js           level 5 state, constants, helpers
      screens.js           title, crew, briefing
      step.js              one design step
      review.js            Go / No-go
      mission.js           launch, the mission run, the live HUD
      report.js            the mission report
      dialogs.js           help, NASA data, mission code, mission log
    app.js                 level 5 controller: navigation, chrome, button handlers, start-up
```

### 2.3 Namespaces

| Object | File | What it offers |
| --- | --- | --- |
| `RG.DATA` | `core/data.js` | All game content as plain objects |
| `RG.Physics` | `core/physics.js` | Pure functions of orbit geometry |
| `RG.Model` | `core/model.js` | `evaluate(design, level)`, `isComplete`, `stepDone`, `encode`, `decode` |
| `RG.Sim`, `RG.Score` | `core/sim.js` | The mission simulation and its scoring |
| `RG.Flight` | `core/flight.js` | `evaluate(build)`, `testFlight`, `Ascent`, `Insertion` |
| `RG.Stage` | `scene/engine.js` | Renderer, camera, labels, per-frame callbacks |
| `RG.Earth`, `RG.SatModel`, `RG.Rocket`, `RG.Views` | `scene/*` | The 3D subjects and the switch between them |
| `RG.Audio` | `ui/audio.js` | `play(name)`, rumble, on/off |
| `RG.Widgets` | `ui/icons.js`, `drag.js`, `replay.js`, `widgets.js` | Small UI pieces that return HTML strings |
| `RG.Progress` | `ui/progress.js` | Stars, saved rocket, badges, cards |
| `RG.Rewards` | `ui/rewards.js` | Badge and card definitions, the collection |
| `RG.LevelKit`, `RG.LevelMap`, `RG.LevelDefs`, `RG.Levels` | `ui/levels/*` | The level path |
| `RG.Designer` | `ui/designer/context.js` | Level 5 state and the screen registry |
| `RG.App` | `ui/app.js` | The small interface the levels use to reach the page |
| `RG.Room` | `net/room.js` | Team play client |

### 2.4 How a level is written

A level is a function registered as `RG.LevelDefs[n]`. It builds its scene,
and returns an object:

```js
RG.LevelDefs[3] = function () {
  // set up the scene and the HUD
  return {
    frame: function (dt) { /* called every frame */ },
    cleanup: function () { /* called when the level ends */ },
    launch: function (el, e) { /* any other key is a button handler */ }
  };
};
```

A button with `data-lv="launch"` calls the `launch` handler of the level being
played. `levels/index.js` does that routing, so a level never adds its own
event listeners. Adding a level means one new file, one line in `index.html`,
and one entry in `LEVELS` in `levels/map.js`.

### 2.5 How the mission designer is written

Level 5 has more screens, so it is split by screen:

- `designer/context.js` holds the one state object and the helpers.
- Each screen file registers a draw function, for example
  `X.screens.review = renderReview`.
- `app.js` is the controller. `go(screen)` changes screen, `render()` calls the
  registered draw function and then draws the chrome around it (step rail,
  gauges, drop slots, caption).
- Buttons carry `data-act="name"`. One click listener looks the name up in the
  `actions` table in `app.js`.

State changes flow one way: an action changes `state`, then `render()` redraws
from `state`. Screens are HTML strings set with `innerHTML`; every piece of
text that a player typed goes through `W.esc()` first.

### 2.6 Input

- **Drag and drop** (`ui/drag.js`). Draggables carry `data-drag="<slot>"`, targets
  carry `data-drop="<slot>"`. A finished drop is delivered as an ordinary click
  on the dragged button, so the same handler serves mouse, touch and keyboard.
- **Touch.** A press of 170 ms lifts a part. A quicker swipe scrolls the sheet.
- **Keyboard.** Enter or Space on a tile picks it. Arrow keys steer in level 3,
  Space burns in level 4, and the 3D view turns with the arrow keys.
- **A tap is not a pick.** It plays a hand carrying the part to its slot.

### 2.7 Responsive layout

| Screen | Layout |
| --- | --- |
| Wider than 860 px | The sheet sits on the right, the 3D view is shifted left |
| 860 px or narrower, upright | The sheet is a bottom drawer (56% of the height), gauges scroll sideways above it, drop slots sit under the step numbers |
| A phone held sideways (up to 960 px wide, up to 520 px tall) | The sheet returns to the right half, drop slots move to the left edge |

The 3D view follows the sheet: `layout()` in `app.js` measures where the sheet
is and moves the camera's centre to the free part of the screen. Heights use
`dvh` so mobile browser bars do not cover the buttons. With "reduce motion"
switched on, glides, shake and bouncing are removed.

### 2.8 Performance

`scene/engine.js` measures frame time and lowers quality by itself: fewer
pixels first, then no shadows. `?quality=high` in the address keeps full
quality. The level map hides the 3D view entirely, so it costs nothing to draw.

## 3. Data

### 3.1 NASA data shipped with the game

| File | Contents | Built by |
| --- | --- | --- |
| `assets/nasa-fires.js` | 126 real fires from the NASA FIRMS MODIS archive for 2023 (nine for each of 14 zones), and about 1,600 detections from the week of 7 to 14 November 2026 | `tools/build-fires.py` |
| `assets/img/*.jpg` | Blue Marble (day) and Black Marble (night) from NASA GIBS | Downloaded once |
| `assets/textures.js` | The same two images as data URLs, because a page opened from a file may not read image pixels | `tools/embed-textures.js` |

`CREDITS.md` lists every source and licence.

### 3.2 Game content

All of it is in `js/core/data.js`, as tables:

```
MISSION, DIFFICULTY, ROLES, ROLE_ORDER
SENSORS, EXTRAS, ORBITS, BUSES, PANELS, BATTERIES, COMPUTERS, POINTING, RADIOS, NETWORKS, ROCKETS
STATIONS, FIRE_SIZES, EVENTS, GLOSSARY, STEPS
```

`STEPS` drives the designer. Each step names its role, its teaching text and
its groups, and each group names the table its options come from:

```js
{ id: 'sensor', role: 'science', title: 'Choose the fire sensor',
  groups: [{ key: 'sensor', pick: 'one', from: 'SENSORS' },
           { key: 'extras', pick: 'any', from: 'EXTRAS' }] }
```

Adding a part is one entry in a table. The tile, its numbers, its slot and the
server-side check all follow from the data.

### 3.3 The design

One plain object describes a whole mission design:

```js
{ sensor, extras: [], orbit, bus, panels, battery, computer, pointing, radio, network, rocket }
```

`Model.encode` turns it into a 14-character mission code such as
`OR-11111111120`, and `Model.decode` reads one back, rejecting anything that is
not a valid code.

### 3.4 What is stored in the browser

Three `localStorage` keys, all on the player's own device:

| Key | Contents |
| --- | --- |
| `orbit-ranger.progress` | Stars per level, the rocket built in level 2, the hand-over from level 3 to 4, badges, cards |
| `orbit-ranger.log` | The 20 best missions flown in this browser |
| `orbit-ranger.sound` | Sound on or off |

The game collects no personal data and has no accounts.

### 3.5 Determinism

A mission is a pure function of the design, the level and a mission number
(the seed). The same three inputs always give the same fires, surprises and
score. That is what makes missions testable, shareable by code, and playable
by a team on separate devices without sending the simulation over the network.

## 4. Backend: the room server

### 4.1 Is a backend required?

Not for the game or for the challenge: one to four players can share one
screen with no server at all. The server exists for one case, a team where
each player has their own phone. It lets them share a single design, each
choosing the parts for their own consoles, and launch the same mission.

### 4.2 Design choices

| Choice | Why |
| --- | --- |
| Node, standard `http`, and the `ws` library | The game's rules are JavaScript, so the server runs the same files the browser does |
| WebSocket with JSON messages | Picks must reach every player at once, in both directions |
| The server owns the design | Players cannot disagree about what was picked, and a console can be limited to its owner |
| Rooms live in memory | A room lasts one play session; nothing needs to survive a restart |
| The mission is simulated on each device | The simulation is deterministic, so the server only sends the mission number |
| The server also hosts the game's files | One address serves both, so the socket is same-origin |

### 4.3 Files

```
server/
  package.json
  src/
    index.js               composition root: builds the pieces and starts listening
    config.js              every setting read from the environment
    http/
      app.js               health check, then static files
      static.js            serves the game's own folders and nothing else
    ws/
      gateway.js           connections, rate limit, heartbeat, routing to rooms
      protocol.js          message shapes and validation
    rooms/
      room.js              the rules of a room (no network code)
      memoryStore.js       where rooms are kept
    game/
      core.js              loads js/core/* so server and browser share one rulebook
  test/
    room.test.js           room rules, message checks, a two-player session over real sockets
```

Dependencies point one way: `index → http, ws → rooms → game/core`. `room.js`
has no network code, so its rules are tested directly.

### 4.4 Messages

One socket per player at `/ws`. Every message is a JSON object with a type `t`.

| Browser → server | Fields | Meaning |
| --- | --- | --- |
| `create` | `name`, `diff` | Open a room and sit down as host |
| `join` | `code`, `name` | Sit down in a room |
| `rejoin` | `code`, `id`, `token` | Return to a held seat after a dropped connection |
| `pick` | `group`, `key` | Choose a part (bonus tools toggle) |
| `vote` | `role`, `go` | Press or release a console's go button |
| `launch` | | Host only: start the mission |
| `leave` | | Give up the seat |

| Server → browser | Fields | Meaning |
| --- | --- | --- |
| `joined` | `you`, `token`, `state` | You are seated; keep the token to rejoin |
| `state` | `state` | The room changed |
| `launch` | `seed` | Everyone starts the countdown with this mission number |
| `error` | `code`, `message` | The request was refused; the message is shown to the player |

The room state sent to players:

```js
{ code: 'RPPH', diff: 'engineer', rev: 12,
  players: [{ id, name, online }],        // in joining order; the first is the host
  design: { sensor, extras, orbit, ... }, // the same object the browser uses
  votes: { science: true, nav: true } }
```

`rev` rises with every change, so a browser ignores a state that arrives late.

### 4.5 Rules the server enforces

- A room holds at most four players. The four consoles are dealt out in joining
  order, the same way the single-screen game shares them.
- Only a console's owner may change its parts or press its go button.
- Any change to the design, or to who is in the room, clears every go vote.
- Launch needs the host, a complete design that passes the same `Model.evaluate`
  checks as the browser, and a go from all four consoles.
- A player whose connection drops keeps their seat for 120 seconds.
- An empty room is removed, and so is one that nobody has touched for two hours.

### 4.6 Safety

Everything that arrives from the network is treated as untrusted.

| Risk | Measure |
| --- | --- |
| Malformed or oversized messages | 2 kB limit per message; unknown types and wrong field shapes are dropped in `protocol.js` before any game code runs |
| Made-up parts or groups | A pick must name a group in `STEPS` and a key in that group's table |
| Flooding | A token bucket per connection (30 messages, refilling at 6 a second); exceeding it closes the socket |
| Guessing room codes | Eight wrong codes close the socket |
| Taking over a seat | A seat needs its 128-bit random token, compared in constant time; tokens are never sent to other players |
| Script in a player's name | Names are cut to 14 characters with control characters removed on the server, and escaped by the browser when shown |
| Sockets opened from other sites | The `Origin` header must match the server's host, or be listed in `ORIGINS` |
| Reading files off the server | Only `index.html`, `css`, `js`, `assets`, `vendor` and `docs` are served; paths are resolved and checked, dotfiles refused |
| Dead connections | A ping every 30 seconds; a socket that does not answer is closed |

No personal data is asked for or stored. A room holds first names typed by the
players and the design, and all of it is gone when the room closes.

### 4.7 Settings

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | 8080 | Port to listen on |
| `ORIGINS` | none | Extra origins allowed to connect, comma-separated |
| `MAX_ROOMS` | 500 | Rooms open at once |
| `ROOM_IDLE_MINUTES` | 120 | Idle time before a room is removed |
| `SEAT_HOLD_SECONDS` | 120 | How long a dropped player's seat is kept |

If the game's files are hosted somewhere else (a static host, for example),
add `<meta name="orbit-ranger-server" content="wss://your-server/ws">` to
`index.html` and list the static host in `ORIGINS`.

### 4.8 Running and deploying

```sh
cd server
npm install
npm start          # the game and team play at http://localhost:8080
npm test           # 9 tests
```

Any host that runs a Node process and passes WebSockets through will do. Put
it behind HTTPS so the socket uses `wss://`. `GET /healthz` returns
`{"ok":true,"rooms":N}` for health checks.

### 4.9 Limits, and what would change at scale

One process keeps all rooms in memory. That is the right size for a classroom
or a hackathon demo. Running several processes would need two changes, both
behind interfaces that already exist: replace `rooms/memoryStore.js` with a
shared store such as Redis, and have `ws/gateway.js` publish room changes
through that store so players on different processes see each other. The game
rules in `rooms/room.js` and the message format would not change.

Not built: accounts, saved rooms, chat, spectators, and a shared leaderboard.

## 5. Testing

| What | Command | Covers |
| --- | --- | --- |
| Simulation | `node tests/run-tests.js` | 40 tests: rocket flight, orbit physics, NASA data, design checker, mission runs |
| Room server | `cd server && npm test` | 9 tests: room rules, message validation, a two-player session over real sockets, static file safety |
| Balance | `node tools/balance.js engineer` | Scores for a set of reference designs |

The interface has no automated tests in the repository. It was checked by
driving a real browser through all five levels at desktop, upright-phone and
sideways-phone sizes, and through a two-device team session.

## 6. How the game answers the challenge

The Space Apps challenge pages could not be opened from the build environment,
so this table is written against public summaries of the challenge and should
be checked against the official Details and Resources tabs before submitting.

| The challenge asks for | Where it is |
| --- | --- |
| Design a complete mission | Level 5: seven steps from sensor to rocket |
| A mission objective first | The briefing sets five goals before any hardware is chosen |
| Choose spacecraft, instruments, orbit and launch vehicle | `SENSORS`, `EXTRAS`, `ORBITS`, `BUSES`, `ROCKETS` and the rest in `core/data.js` |
| Manage limited resources: budget, mass, power, data, communications | Five live gauges, the Go / No-go check, and the mission itself |
| Simulate the mission | `core/sim.js`: three years of real fires, power, memory and radio contact |
| See how each choice affects the outcome | The worked-out line for every option, replays of failures, and a written debrief |
| One to four players | One screen, or one device each through the room server |
| Suitable for beginners and young players | Levels 1 to 4 build up to the design problem; four difficulty settings |
| Use NASA data and resources | FIRMS fires, GIBS imagery, real engine and station figures; see `CREDITS.md` |

## 7. Rules for changing the code

1. `js/core/` never touches `window`, `document` or three.js. If it needs the
   browser, it belongs in `scene` or `ui`.
2. Game content goes in `core/data.js`, not in screen code.
3. One level per file; one designer screen per file.
4. Buttons use `data-act` or `data-lv`. Do not add click listeners in screens.
5. Text typed by a player is escaped with `W.esc()` before it reaches the page.
6. The server trusts nothing from a socket. New messages get a shape in
   `ws/protocol.js` and their rule in `rooms/room.js`, with a test.
7. New files are added to the script list in `index.html` in dependency order.
