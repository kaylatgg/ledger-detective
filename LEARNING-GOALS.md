# Learning goals

## Who the player is

A first-year art and design student who has never written a line of code and has never seen a database. They're comfortable with a laptop and a browser, and they like story games, but "SQL" means nothing to them yet.

## What they'll be able to do when they finish

By the end of the night, the player can read and write SQL queries like these by hand:

| # | The player can… | Example they write themselves |
| --- | --- | --- |
| 1 | **Pull a table's data, all of it or only the columns they need,** with `SELECT … FROM` | `SELECT trader, amount FROM trades` |
| 2 | **Keep only the rows that match**, with `WHERE`, putting text values in quotes and combining two conditions with `AND` | `SELECT * FROM trades WHERE amount > 9000 AND account = 'error'` |
| 3 | **Sort results and keep the top few**, with `ORDER BY … DESC` and `LIMIT` | `SELECT trader, amount, time FROM trades WHERE account = 'error' ORDER BY amount DESC LIMIT 5` |
| 4 | **Add up totals for each person**, with `SUM` and `GROUP BY` (and, in an optional scene, filter those totals with `HAVING`) | `SELECT entered_by, SUM(amount) FROM trades WHERE account = 'error' GROUP BY entered_by` |
| 5 | **Fix a broken query** by reading the error message, and check that a query that runs really answers the question | Turning `SELECT trader amount … WHERE account = error ORDER BY amount` into a working query |

## Where in the game each one is taught

| Goal | Taught in | Practised again in |
| --- | --- | --- |
| 1. `SELECT … FROM` | "How a query works" lesson (click-through on real rows); Scene 1 *Open the trade records* (`SELECT *`); Scene 2 *Only what matters* (choosing columns, commas) | Every scene after |
| 2. `WHERE`, quotes, `AND` | Scene 3 *The error account* (`WHERE`, text in quotes); Scene 4 *Just under the line* (`AND`, numbers) | Scene 8 *The badge log* (a new table); Scene 9 *DR Holdings* |
| 3. `ORDER BY`, `DESC`, `LIMIT` | *Predict before you run* (ORDER BY changes the order, never the count); Scene 5 *The biggest five* | Scene 6 *Fix Theo's query*; Scene 9 *DR Holdings* (oldest first) |
| 4. `SUM`, `GROUP BY` (`HAVING`) | Scene 7 *Totals*; optional *Only the big totals* (`HAVING`) | Finale *Whose name is on them* and *Who typed them in*: the same total grouped two ways solves the case |
| 5. Fixing a broken query | Scene 6 *Fix Theo's query*: three bugs (a missing comma, missing quotes, a missing `DESC` that gives no error at all) | Every wrong answer anywhere: the game names the specific mistake in plain words instead of just saying "error" |

## How the game checks they learned it

- **Before and after:** the same question with no hints at the very start and the very end of the night ("Show every trade with an amount over 10000"). The end screen shows both attempts side by side.
- **Typing, not reading:** pasting is turned off, so every query is typed by the player. The live plain-English reading under the editor shows them what their query means as they write it.
- **The end screen** lists every skill they used, every mistake they fixed, and how many hints they needed, and the player can copy it as a record.
