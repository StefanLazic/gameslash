# Notes — Butterfly Blades

A hack &amp; slash for Sofija and Emilija. Static site: `index.html` loads plain CSS + classic
`<script>` files (no build step, no dependencies), so any static host can serve it.

## Log

### 1. Skeleton + title screen
- `index.html` holds every screen (title, how-to-play, sister select, HUD, pause, game over, victory)
  as absolutely positioned overlays over a full-screen canvas.
- `css/style.css`: dusk/violet palette, big touch-sized buttons, safe-area padding for notched phones,
  a short-viewport media query so landscape phones keep the controls small.
- Background canvas (`#bg`) draws a drifting butterfly flock behind the menu.

### 2. Core engine
- `js/util.js` — maths helpers (arc hit tests, angle diffs, rounded rect).
- `js/audio.js` — everything synthesised with WebAudio (slashes are filtered noise, music is a slow
  arpeggio that switches to a tenser scale for boss fights). Audio is started on the first button press
  so mobile autoplay rules are respected.
- `js/art.js` — all graphics are procedural canvas drawing: the sisters, six monster silhouettes,
  butterflies, arenas and the menu portraits. No image assets to load.
- `js/input.js` — keyboard map plus a pointer-events thumbstick and three action buttons.
  Movement is a single normalised vector so keyboard and touch feel identical.
- `js/entities.js` — players, enemies, projectiles, butterflies, pickups, particles.
- `js/levels.js` — ten stages with their own palettes and wave tables.
- `js/game.js` — screens, camera, waves, mutators, HUD and the main loop.

### Fighting styles
- **Sofija**: 4-hit dagger chain (fast, low damage, spin finisher), long dash, `Petal Storm` special
  that whirls damage around her while she keeps moving.
- **Emilija**: 3-hit scythe chain (slow, wide arcs, big knockback and stagger), armoured dodge that
  reduces damage instead of avoiding it, `Lunar Slam` shockwave that stuns everything in a big ring.
- Either sister can be tagged in at any moment (Q / portrait button). Swapping shoves nearby enemies
  back, so it doubles as a panic button — and each sister keeps her own health pool.

### Rescue loop
Some enemies carry a caged butterfly above them. Killing a carrier frees the butterfly, which flies to
the player. Free them all, clear the waves, then step into the portal to move on.

### Surprises
- Each level (except the first) rolls a random mutator, announced on the level card: faster enemies,
  glass moon (everything dies faster), swarm season, nectar rain, lantern out (dark arena with a light
  around you), half-price specials.
- Nectar pickups grant a temporary damage/speed rush; clearing a level without taking damage heals 40.
- Bosses change patterns at 66% and 33% health with a phase announcement.

### Bosses
- Levels 3, 7 and 9 host **Thistle Knight** mini bosses (shield charges).
- Level 5: **Vespera, the Widow** — bullet fans, spirals, dashes, summons her brood.
- Level 10: **Nyx, Keeper of Wings** — spirals, telegraphed slams, a sweeping beam and summons.

### 5. Human-looking sister heads
- Rewrote the head/face drawing in `js/art.js` as its own `drawHeroHead()` pass so the sisters read as
  girls instead of coloured blobs.
- New palettes: warm believable skin tones with a shaded side (`skin`/`skin2`), brown hair for Sofija and
  dark plum-black for Emilija, plus eye, brow, blush and ribbon colours.
- The face is now an oval with a neck, an ear and soft cheek/jaw shading. The hair is drawn as a full
  silhouette *behind* the head and a swept fringe *over* the forehead, so hair and skin meet along a soft
  diagonal instead of the old hard circle-on-circle seam.
- Faces got expressions: white-of-eye + iris + pupil + highlight, lash lines, eyebrows, blush and a small
  smile. Each sister blinks on her own timer (portraits stay open-eyed).
- Hairstyles distinguish them at a glance: Sofija has a bob with a high ponytail and pink ribbon,
  Emilija has long hair falling past her shoulders with a blue ribbon.
- Everything is still procedural canvas drawing, so portraits (select screen + HUD) and the in-game
  sprites all update from the same code, and the static `index.html` needs no new assets.
