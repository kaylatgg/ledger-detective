"""Runs every scene's query against case.sql and checks each clue is really there."""
import sqlite3
from pathlib import Path

db = sqlite3.connect(":memory:")
db.executescript(Path(__file__).with_name("case.sql").read_text())


def run(label, sql):
    rows = db.execute(sql).fetchall()
    print(f"\n== {label}\n{sql}\n-> {len(rows)} rows")
    for r in rows[:8]:
        print("  ", r)
    return rows


r = run("Scene 0/11 before-after: trades over 10,000", "SELECT * FROM trades WHERE amount > 10000;")
assert all(x[6] > 10000 for x in r)

r = run("Scene 1", "SELECT * FROM trades;")
total = len(r)

run("Scene 2", "SELECT trader, amount FROM trades;")

r = run("Scene 3: the error account", "SELECT * FROM trades WHERE account = 'error';")
assert len(r) == 34 and sum(x[2] == "Marcus" for x in r) == 30

r = run("Scene 4: big error-account trades",
        "SELECT * FROM trades WHERE amount > 9000 AND account = 'error';")
assert len(r) == 30 and all(x[3] == "dana.r" for x in r)

r = run("Scene 5: biggest error-account trades",
        "SELECT trader, amount, time FROM trades WHERE account = 'error' ORDER BY amount DESC LIMIT 5;")
assert r[0] == ("Marcus", 9950, "2026-11-01 02:14")
assert all(" 02:" in x[2] for x in r)

r = run("Scene 6: Theo's query, fixed",
        "SELECT trader, amount FROM trades WHERE account = 'error' ORDER BY amount DESC;")
assert len(r) == 34

r = run("Scene 7: totals per trader", "SELECT trader, SUM(amount) FROM trades GROUP BY trader ORDER BY 2 DESC;")
assert r[0][0] == "Marcus"

r = run("Scene 8: the badge log", "SELECT * FROM badge_swipes WHERE name = 'Dana R.';")
nights = [x for x in r if x[2][11:13] in ("01", "04")]
assert len(nights) == 4

r = run("Marcus was never in the building at night",
        "SELECT * FROM badge_swipes WHERE name = 'Marcus L.' AND substr(time, 12, 2) < '06';")
assert len(r) == 0

# Every scheme night, Dana badged in shortly before the first error trade of that night.
for day in ("2026-10-27", "2026-10-29", "2026-11-01"):
    swipe = db.execute("SELECT MIN(time) FROM badge_swipes WHERE name = 'Dana R.' AND time LIKE ?", (day + " 0%",)).fetchone()[0]
    first = db.execute("SELECT MIN(time) FROM trades WHERE entered_by = 'dana.r' AND account = 'error' AND time LIKE ?", (day + "%",)).fetchone()[0]
    assert swipe and first and swipe < first, (day, swipe, first)

# dana.r never touches the main account, and nobody else enters trades for someone else.
assert db.execute("SELECT COUNT(*) FROM trades WHERE entered_by = 'dana.r' AND account = 'main'").fetchone()[0] == 0
assert db.execute("SELECT COUNT(*) FROM trades WHERE entered_by != 'dana.r' AND entered_by NOT LIKE lower(trader) || '.%'").fetchone()[0] == 0

# Every trade has a value in every column.
assert db.execute("SELECT COUNT(*) FROM trades WHERE time IS NULL OR trader IS NULL OR entered_by IS NULL OR amount IS NULL OR account IS NULL").fetchone()[0] == 0

r = run("Scene 9: DR Holdings", "SELECT * FROM trades WHERE account = 'DR Holdings' ORDER BY time;")
assert len(r) == 3

r = run("Scene 9 go deeper: NOVA buys that morning, in order",
        "SELECT time, account, action, amount FROM trades WHERE stock = 'NOVA' AND time BETWEEN '2026-10-27 09:30' AND '2026-10-27 10:00' ORDER BY time;")
assert [x[1] for x in r] == ["DR Holdings", "main"]

# Common beginner slips the game must explain: they run fine but return nothing.
assert db.execute("SELECT COUNT(*) FROM badge_swipes WHERE name = 'Dana'").fetchone()[0] == 0
assert db.execute("SELECT COUNT(*) FROM trades WHERE account = 'Error'").fetchone()[0] == 0

r = run("Scene 10 trap: group by trader",
        "SELECT trader, SUM(amount) FROM trades WHERE account = 'error' GROUP BY trader ORDER BY 2 DESC;")
assert r[0][0] == "Marcus"

r = run("Scene 10 finale: group by entered_by",
        "SELECT entered_by, SUM(amount) FROM trades WHERE account = 'error' GROUP BY entered_by ORDER BY 2 DESC;")
assert r[0][0] == "dana.r"

run("Stretch (HAVING): traders over 50,000 total",
    "SELECT trader, SUM(amount) FROM trades GROUP BY trader HAVING SUM(amount) > 50000;")

print(f"\nAll clues check out. {total} trades in the database.")
