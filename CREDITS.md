# Credits

## Made by

**Kayla Tang**: game design, story, art direction, sound direction and image prompts.

Made for CTEC 200: Innovation and Coding, Ringling College of Art and Design, Fall 2026.

## Code

- **Game code** (HTML, CSS and JavaScript): built with [Claude Code](https://claude.com/claude-code) (Anthropic), directed, reviewed and playtested by the author.
- **[sql.js](https://github.com/sql-js/sql.js)**: SQLite compiled to WebAssembly, by the sql.js contributors. MIT License. A copy is included in `lib/`.
- **[SQLite](https://www.sqlite.org)**: public domain.

## Type

All fonts are loaded from [Google Fonts](https://fonts.google.com) under the SIL Open Font License 1.1.

- **Archivo** by Omnibus-Type: titles, and anything a person says
- **IBM Plex Mono** by IBM: the SQL terminal, and anything the machine says
- **Courier Prime** by Alan Dague-Greene: the case notebook and evidence cards

## Sound

Every sound is generated in code with the Web Audio API. No recorded audio is used.

- **Ambient:** the room hum, a score that builds through the night (drone, pulse and high notes), and the last-hour clock tick.
- **Effects:** phone buzz, message tones, key clicks, correct and wrong queries, the evidence stamp, elevator ding, footsteps, badge reader, shock hit, sting, heartbeat, the clock roll and hour chime, and the lost-minutes sound.

## Images

- **Scene images:** every image in `images/` was generated with [ChatGPT](https://chatgpt.com) by OpenAI, from prompts written by the author, and is used as generated. The screenshots in `docs/screenshots/` show these images in the game.

## Story and data

- All characters, companies and trades are fictional. Kestrel Point Capital is not a real company, and any resemblance to real people is coincidental.
- The rogue-trader premise is inspired by real cases such as Nick Leeson (Barings Bank, 1995) and Jérôme Kerviel (Société Générale, 2008). No real people appear in the game.

## Accessibility testing

- Automated checks with [axe-core](https://github.com/dequelabs/axe-core) by Deque Systems (MPL 2.0), run during development. It is not part of the game.

## Playtesting

Thanks to classmates in CTEC 200 for playtesting and feedback, which led to clickable table names, separate ambient and effects sound, and the clock you can hear.
