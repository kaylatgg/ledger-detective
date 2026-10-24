"""Builds case.sql: the fake fund database for Ledger Detective: Night Shift.

Every clue in the story is planted here on purpose. Run:
    python3 build_case.py        -> writes case.sql next to this file
Amounts are whole US dollars stored as INTEGER (never decimals for money).
Times are 'YYYY-MM-DD HH:MM' text, so they sort correctly with ORDER BY.
"""
import random
from pathlib import Path

random.seed(1102)  # fixed seed: the same case every build

trades = []  # (time, trader, entered_by, action, stock, amount, account)


def add(time, trader, entered_by, action, stock, amount, account):
    trades.append((time, trader, entered_by, action, stock, amount, account))


WEEKDAYS = ["2026-10-26", "2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"]
STOCKS = ["NOVA", "ATLAS", "KITE", "ORBIT", "FERN"]

# 1. Normal daytime trading in the main account. Everyone enters their own trades.
people = [("Marcus", "marcus.l", 18000, 60000, 14),
          ("Priya", "priya.s", 12000, 48000, 12),
          ("Theo", "theo.k", 400, 3000, 8)]
for name, handle, lo, hi, count in people:
    for _ in range(count):
        day = random.choice(WEEKDAYS)
        t = f"{day} {random.randint(9, 15):02d}:{random.randint(0, 59):02d}"
        add(t, name, handle, random.choice(["BUY", "SELL"]), random.choice(STOCKS),
            random.randrange(lo, hi, 50), "main")

# 2. Genuine mistakes parked in the error account: small, entered by their own traders.
add("2026-10-26 11:04", "Priya", "priya.s", "SELL", "ATLAS", 1450, "error")
add("2026-10-27 14:22", "Theo", "theo.k", "BUY", "FERN", 320, "error")
add("2026-10-28 10:15", "Theo", "theo.k", "BUY", "KITE", 610, "error")
add("2026-10-30 15:41", "Priya", "priya.s", "BUY", "ORBIT", 980, "error")

# 3. THE SCHEME: 30 trades booked under Marcus's name but typed in by dana.r,
#    each just under Marcus's 10,000 trading limit, late at night on three nights.
nights = {"2026-10-27": 10, "2026-10-29": 10, "2026-11-01": 9}
for day, count in nights.items():
    free = [m for m in range(0, 50) if not (day == "2026-11-01" and m == 14)]
    for m in sorted(random.sample(free, count)):
        add(f"{day} 02:{m:02d}", "Marcus", "dana.r", random.choice(["BUY", "SELL"]),
            random.choice(STOCKS), random.randrange(9100, 9900, 10), "error")
# The biggest one lands at 2:14 AM Sunday, while Marcus's receipt puts him across town.
add("2026-11-01 02:14", "Marcus", "dana.r", "BUY", "NOVA", 9950, "error")

# 4. FRONT-RUNNING: Dana's personal account buys minutes before the fund's big buys.
pairs = [("2026-10-27", "NOVA", "09:33", "09:41", 3000, 48000),
         ("2026-10-28", "KITE", "10:02", "10:09", 2500, 42000),
         ("2026-10-29", "FERN", "13:15", "13:22", 4000, 46500)]
for day, stock, t_dr, t_fund, dr_amt, fund_amt in pairs:
    add(f"{day} {t_dr}", "Dana", "dana.r", "BUY", stock, dr_amt, "DR Holdings")
    add(f"{day} {t_fund}", "Priya", "priya.s", "BUY", stock, fund_amt, "main")

trades.sort(key=lambda r: r[0])
error_count = sum(1 for r in trades if r[6] == "error" and r[2] == "dana.r")
assert error_count == 30, error_count

# Badge log: Dana is in the building on every scheme night. Marcus is not.
badges = [
    ("Dana R.", "F3 east", "2026-10-27 01:52"),
    ("Dana R.", "F3 east", "2026-10-29 01:49"),
    ("Dana R.", "F3 east", "2026-11-01 01:58"),
    ("Dana R.", "F3 east", "2026-11-02 04:12"),  # the clock-in pop-in on game night
]
for day in WEEKDAYS:
    badges.append(("Marcus L.", "F3 main", f"{day} 07:{random.randint(10, 50):02d}"))
    badges.append(("Priya S.", "F3 main", f"{day} 08:{random.randint(0, 40):02d}"))
    badges.append(("Theo K.", "F3 main", f"{day} 08:{random.randint(30, 59):02d}"))
    badges.append(("Dana R.", "F3 east", f"{day} 08:{random.randint(15, 55):02d}"))
badges.sort(key=lambda r: r[2])


def q(s):
    return "'" + s.replace("'", "''") + "'"


lines = [
    "-- Ledger Detective: Night Shift - case database",
    "-- Amounts are whole US dollars (INTEGER). Times are 'YYYY-MM-DD HH:MM'.",
    "",
    "CREATE TABLE traders (name TEXT, handle TEXT, role TEXT, trading_limit INTEGER);",
    "INSERT INTO traders VALUES",
    "  ('Marcus', 'marcus.l', 'Trader', 10000),",
    "  ('Priya', 'priya.s', 'Senior trader', 50000),",
    "  ('Theo', 'theo.k', 'Intern', 5000),",
    "  ('Dana', 'dana.r', 'Head of trading', 100000);",
    "",
    "CREATE TABLE trades (id INTEGER PRIMARY KEY, time TEXT, trader TEXT, entered_by TEXT,",
    "  action TEXT, stock TEXT, amount INTEGER, account TEXT);",
    "INSERT INTO trades (time, trader, entered_by, action, stock, amount, account) VALUES",
]
lines += [f"  ({q(r[0])}, {q(r[1])}, {q(r[2])}, {q(r[3])}, {q(r[4])}, {r[5]}, {q(r[6])})"
          + ("," if i < len(trades) - 1 else ";") for i, r in enumerate(trades)]
lines += ["", "CREATE TABLE badge_swipes (name TEXT, door TEXT, time TEXT);",
          "INSERT INTO badge_swipes VALUES"]
lines += [f"  ({q(b[0])}, {q(b[1])}, {q(b[2])})" + ("," if i < len(badges) - 1 else ";")
          for i, b in enumerate(badges)]

sql_text = "\n".join(lines) + "\n"
Path(__file__).with_name("case.sql").write_text(sql_text)

# The game reads the same data from a .js file, so it also works when index.html
# is opened by double-clicking (browsers block reading .sql files from disk).
import json
js_path = Path(__file__).resolve().parent.parent / "js" / "case-data.js"
js_path.parent.mkdir(exist_ok=True)
js_path.write_text("// Generated by data/build_case.py - edit that script, not this file.\n"
                   f"window.CASE_SQL = {json.dumps(sql_text)};\n")
print(f"case.sql: {len(trades)} trades, {len(badges)} badge swipes")
