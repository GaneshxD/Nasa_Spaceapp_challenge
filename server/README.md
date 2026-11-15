# The Orbit Ranger game server

One small Node program that does three jobs:

1. **Serves the game** (the files in the folder above this one), so one address gives you both the game and the server.
2. **Runs crew missions**: up to four players, each on their own phone or computer, fly one rocket to orbit. The flight
   itself runs here, on the server, so every screen shows the same flight.
3. **Shares mission designs** for level 5: up to four players build one satellite mission together.

Rooms live in this program's memory. Nothing is written to disk and there are no accounts: a room is a four-letter code.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer (`node --version` tells you).

```sh
cd server
npm install        # once: fetches the one dependency, ws
npm start
```

It prints something like:

```
Orbit Ranger is running.

  On this computer:      http://localhost:8080
  On the same network:   http://192.168.1.23:8080
```

From the project's top folder, `npm run server` does the install and the start in one go.

## Play together on your local network

1. Start the server on one computer (above). Leave that window open.
2. On that computer, or any other device **on the same Wi-Fi or cable network**, open the **"On the same network"**
   address in a browser.
3. Press **Play**, then **Crew online**, type a name, and press **Start a crew**.
4. The lobby shows a **link** such as `http://192.168.1.23:8080/?crew=ABCD`. Send it to the others (the Copy button
   copies it; on a phone it opens the share sheet). They can also open the address, press Crew online and type the
   four-letter code.
5. When everyone has joined, each player presses **I am go**. When every player is go, the countdown starts.

Up to four players. The four seats (pilot, flight engineer, navigator, payload officer) are dealt in joining order:
alone you get all four (handy for trying it out), two players get two each, four players get one each.
A player whose phone sleeps or who reloads the page comes back to the same seat.

### If another device cannot open the address

- **Same network?** The phone must be on the same Wi-Fi as the computer, not on mobile data or a guest network.
  Guest networks and some office or school Wi-Fi stop devices from talking to each other ("client isolation").
- **Firewall.** The first time, Windows asks whether Node.js may accept connections: allow it for **private** networks.
  On macOS allow incoming connections for `node` (System Settings → Network → Firewall). On Linux with ufw:
  `sudo ufw allow 8080/tcp`.
- **Which address?** If the server prints several "same network" addresses, the computer has several network cards
  (or a VPN, or Docker): try each. `ipconfig` (Windows) or `ip addr` / `ifconfig` (Linux, macOS) lists them.
- **Use the network address yourself.** If you open the game at `localhost`, the lobby still shows the network link
  (it asks the server for it), but other devices can never use a `localhost` link.
- **Port in use?** Start on another port: `PORT=3000 npm start` (PowerShell: `$env:PORT=3000; npm start`).

## Settings

All optional, set as environment variables before `npm start`.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `8080` | The port to listen on. |
| `HOST` | `0.0.0.0` | The address to listen on. `0.0.0.0` means every network this computer is on. `127.0.0.1` keeps it to this computer only. |
| `ORIGINS` | none | Extra web addresses allowed to open a socket, comma-separated. Needed only when the game's files are hosted somewhere other than this server. |
| `MAX_ROOMS` | `500` | How many rooms may exist at once. |
| `ROOM_IDLE_MINUTES` | `120` | A room nobody touches for this long is removed. |
| `SEAT_HOLD_SECONDS` | `120` | How long a dropped player's seat is kept for them. |

## Putting it on the internet

On a local network plain `http://` is fine. On the internet, put the server behind something that adds HTTPS
(Caddy, nginx, or a host such as Render, Fly.io or Railway that does it for you) and forward both normal requests and
WebSocket upgrades on `/ws` to this program. The game then connects with `wss://` by itself. If the game's files live
on a different host than this server, add to the game's `index.html`
`<meta name="orbit-ranger-server" content="wss://your-server.example/ws">` and start the server with
`ORIGINS=https://your-game.example`. To run several server processes, replace `src/rooms/memoryStore.js` with a
shared store: the rest of the code only uses `create`, `createCrew`, `get`, `delete`, `sweep` and `size`.

## What is inside

```
src/index.js            starts everything; prints the addresses
src/config.js           every setting, read from the environment
src/http/app.js         /healthz, /lan.json and the game's files
src/http/static.js      serves only the game's own folders
src/ws/gateway.js       the sockets: who is connected, what they may send, and the 30-a-second flight loop
src/ws/protocol.js      every message a browser may send, and the checks each one must pass
src/rooms/crewRoom.js   a crew mission: seats, the go / no-go poll, the flight, the score
src/rooms/room.js       a shared mission design (level 5)
src/rooms/memoryStore.js  where rooms are kept
src/game/core.js        loads the game's own rules (js/core), so server and browser cannot disagree
test/                   node --test
```

Addresses: `/` the game · `/?crew=ABCD` the game, opened at that crew's door · `/ws` the socket ·
`/healthz` `{ ok, rooms }` · `/lan.json` `{ urls }`, this computer's addresses on the local network.

### How a crew mission runs

The rules are in `js/core/crew.js` (`Crew.Mission`), the same file the browser tests use. The room steps the mission
30 times a second and sends every player the same small picture of the flight (about 0.6 kB) 15 times a second.
Players send only what they are holding or pressing, and only a seat's owner is listened to:

| Browser sends | Meaning |
| --- | --- |
| `crew-create { name, tank?, engines? }` | Make a room (the creator's level 2 rocket is used if it suits). |
| `crew-join { code, name }` | Join a room. Refused while a flight is in progress. |
| `rejoin { code, id, token }` | Come back to a held seat. |
| `crew-go { go }` | This player's answer in the go / no-go poll. |
| `crew-steer { v }` | Pilot: -1 left, 1 right, 0 nothing. Sent when it changes. |
| `crew-burn { on }` | Navigator: holding the upper-stage burn. |
| `crew-act { a }` | A switch: `boosters`, `separate` (engineer), `fairing`, `deploy` (payload officer). |
| `crew-again {}` | After a flight: everyone back to the lobby. |
| `leave {}` | Leave the room. |

The server answers with `joined { you, token, state }`, `state { state }` and `error { code, message }`.
Every message is checked for shape and size (2 kB at most), each connection may send 20 messages a second,
the socket is refused unless the page came from this server (or an address in `ORIGINS`), and a connection that
sends eight wrong room codes is closed.

## Tests

```sh
cd server && npm test                       # 16 tests: room rules, message checks, real socket sessions
python3 tools/browser/check-crew.py         # from the top folder: three browsers fly a whole mission (needs Playwright)
```
