# Ledger Detective: Night Shift

**Play it here: https://kaylatgg.github.io/ledger-detective/**

An interactive thriller where you learn SQL by writing it yourself.

It's Sunday, 11:40 PM, on Floor 3 of Kestrel Point Capital, a fund that looks after two billion dollars. You're a junior risk analyst three weeks into the job, and secretly you're helping the FBI. Someone on your floor is hiding millions in losses. You have until the market opens at 9:30 AM to find out who, and the only tool you have is the fund's trade database.

About 30 minutes. Best with headphones. Works in any modern browser on a laptop or desktop.

## How to play

- **Click or press Space** to move the story forward.
- **Write SQL in the terminal** and press **Enter** to run it. Shift + Enter adds a new line. You type every query yourself; pasting is turned off, because typing is how it sticks.
- **Stuck?** Press **Hint**. The first hint is free. After that, each hint costs 5 minutes on the clock.
- **Answer timed choices** by clicking or pressing **1**, **2** or **3**. If time runs out, that counts as your answer.
- **Search rooms** by clicking anything that looks worth a closer look.
- **Check your phone.** Texts arrive during the night. Click the phone to open it.
- **Press N** for your case notebook: who's who, clues, pinned evidence, terms and an SQL cheat sheet.
- **Press M** to turn the sound on or off.

Your progress saves automatically in your browser, so you can close the tab and continue later.

## What you'll learn

No coding experience needed. A short interactive lesson at the start shows how a query works, and every query you type is translated into plain English as you write it.

| Skill | What it does |
| --- | --- |
| `SELECT … FROM` | Choose which columns to show, from which table |
| `WHERE` | Keep only the rows that match |
| `AND` | Match two conditions at once |
| `ORDER BY … DESC`, `LIMIT` | Sort the results and keep the top few |
| `SUM`, `GROUP BY` | Add up totals for each person or group |
| `HAVING` | Filter those totals (optional bonus scene) |

When a query is wrong, the game explains the specific mistake in plain words, such as a missing comma, missing quotes or the wrong order, instead of just saying "error". You also get the same skills check at the start and the end of the night, so you can see how far you came.

## Features

- Four endings, decided by what you find and the choices you make
- A case notebook that fills in as the night goes on
- Evidence you pin yourself, in your own words, and send in a final report
- An end screen that shows what you learned: your before and after answers, every skill you used, and the mistakes you fixed

## Made with

Plain HTML, CSS and JavaScript, with no frameworks and no build step. The SQL runs in your browser with [sql.js](https://github.com/sql-js/sql.js) (SQLite compiled to WebAssembly), so nothing you type is sent anywhere. Every sound is generated in code. Full credits are in [CREDITS.md](CREDITS.md).

Made by Kayla Tang for CTEC 200: Innovation and Coding, Ringling College of Art and Design, Fall 2026.

## Run it on your own computer

Download or clone this repository, then either:

- double-click `index.html` (you'll need an internet connection, because the SQL engine and fonts load online), or
- run `python3 -m http.server` in this folder and open http://localhost:8000 (the SQL engine then loads from the `lib/` folder).
