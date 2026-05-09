# Lektíll — The First Offering

A short **desktop-first**, **top-down** narrative exploration game set in the world of **Lektíll**: a primordial reptilian entity from the **Fifth Age**, dwelling beneath the crust, surfacing rarely to feed on moisture-rich soil and **Bulbis Lazuls** — glowing blue-green orbs of immense significance.

You play **Mark Samson**, a young resident of a medieval farming town (inspired by *Lektíll* lore documents). The prototype is a complete vertical slice: town exploration → emergence site → Lektíll’s nonverbal awakening → underground maze → Bulbis chamber → ending.

## How to run

No build step or server is required.

1. Open `index.html` in a **desktop browser** (Chrome, Firefox, Edge, etc.).
2. If your browser blocks local scripts when opening files directly, use any static file server, for example:

```bash
# Python 3
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Controls

| Action | Keys |
|--------|------|
| Move | **WASD** or **Arrow keys** |
| Interact / advance dialogue | **E** or **Space** |
| Restart (after ending) | **R** |
| Exit flow (after ending) | **Escape** — shows a screen explaining you may close the window (browsers cannot reliably close tabs for you). |

## Story flow

1. **Farming town** — Talk to **Mother**, **Taylor**, **Farmer**, and **Old Worshipper**. After **at least three** conversations, the **northern path** opens.
2. **Emergence site** — Walk north from town. Approach **Lektíll** (massive silhouette, bioluminescent pores) to receive the memory sequence, then descend into the maze.
3. **Underground maze** — Tile-based navigation with **three readable inscriptions** and glowing soil motifs.
4. **Bulbis chamber** — Interact with the **Bulbis Lazul** to see the ending. **R** restarts; **Escape** ends the session UI.

## Technical notes

- **HTML5 Canvas** only — no external libraries or image assets.
- **Tile maps** are 25×18 grids of characters; collision uses the player AABB against solid tile types.
- **Story flags** live in `gameState` in `main.js` (`talkedToMother`, `lektillAwakened`, `missionStarted`, `hasBulbisLazul`, `gameFinished`, etc.).
- **Dialogue** is a small reusable queue (speaker + lines); movement pauses while a box is open.

## Files

| File | Role |
|------|------|
| `index.html` | Canvas + HUD chrome |
| `styles.css` | Dark fantasy presentation |
| `main.js` | Game loop, maps, dialogue, flags |
| `README.md` | This document |

## Lore references (project folder)

Your planning and outline PDFs plus concept art (`*.PNG`) informed tone, palette (earth + cyan glow), and scale — the in-game graphics are **placeholder canvas shapes** meant to evoke that mood until sprite art exists.

---

*Fifth Age · Subterranean · Primordial*
