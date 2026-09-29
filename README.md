# Spelling Worlds

A spelling bee practice game for four players: Charlie, Riley, Vera, and Cora. Everything lives in one `index.html` file with no build step, so it runs on GitHub Pages or straight from a downloaded copy.

## How it plays

- **3rd grade** loads the lagoon: an axolotl world with pearls, aquatic characters, and an underwater scene that grows with every level.
- **4th grade** loads the sweetshop: a candy world with sprinkles, candy characters, and a candy land that grows the same way.
- **Vera** always plays in the rainforest canopy: sloth and friends, leaves as rewards, with either word list.
- **Cora** always plays in the jellyfish ocean: jellyfish and friends, bubbles as rewards, with either word list.
- Each word is read aloud with a sentence (browser text-to-speech). Type it, or tap letter tiles into order.
- Misses show a letter-by-letter diff, then the word gets spelled out loud and retyped once to lock it in.
- Correct answers earn rewards; streaks earn bonuses; every level adds an outfit piece to the character and something new to the scene.

## Saving

Progress lives only online. Nothing about levels or rewards is stored in the browser: the game loads every player's save from the save service when it opens, and sends each change within a moment. The home screen says **Saved online** once a change has landed. If the service can't be reached, the player screen waits with a **Try again** button, and during play a note says progress is not saved until it reconnects.

The save service is a small Cloudflare Worker in `worker/` (`https://spelling-worlds-saves.yshi41.workers.dev`) backed by a D1 database with one row per player, plus a history of every save for recovery. A save only lands if it names the version it started from; when another device saved first, the game merges the two copies and sends again. The service refuses any save that lowers rewards unless it comes from **Reset this player's progress**.

Saves from before online saving are picked up once: when a browser that still holds one opens the game, anything it has beyond the online save is added online, and the old copy is deleted from the browser.

To change the service: `cd worker`, edit `src/index.js`, then `npx wrangler deploy`. `schema.sql` creates the tables (`npx wrangler d1 execute spelling-worlds-saves --remote --file=schema.sql`).

On a phone, use the browser's **Add to Home Screen**: the game gets its own icon and opens full-screen like an app (`manifest.webmanifest`, `icon.svg` and the PNG icons rendered from it).

## Word lists

The 3rd and 4th grade lists are the Scripps School Spelling Bee study words for those grades, with kid-friendly meanings and example sentences added.

## Testing

`test/test.js` drives the game in headless Chrome against an in-memory stand-in for the save service (`test/mockcloud.js`), so tests never touch the real saves. It checks online saving across two devices, offline play, lost replies, and resets, plus the player screen, hover previews, both worlds, spelling and tile rounds, misses and lock-in, hints, level-ups, the word list, persistence across player switches and reloads, reset, and phone-width layout.

```
cd test
npm install
npm test
```

It expects Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`; edit the path at the top of the script if yours differs.

`node qa.js` sweeps the published site instead, also with the stand-in save service: every ocean level and character, a two-tab save merge, reset, eight phone-to-desktop viewports with the play flows, the keyboard-open view, and text contrast in light and dark mode. Pass a file path to run it against a local copy.
