# Sable Springs

An original open-world 3D crime sandbox that runs in a browser. It is set in a fictional neon desert casino city with a river, a suburb and an airstrip. It is built with three.js in a single HTML file.

This repository also holds an automated playtest study of the game: 324 scripted bot sessions, the fixes they led to, and a paper on the results.

- **Play:** open `index.html` through a local web server (see below).
- **Paper:** [`paper/PAPER.md`](paper/PAPER.md)
- **Results data:** [`results/summary.json`](results/summary.json)
- **Bot harness:** [`playtest/`](playtest/)

## Running the game

The game loads three.js from a CDN, so it needs an internet connection. Serve the folder over HTTP rather than opening the file directly:

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

**Controls:** mouse to look and aim, left click to shoot, right click to aim down sights, W A S D to move or drive, Shift to sprint or boost, Space to jump or handbrake, E to interact, R to reload, V to switch first and third person, M for the map, Esc to pause. The start screen lists the rest.

## Running the playtest bots

1. Start a local server in the repository folder (see above).
2. Open http://localhost:8000/playtest/harness.html. It is the same game with `bots.js` added.
3. In the browser console, run:

```js
runAllAsync(200, 5)            // 200 sessions of 5 simulated minutes, all 8 play styles
window.__PROGRESS              // progress
window.__RESULTS               // per-session telemetry when done
```

To run only some play styles, pass a list: `runAllAsync(24, 5, ['story', 'flood'])`. Keep the tab in the foreground; background tabs are throttled.

The eight play styles are story, side jobs, chaos, burglar, turf, explorer, skyline and flood. Each bot drives the real game through a headless simulation step at about 100 times real speed and logs deaths, arrests, missions, money, stuck events and more. The bots save progress in that page's browser storage, so use a separate browser profile if you also play the game on the same address.

## Repository layout

| Path | What it is |
| --- | --- |
| `index.html` | The game, with telemetry hooks and the simulation step the bots use |
| `playtest/harness.html` | The game plus the bot script |
| `playtest/bots.js` | The scripted bot players and the session runner |
| `paper/PAPER.md` | The playtest paper |
| `paper/figures/` | The paper's charts |
| `results/summary.json` | Aggregate results of every run |
