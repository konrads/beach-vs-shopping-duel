# Beach vs Shopping Duel

A browser stickman duel: you vs. Monika, throwing gold coins back and forth
across a shopping-mall courtyard until one of you goes down. Headshots are
an instant kill; body and leg hits chip away at a 5-point health bar. Loser
of the crowd gets driven off in a red car.

Inspired by [The Spear Stickman](https://www.crazygames.com/game/the-spear-stickman)
on CrazyGames, rebuilt from scratch as a plain HTML5 canvas game (no
frameworks, no build step).

## How to play

- Move your mouse to aim.
- Hold the mouse button to charge your throw, release to fire a coin.
- Gravity affects the coin's arc, so lead your shots.
- Headshot = instant kill. Body = 2 damage. Legs = 1 damage. Both sides
  start with 5 HP.
- Monika throws back on her own timer, with some randomness in her aim.

## Running it

This is a static site — no dependencies, no build step. Two options:

**Just open the file:**

```
open index.html
```

(or double-click it in Finder). Everything, including the background photo
and Monika's head image, loads fine directly from disk.

**Or serve it locally** (useful if your browser is picky about `file://`,
or you want to test on another device on your network):

```
cd spear-stickman
python3 -m http.server 8734
```

then visit `http://localhost:8734`.

## Project structure

```
index.html       markup, HUD, menu/game-over overlays
css/style.css     layout and styling
js/entities.js    Stickman and Spear (coin) classes — geometry, drawing, physics
js/game.js        game loop, input handling, computer AI, win/lose flow
assets/           background photo and Monika's head image
```
