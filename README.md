# Spelling Worlds

A spelling bee practice game for six players: Charlie, Riley, Vera, Cora, Addie, and Amy. Everything lives in one `index.html` file with no build step, so it runs on GitHub Pages or straight from a downloaded copy.

## How it plays

- **3rd grade** loads the lagoon: an axolotl world with pearls, aquatic characters, and an underwater scene that grows with every level.
- **4th grade** loads the sweetshop: a candy world with sprinkles, candy characters, and a candy land that grows the same way.
- **Vera** always plays in the rainforest canopy: sloth and friends, leaves as rewards, with either word list.
- **Cora** always plays in the jellyfish ocean: jellyfish and friends, bubbles as rewards, with either word list.
- **Addie** starts in the bow boutique: hair bows, scrunchies, clips, and a headband bunny, with ribbons as rewards.
- **Amy** starts in the boba shop: milk tea, taro, matcha, strawberry, mango, and a boba pearl, with boba as rewards.
- **World button** on the home screen opens the list of six worlds; tapping one previews it, and **Save world** keeps it (saved online).
- **Every character has its own level.** Each of the 36 characters keeps its own rewards and level, starting at level 0, so picking a new character starts that one from scratch and going back finds the old one right where it was. The character chips show each one's level, and MAX once it reaches the top level.
- **Say It** is the bee itself: hear the word, then spell it out loud. It listens with the device's own speech recognition, two ways. The mic button uses the browser's recognizer (Google in Chrome and Android, Apple in Safari, Microsoft in Edge; needs the mic allowed and usually an internet connection). The box below it takes the keyboard's voice typing: the mic key on a phone keyboard, Windows key + H on a PC, or Fn twice on a Mac, and it is the only way in browsers without a recognizer, such as Firefox. Single letters, letter names ("bee", "you" for U, "double u") and runs the recognizer writes in capitals ("BAMBOO", how it writes spelled letters) count as letters; anything else said (the word itself, "um", side talk) is ignored. Where a word could be read more than one way, the game weighs every reading across the recognizer's top five guesses and uses the one closest to the word. In Say It only the word is read (tap **Sentence** or **Meaning** for more), and the mic turns on by itself as soon as the word has been read; the button turns gold while the mic starts and says when it is listening. The mic stays on until the kid is done (it comes straight back whenever the browser ends a session on its own). Nothing is checked until the kid confirms: the letters show as tiles while they are heard; the moment they match the word, or after a short quiet pause, the game asks "Is that what you said?"; then the kid taps **Yes, check it!** or **Say it again** (which clears the letters while the mic keeps listening). Tapping the mic pauses it; tapping again carries on. A device that refuses to start the mic without a tap (some iPhones) quietly falls back to the tap.
- **Tile Time** earns rewards but never counts toward mastering a word; only Spell It and Say It do.
- A big badge on every screen shows which word list is in use: blue for 3rd grade words, purple for 4th grade words.
- The home screen offers three games from easiest to hardest, left to right: Tile Time, Spell It, Say It, each marked, with Word List below for study.
- Each word is read aloud with a sentence (browser text-to-speech) in a warm woman's voice: the game scores every English voice the device has (natural or online voices first, known women's voices next, never the men's), so it picks Aria on Windows, Samantha on an iPhone, and the plain English voice on Android. Type it, say it out loud, or tap letter tiles into order.
- Reward sounds wait a moment after the mic lets go of the speaker, and the sound engine restarts itself if a phone's mic interrupted it, so Say It rewards are heard too.
- Misses show a letter-by-letter diff, then the word gets spelled out loud and retyped once to lock it in.
- Correct answers earn rewards for the character being played; streaks earn bonuses; every level adds an outfit piece to the character and something new to the scene.

## Saving

Progress lives only online. Nothing about levels or rewards is stored in the browser: the game loads every player's save from the save service when it opens, and sends each change within a moment. The home screen says **Saved online** once a change has landed. If the service can't be reached, the player screen waits with a **Try again** button, and during play a note says progress is not saved until it reconnects.

A player's save holds one record per character (`chars["world:character"]`). Saves made before that are read once into the new shape: each world's rewards go to the character picked in that world, and the player's own world's rewards go to the character they were playing, so nobody loses a level. `migrateChars` in `index.html` and `worker/src/logic.mjs` must stay in step.

The save service is a small Cloudflare Worker in `worker/` (`https://spelling-worlds-saves.yshi41.workers.dev`) backed by a D1 database with one row per player, plus a history of every save for recovery. A save only lands if it names the version it started from; when another device saved first, the game merges the two copies and sends again. The service refuses any save that lowers rewards unless it comes from **Reset this player's progress**.

Saves from before online saving are picked up once: when a browser that still holds one opens the game, anything it has beyond the online save is added online, and the old copy is deleted from the browser.

To change the service: `cd worker`, edit `src/index.js`, then `npx wrangler deploy`. `schema.sql` creates the tables (`npx wrangler d1 execute spelling-worlds-saves --remote --file=schema.sql`).

On a phone, use the browser's **Add to Home Screen**: the game gets its own icon and opens full-screen like an app (`manifest.webmanifest`, `icon.svg` and the PNG icons rendered from it).

## Word lists

The 3rd and 4th grade lists are the Scripps School Spelling Bee study words for those grades, with kid-friendly meanings and example sentences added.

## Testing

`test/test.js` drives the game in headless Chrome against an in-memory stand-in for the save service (`test/mockcloud.js`), so tests never touch the real saves. It checks online saving across two devices, offline play, lost replies, and resets, plus the player screen, hover previews, both worlds, spelling, say-it (with a fake microphone), and tile rounds, misses and lock-in, hints, level-ups, each character keeping its own level, the word list, persistence across player switches and reloads, reset, and phone-width layout.

```
cd test
npm install
npm test
```

It expects Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`; edit the path at the top of the script if yours differs.

Both suites also check that the game is online-only: the code never writes browser storage, cookies, IndexedDB, or caches; every run records any such write and fails on one; and a device with browser storage blocked still plays and saves.

`node qa.js` sweeps the published site instead, also with the stand-in save service: every ocean level and character, a two-tab save merge, reset, eight phone-to-desktop viewports with the play flows, the keyboard-open view, and text contrast in light and dark mode. Pass a file path to run it against a local copy.
