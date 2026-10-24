# Ledger Detective: Night Shift

An interactive thriller that teaches you to write SQL by hand. You're an undercover FBI agent on the night shift at an investment fund. Someone is hiding millions in losses, and the only way to prove who is to query the fund's database yourself before the market opens at 9:30 AM.

**Player:** a Business of Art & Design student heading into fintech who has only ever coded with AI.
**Learns:** `SELECT`, `FROM`, `WHERE`, `AND`, `ORDER BY`, `LIMIT`, `SUM`, `GROUP BY` (and `HAVING` as a bonus).

## Run it

**In WebStorm:** open this folder, open `index.html`, and click the browser icon in the top-right corner of the editor.

**Without WebStorm:** double-click `index.html`. It works as long as you're online, since the SQL engine loads from the internet.

## Add the images

Generate the 11 images with an AI image tool (the prompts are in the Image Prompts doc) and save them in the `images/` folder with exactly these names. Until an image exists, the game shows a dark placeholder naming the image that goes there.

`lobby.jpg` · `floor.jpg` · `desk.jpg` · `marcus-desk.jpg` · `theo-desk.jpg` · `hallway.jpg` · `elevator-lit.jpg` · `office-door.jpg` · `office-inside.jpg` · `window-dawn.jpg` · `floor-morning.jpg`

## Line up the clickable spots on your images

Three scenes have spots to click: Marcus's desk, Theo's desk and Dana's office. To place them on your images:

1. Add `?dev` to the end of the address, e.g. `index.html?dev`
2. Use the menu in the bottom-left corner to jump to a `search` beat
3. Click the middle of the object in your image. A message shows its position, e.g. `x: 34.5, y: 61.2`
4. In `js/story.js`, set that spot's `x` and `y` to the top-left corner, and `w` and `h` to its width and height (all in % of the screen)

The dev menu also jumps to any scene, which is handy for testing.

## Change the story

Everything the player reads is in `js/story.js`: narration, texts, questions, hints, choices and endings. Each query has an `answer`. The game runs the player's query and the answer, then compares the results, so any correct way of writing it passes.

To change the case data (names, amounts, times), edit `data/build_case.py`, then run:

```
python3 data/build_case.py    # rebuilds data/case.sql and js/case-data.js
python3 data/check_case.py    # confirms every clue in the story is still in the data
```

## Files

| File | What it does |
| --- | --- |
| `index.html` | The page |
| `css/style.css` | The look: darkness, film grain, flashlight, phone, terminal |
| `js/story.js` | **The whole story.** Edit this one most |
| `js/game.js` | Plays the story in order, the clock, saving, the end summary |
| `js/terminal.js` | The SQL terminal: editor, results, hints, pinning evidence |
| `js/checker.js` | Checks answers and explains mistakes |
| `js/ui.js` | Phone, choices, searching images, notebook |
| `js/db.js` | Loads the SQL engine and the case database |
| `js/sound.js` | Sound effects, generated in code |
| `js/case-data.js` | The case database (generated, don't edit) |
| `data/` | Scripts that build and check the case database |

## Put it online (GitHub Pages)

1. Create a repository on GitHub and push this folder to it (WebStorm: **Git → GitHub → Share Project on GitHub**).
2. On GitHub: **Settings → Pages → Source: Deploy from a branch → main / root → Save**.
3. After a minute your game is live at `https://<your-username>.github.io/<repository-name>/`.

## Playtesting

The last screen shows the player's results: the before/after challenge, tries and hints per scene, and every mistake they made. Click **Copy results** and paste it into your playtest notes.
