// story.js - the whole game, in order. Edit text here freely; the engine (game.js) plays it.
//
// Beat types:
//   chapter  - full-screen title card
//   scene    - an image (images/<image>) with narration lines; click to advance
//   texts    - messages arriving on your phone ({ me: true } = sent by you)
//   notify   - a pop-in notification
//   sticky   - a new finance term, added to the notebook
//   query    - the SQL terminal. answer = the correct query; the player's result must match it
//   predict  - guess what a query returns before running it
//   search   - click hotspots on an image (x, y, w, h are % of the frame); one has key: true
//   choice   - timed decision; options can set flags, cost time and send replies
//   report, ending, summary - the finale
// Any beat can have when: (flags) => true/false, and set: { flag: value }.

const OKAFOR = "Okafor (FBI)";
const UNKNOWN = "Unknown";
const DANA = "Dana Reyes";
const THEO = "Theo Kim";

const STORY = [
  // ---------- BEFORE ----------
  { type: "chapter", title: "Before you go in", sub: "FBI field office · Sunday, 9:00 PM" },
  {
    type: "texts",
    messages: [
      { from: OKAFOR, text: "Before I send you in: a quick skills check." },
      { from: OKAFOR, text: "Don't worry if you can't do it yet. You'll get the same question at the end of the night." },
    ],
  },
  {
    type: "query", id: "before", challenge: "before", voice: OKAFOR,
    label: "Skills check · before", title: "Before: trades over 10,000",
    question: "Show every trade with an amount over 10000.",
    answer: "SELECT amount FROM trades WHERE amount > 10000",
    success: ["You already know some SQL. Tonight will go faster."],
  },

  // ---------- ACT 1: 11:40 PM ----------
  { type: "chapter", title: "Ledger Detective", sub: "Night Shift", big: true },
  {
    type: "scene", image: "lobby.jpg", shot: "Elevator lobby, lights low", time: "11:40 PM", dark: true, sound: "ding",
    lines: [
      "Sunday. 11:40 PM.",
      "Floor 3, Kestrel Point Capital. A fund that looks after two billion dollars of other people's money.",
      "Three weeks ago you started here as a junior risk analyst. Nobody here knows you work for the FBI.",
    ],
  },
  {
    type: "texts",
    messages: [
      { from: OKAFOR, text: "You in?" },
      { me: true, text: "I'm in." },
      { from: OKAFOR, text: "Someone on your floor is hiding losses in the fund's books. Millions." },
      { from: OKAFOR, text: "Markets open at 9:30 AM. If those losses are still buried when trading starts, investors pay for it." },
      { from: OKAFOR, text: "I need a name. And proof. Before the bell." },
    ],
  },
  {
    type: "scene", image: "floor.jpg", shot: "Rows of desks, lights off, a few screens glowing", dark: true,
    lines: ["Every screen on the floor is asleep.", "Except yours."],
  },
  {
    type: "scene", image: "desk.jpg", shot: "Seated at a desk, looking at the monitor",
    lines: ["Your terminal can read the fund's trade database.", "Tonight, that's your only weapon."],
  },
  {
    type: "texts",
    messages: [
      { from: UNKNOWN, text: "you're the new risk analyst. right?" },
      { from: UNKNOWN, text: "don't reply. just listen." },
      { from: UNKNOWN, text: "you're looking for the right thing in the wrong place. open the trades table." },
    ],
  },
  { type: "sticky", term: "Trade", def: "Buying or selling something, like a stock. Every trade the fund makes is one row in the trades table." },
  { type: "lesson", id: "lesson", title: "How a query works" },
  {
    type: "query", id: "s1", label: "Scene 1 · 11:52 PM", title: "Open the trade records",
    question: "Show everything in the trades table.",
    template: "SELECT * FROM ___;",
    tool: ["SELECT says what to show. * means every column.", "FROM says which table to look in."],
    answer: "SELECT * FROM trades",
    hints: [
      "The question names the table you need. The Tables panel on the left lists every table you can look in.",
      "SELECT [which columns? * means all] FROM [which table?]",
      "SELECT * FROM [?]\nThe blank is the table's name. FROM tells the database where to look, so it has to match a name in the Tables panel exactly.",
    ],
    learn: [["SELECT * FROM table", "shows every column of a table"]],
    success: ["74 rows. Every buy and sell the fund made this week.", "Each row is one trade: when, who, what, how much, and which account."],
  },
  {
    type: "query", id: "s2", label: "Scene 2 · 12:10 AM", time: "12:10 AM", title: "Only what matters",
    question: "Too much noise. Show only two columns: trader and amount.",
    template: "SELECT ___, ___ FROM trades;",
    tool: ["List the columns you want after SELECT.", "Put a comma between them."],
    answer: "SELECT trader, amount FROM trades",
    hints: [
      "The question names the two columns you want. Check the Tables panel to see how they're spelled.",
      "SELECT [first column?] [what goes between them?] [second column?] FROM [which table?]",
      "SELECT trader[?] amount FROM trades\nThe blank goes between the two column names. Without it, SQL reads 'trader amount' as one column with a nickname, so you only get one column back. A comma tells it these are two separate columns.",
    ],
    learn: [["SELECT col1, col2 FROM table", "shows only the columns you list, separated by commas"]],
    success: ["Cleaner. Names and amounts.", "Most of it looks normal. You just don't know where to look yet."],
  },
  {
    type: "texts",
    messages: [
      { from: THEO, text: "wait r u at the office rn?? it says ur logged in lol" },
      { from: THEO, text: "random q. do u know what the error account is" },
      { from: THEO, text: "i asked around on friday and everyone got weird about it" },
      { from: UNKNOWN, text: "it's where mistakes get parked until someone fixes them." },
      { from: UNKNOWN, text: "it should be almost empty. check it." },
    ],
  },
  { type: "sticky", term: "Error account", def: "A holding spot for trades that went wrong, until someone fixes them. It should be almost empty." },
  {
    type: "query", id: "s3", label: "Scene 3 · 12:30 AM", time: "12:30 AM", title: "The error account",
    question: "Show every column, but only for trades in the error account.",
    keywords: "SELECT * FROM trades WHERE …",
    tool: ["WHERE keeps only the rows that match.", "Text values go in single quotes: WHERE stock = 'NOVA'"],
    answer: "SELECT * FROM trades WHERE account = 'error'",
    hints: [
      "One of the columns says which account each trade went to. Find it in the Tables panel.",
      "SELECT [which columns?] FROM [which table?] WHERE [which column?] = [which value?]",
      "SELECT * FROM trades WHERE account = [?]\nThe blank is the account name. It's text, so it needs single quotes around it. Without them, SQL thinks a bare word is the name of a column.",
    ],
    learn: [["WHERE column = 'text'", "keeps only matching rows. Text needs single quotes"]],
    success: ["34 trades, in an account that should be almost empty.", "30 of them carry the same name: Marcus."],
  },
  {
    type: "choice", id: "lock", speaker: OKAFOR, seconds: 12,
    prompt: "Marcus Lund. His name is on 30 of those trades. Want me to lock his system access right now?",
    options: [
      {
        label: "Lock him out now", set: { lockedMarcus: true }, remember: "Marcus will remember that.",
        reply: [{ me: true, text: "Lock him out." }, { from: OKAFOR, text: "Done. Marcus is locked out." }],
      },
      {
        label: "Not yet. Keep digging.",
        reply: [{ me: true, text: "Not yet." }, { from: OKAFOR, text: "Your call. Clock's running." }],
      },
    ],
    timeout: 1, timeoutText: "You hesitate too long. Okafor takes that as a no.",
  },
  {
    type: "scene", when: (f) => f.lockedMarcus,
    lines: ["Your phone stays dark.", "Whoever 'Unknown' is, they've stopped texting."],
  },
  {
    type: "query", id: "s4", label: "Scene 4 · 1:15 AM", time: "1:15 AM", title: "Just under the line",
    voice: (f) => (f.lockedMarcus ? OKAFOR : UNKNOWN),
    question: "Narrow it down: error-account trades where the amount is over 9000.",
    keywords: "SELECT * FROM trades WHERE … AND …",
    tool: ["AND joins two conditions. A row must match both.", "Numbers don't need quotes: amount > 9000"],
    answer: "SELECT * FROM trades WHERE amount > 9000 AND account = 'error'",
    hints: [
      "There are two conditions here, and a trade has to meet both. You already know how to write each one on its own.",
      "SELECT * FROM [which table?] WHERE [first condition] [which word joins them?] [second condition]",
      "SELECT * FROM trades WHERE account = 'error' [?] amount > 9000\nThe blank is the word that joins the two conditions. It keeps a row only when both are true, so every result is in the error account and over 9000.",
    ],
    learn: [["WHERE a AND b", "keeps rows that match both conditions"]],
    success: ["30 trades. Every one between 9,100 and 9,950.", "Not a single one reaches 10,000."],
  },
  { type: "sticky", term: "Trading limit", def: "The most a trader can spend on one trade without a boss signing off. Marcus's limit is 10,000." },
  {
    type: "texts",
    messages: [
      { from: UNKNOWN, when: (f) => f.lockedMarcus, text: "...you locked out the wrong person. keep going anyway." },
      { from: UNKNOWN, text: "every one of them just under his limit. that's not luck." },
      { from: UNKNOWN, text: "someone split big trades into small ones so nobody had to sign off." },
      { from: OKAFOR, text: "If it's Marcus, his desk might tell us something. Go look." },
    ],
  },

  // ---------- ACT 2: searching ----------
  {
    type: "scene", image: "floor.jpg", shot: "Rows of desks, lights off", time: "1:30 AM", dark: true,
    lines: ["1:30 AM. You switch on your phone's flashlight and cross the floor."],
  },
  {
    type: "search", image: "marcus-desk.jpg", shot: "Tidy desk with a receipt, a nameplate and a monitor", dark: true,
    prompt: "Marcus's desk. Move your flashlight. Click anything worth a closer look.",
    spots: [
      { x: 14, y: 52, w: 16, h: 13, label: "Nameplate", text: "MARCUS LUND. Two trading awards on the shelf above it." },
      { x: 49, y: 12, w: 36, h: 35, label: "Monitor", text: "Switched off. Just your own reflection in the dark glass." },
      {
        x: 35, y: 64, w: 13, h: 17, label: "Receipt", key: true,
        text: "A receipt. The Night Owl Diner, table 6. Paid Sunday at 2:14 AM. That's across town.",
        clue: "Marcus's receipt: The Night Owl Diner, paid Sunday 2:14 AM, across town.",
      },
    ],
    leave: "Back to your desk",
  },
  {
    type: "scene", image: "desk.jpg", shot: "Seated at a desk", time: "1:45 AM",
    lines: ["If Marcus was across town at 2:14 on Sunday morning, what was the database doing at 2:14?"],
  },
  {
    type: "predict", id: "p1", label: "Predict · 1:45 AM", title: "Predict before you run",
    query: "SELECT * FROM trades\nWHERE account = 'error' AND amount > 9000\nORDER BY amount DESC;",
    question: "Before you run anything: how many rows will this return?",
    options: ["5", "30", "74"], answer: 1,
    explain: "ORDER BY changes the order of the rows, never how many there are. Same 30 rows, biggest first.",
  },
  {
    type: "query", id: "s5", label: "Scene 5 · 1:50 AM", time: "1:50 AM", title: "The biggest five",
    question: "Show the trader, amount and time of the 5 biggest error-account trades, biggest first.",
    tool: ["ORDER BY amount sorts the rows. Add DESC for biggest first.", "LIMIT 5 keeps only the first 5 rows.", "Order: SELECT … FROM … WHERE … ORDER BY … LIMIT"],
    answer: "SELECT trader, amount, time FROM trades WHERE account = 'error' ORDER BY amount DESC LIMIT 5",
    orderBy: 1,
    hints: [
      "Three steps, in this order: keep only the error-account trades, sort them so the biggest comes first, then keep just the top few. The sticky note shows the order the parts go in.",
      "SELECT [which three columns?] FROM [which table?] WHERE [which condition?] ORDER BY [which column?] [which direction?] LIMIT [how many?]",
      "SELECT trader, amount, time FROM trades WHERE account = 'error' ORDER BY amount [?] LIMIT 5\nThe blank sets the sort direction. ORDER BY sorts smallest first unless you say otherwise, so LIMIT 5 would keep the five smallest. You need the word that flips it to biggest first.",
    ],
    learn: [["ORDER BY column DESC", "sorts biggest first (no DESC = smallest first)"], ["LIMIT n", "keeps only the first n rows"]],
    success: ["The biggest one: 9,950, booked at 2:14 AM on Sunday.", "The exact minute Marcus was paying for dinner across town."],
  },
  {
    type: "texts",
    messages: [
      { from: UNKNOWN, text: "now you're seeing it." },
      { from: UNKNOWN, text: "theo found something on friday before he got scared. his laptop's still on his desk." },
    ],
  },
  {
    type: "search", image: "theo-desk.jpg", shot: "Messy desk, open laptop, drink cans, sticky note", time: "2:20 AM", dark: true,
    prompt: "Theo's desk. Have a look around.",
    spots: [
      { x: 15, y: 40, w: 13, h: 21, label: "Drink cans", text: "Three empty cans. He was here late on Friday." },
      {
        x: 72, y: 59, w: 11, h: 9, label: "Sticky note", text: "In Theo's handwriting: 'error acct way too full. who signs these off??'",
        clue: "Theo's sticky note: 'error acct way too full. who signs these off??'",
      },
      { x: 37, y: 31, w: 30, h: 38, label: "Laptop", key: true, text: "Still logged in. A query is open in the editor. It never ran." },
    ],
    leave: "Open the laptop",
  },
  {
    type: "query", id: "s6", label: "Scene 6 · Theo's laptop", time: "2:25 AM", title: "Fix Theo's query",
    question: "Theo's query is broken in three places. Fix it so it shows trader and amount for error-account trades, biggest first.",
    template: "SELECT trader amount\nFROM trades\nWHERE account = error\nORDER BY amount;",
    tool: ["Run it first and read what goes wrong.", "Fix one problem at a time."],
    answer: "SELECT trader, amount FROM trades WHERE account = 'error' ORDER BY amount DESC",
    orderBy: 1,
    hints: [
      "Run it as it is and read the error message. It points at the first problem. Fix that one, run it again, and repeat.",
      "SELECT trader [problem 1: missing something?] amount\nFROM trades\nWHERE account = [problem 2: how is text written?]\nORDER BY amount [problem 3: which direction?]",
      "SELECT trader, amount FROM trades WHERE account = 'error' ORDER BY amount [?]\nThe comma and the quotes are fixed. The blank is the sneaky one: the query runs fine without it, it just sorts smallest first. No error message will catch that, so always check the results actually answer the question.",
    ],
    success: ["It runs. Marcus's 30 trades rise to the top.", "Theo was one comma, two quotes and a DESC away from finding this himself."],
  },
  {
    type: "scene", image: "desk.jpg", shot: "Seated at a desk", time: "3:10 AM",
    lines: ["3:10 AM. Back at your desk.", "Time to see the whole week at once."],
  },
  {
    type: "query", id: "s7", label: "Scene 7 · 3:10 AM", title: "Totals",
    question: "How much did each trader move in total this week? One row per trader.",
    tool: ["SUM(amount) adds up a column.", "GROUP BY trader gives one row per trader.", "Example: SELECT stock, SUM(amount) FROM trades GROUP BY stock;"],
    answer: "SELECT trader, SUM(amount) FROM trades GROUP BY trader",
    hints: [
      "You need one row per trader, showing that trader's total. That's two jobs: add up how much each trade was worth, and do the adding separately for each trader. The sticky note has an example.",
      "SELECT [which column names each row?], [which function adds up]([which column?]) FROM [which table?] GROUP BY [which column?]",
      "SELECT trader, SUM(amount) FROM trades GROUP BY [?]\nThe blank is the column you want one row for. GROUP BY gathers all the rows with the same value into one group, and SUM then adds up amount inside each group. It matches the column you put first in SELECT.",
    ],
    learn: [["SUM(column)", "adds up a column"], ["GROUP BY column", "one row per value, so SUM gives a total for each"]],
    success: ["Marcus: 873,650. Nobody else comes close.", "Every number points the same way. Almost too neatly."],
  },
  {
    type: "query", id: "s7b", optional: true, label: "Go deeper · optional", title: "Only the big totals",
    question: "Show only the traders whose total is over 50000.",
    tool: ["WHERE filters rows before they're added up.", "HAVING filters totals, after GROUP BY: HAVING SUM(amount) > 50000"],
    answer: "SELECT trader, SUM(amount) FROM trades GROUP BY trader HAVING SUM(amount) > 50000",
    hints: [
      "WHERE checks single rows before anything is added up, so it can't see totals yet. The sticky note shows the word that filters after GROUP BY.",
      "SELECT trader, SUM(amount) FROM trades GROUP BY [which column?] [which word filters totals?] [which total?] > [what number?]",
      "SELECT trader, SUM(amount) FROM trades GROUP BY trader [?] SUM(amount) > 50000\nThe blank is the word that filters totals. It runs after GROUP BY, once each trader's total exists, which is why WHERE can't do this job.",
    ],
    learn: [["HAVING SUM(column) > n", "filters totals after GROUP BY"]],
    success: ["Two traders: Marcus and Priya.", "WHERE filters rows. HAVING filters totals."],
  },
  {
    type: "texts",
    messages: [
      { from: DANA, text: "rookie. you're on the trade system at 3am?" },
      { from: DANA, text: "good. someone should be. I've had a bad feeling about Marcus for weeks." },
      { from: DANA, text: "I've been home all weekend, but I've got your back. send me whatever you find." },
    ],
  },
  {
    type: "choice", id: "dana", speaker: DANA, seconds: 10,
    prompt: "Your boss is offering to help.",
    options: [
      {
        label: "\"Thanks. I'll send you what I find.\"", set: { trustedDana: true }, remember: "Dana is in the loop now.",
        reply: [{ me: true, text: "Thanks. I'll send you what I find." }, { from: DANA, text: "good. send it to me first. not compliance." }],
      },
      {
        label: "\"I'll keep it between me and compliance.\"", set: { warnedDana: true }, remember: "Dana will remember that.",
        reply: [{ me: true, text: "I'll keep it between me and compliance." }, { from: DANA, text: "...ok. careful who you trust in there." }],
      },
      {
        label: "\"Just running the weekly checks.\"", remember: "Dana believes you. For now.",
        reply: [{ me: true, text: "Just running the weekly checks." }, { from: DANA, text: "at 3am? go home, rookie." }],
      },
    ],
    timeout: -1, timeoutText: "You leave it on read.", timeoutReply: [{ from: DANA, text: "hello?" }],
    timeoutRemember: "You didn't answer. Dana noticed.",
  },

  // ---------- ACT 3: 4:12 AM ----------
  {
    type: "scene", image: "hallway.jpg", shot: "Long corridor, one light on at the far end", time: "4:12 AM", dark: true, flicker: true,
    lines: ["4:12 AM. The floor is silent.", "Then, behind you, a beep."],
  },
  { type: "notify", title: "Badge reader · Floor 3 east", text: "Dana R. clocked in at 4:12 AM", sound: "beep", shock: true },
  {
    type: "scene", image: "elevator-lit.jpg", shot: "Same lobby as lobby.jpg, lights on", sound: "ding", shock: true,
    lines: ["The elevator lights are on.", "Footsteps. Coming your way."],
  },
  {
    type: "choice", id: "hide", speaker: "Footsteps", seconds: 8, sound: "footsteps", closeIn: true,
    prompt: "She's almost at the corner. Your terminal is wide open.",
    options: [
      { label: "Close the terminal", lines: ["You close it just in time. Her footsteps slow by your desk, then move on."] },
      {
        label: "Keep typing", lost: 10, set: { seenByDana: true }, remember: "Dana saw your screen.",
        lines: ["Dana stops behind your chair. \"Go home, rookie.\"", "She waits, arms folded, until you log off. Ten minutes gone."],
      },
    ],
    timeout: 1, timeoutText: "You freeze.",
  },
  {
    type: "scene", image: "office-door.jpg", shot: "Glass office door, ajar, light inside",
    lines: ["The glass door at the end of the floor closes behind her. The blinds come down."],
  },
  {
    type: "texts",
    messages: [
      { from: OKAFOR, text: "Dana told you she was home all weekend?" },
      { from: OKAFOR, text: "Badge logs don't lie. I've given you access to a new table: badge_swipes." },
    ],
  },
  {
    type: "query", id: "s8", label: "Scene 8 · 4:20 AM", time: "4:20 AM", title: "The badge log", unlock: "badges",
    voice: OKAFOR,
    question: "Show every badge swipe for Dana.",
    tool: ["New table: badge_swipes.", "One row each time a badge opens a door: name, door, time.", "Tip: look at the whole table first to see how names are written."],
    answer: "SELECT * FROM badge_swipes WHERE name = 'Dana R.'",
    hints: [
      "Names in this table might not be written the way you'd expect. Look at the whole table first and find how Dana's name appears.",
      "SELECT * FROM [which table?] WHERE [which column?] = [which value?]",
      "SELECT * FROM badge_swipes WHERE name = [?]\nThe blank is Dana's name exactly as the table writes it, in single quotes. = only matches when every letter, space and full stop is the same, so 'Dana' on its own finds nothing.",
    ],
    success: ["Normal mornings, Monday to Friday.", "And also: Tuesday 1:52 AM. Thursday 1:49 AM. Sunday 1:58 AM.", "\"Home all weekend.\""],
  },
  {
    type: "texts",
    messages: [
      { from: OKAFOR, text: "Tuesday, Thursday, Sunday. Just before 2 AM, every time." },
      { from: OKAFOR, text: "The same nights those trades were booked." },
      { from: OKAFOR, text: "We need to know why." },
    ],
  },
  {
    type: "scene", image: "office-door.jpg", shot: "Glass office door, ajar", time: "5:00 AM", dark: true, sound: "footsteps",
    lines: ["5:00 AM. Dana steps out with her phone to her ear and disappears into the stairwell.", "She left her office door open."],
  },
  {
    type: "search", image: "office-inside.jpg", shot: "Inside a private office: desk, monitor, drawer, framed photo", dark: true,
    prompt: "Dana's office. You have a minute, maybe two.",
    spots: [
      { x: 64, y: 62, w: 20, h: 16, label: "Drawer", text: "Locked." },
      { x: 15, y: 41, w: 9, h: 13, label: "Framed photo", text: "Dana and Marcus at last year's awards dinner. Both smiling." },
      {
        x: 33, y: 27, w: 19, h: 23, label: "Monitor", key: true,
        text: "A personal brokerage login on the screen. Account name: DR Holdings.",
        clue: "Dana's screen: a personal brokerage account called DR Holdings.",
      },
    ],
    leave: "Get out before she's back",
  },
  {
    type: "sticky", term: "Front-running",
    def: "Secretly buying for yourself right before your company makes a big buy, because you know the price is about to jump. It's illegal.",
  },
  {
    type: "query", id: "s9", label: "Scene 9 · 5:10 AM", time: "5:10 AM", title: "DR Holdings",
    question: "Show every trade in the DR Holdings account, oldest first.",
    tool: ["ORDER BY on its own sorts smallest or earliest first.", "Account names are text, so they need quotes."],
    answer: "SELECT * FROM trades WHERE account = 'DR Holdings' ORDER BY time",
    orderBy: 1,
    hints: [
      "Two steps: keep only the trades in the DR Holdings account, then sort them so the earliest comes first. One of the columns records when each trade happened.",
      "SELECT * FROM [which table?] WHERE [which column?] = [which value?] ORDER BY [which column?]",
      "SELECT * FROM trades WHERE account = 'DR Holdings' ORDER BY [?]\nThe blank is the column that records when each trade happened. ORDER BY sorts earliest first on its own, so you don't need DESC here: DESC would put the newest first.",
    ],
    success: ["Three buys: NOVA, KITE, FERN. Small amounts. Perfect timing."],
  },
  {
    type: "texts",
    messages: [
      { from: UNKNOWN, text: "look at the times." },
      { from: UNKNOWN, text: "she buys NOVA at 9:33. the fund buys NOVA at 9:41. KITE, FERN, same thing. minutes ahead, every time." },
      { from: OKAFOR, text: "That's front-running. It's a motive. It doesn't prove she booked those 30 trades." },
    ],
  },

  // ---------- FINALE ----------
  {
    type: "scene", image: "window-dawn.jpg", shot: "Window at sunrise", time: "8:30 AM",
    lines: ["8:30 AM. The sky over the city goes grey, then gold.", "One hour until the bell."],
  },
  {
    type: "texts",
    messages: [
      { from: OKAFOR, text: "I need it in writing. Whose trades are these, really?" },
      { from: DANA, text: "I'm calling it in. It's Marcus. Stay out of it." },
    ],
  },
  {
    type: "query", id: "s10a", label: "Finale · 8:35 AM", time: "8:35 AM", title: "Whose name is on them",
    question: "Total the error-account trades for each trader.",
    tool: ["Put it all together: WHERE filters first, then GROUP BY adds up."],
    answer: "SELECT trader, SUM(amount) FROM trades WHERE account = 'error' GROUP BY trader",
    hints: [
      "Two jobs: keep only the error-account trades, then total them for each trader. You've done both before, just not in the same query.",
      "SELECT [which column?], [total of which column?] FROM [which table?] WHERE [which condition?] GROUP BY [which column?]",
      "SELECT trader, SUM(amount) FROM trades [?] GROUP BY trader\nThe blank is the filter that keeps only error-account trades. It goes before GROUP BY because the database filters rows first, then adds up the ones that are left.",
    ],
    success: ["Marcus: 286,000.", "That's what anyone checking would see.", "That's what they're supposed to see."],
  },
  {
    type: "texts",
    messages: [
      { from: UNKNOWN, text: "that's whose NAME is on them." },
      { from: UNKNOWN, text: "anyone can type a name. look at the columns again." },
      { from: UNKNOWN, text: "who actually ENTERED them?" },
    ],
  },
  {
    type: "query", id: "s10b", label: "Finale · 8:42 AM", time: "8:42 AM", title: "Who typed them in",
    question: "Total the same error-account trades by the person who actually typed each one into the system.",
    tool: ["Look at the columns of the trades table again."],
    answer: "SELECT entered_by, SUM(amount) FROM trades WHERE account = 'error' GROUP BY entered_by",
    mistakes: [
      {
        test: (c) => /GROUP\s+BY\s+trader\b/i.test(c.bare),
        msg: "That still groups by whose name is on the trade. Which column records who typed it in?",
      },
    ],
    hints: [
      "The trader column is only the name written on each trade. Look at the trades table's columns in the Tables panel: one of them records who typed each trade in.",
      "SELECT [which column records who typed it?], SUM(amount) FROM trades WHERE account = 'error' GROUP BY [the same column]",
      "SELECT [?], SUM(amount) FROM trades WHERE account = 'error' GROUP BY [?]\nBoth blanks are the same column: the one that records who entered each trade, not whose name is on it. GROUP BY makes one row per person who typed trades in, and SELECT shows who each row is.",
    ],
    learn: [["The name on a record", "isn't always who made it. Check every column."]],
    success: ["dana.r: 286,000.", "Same trades. Same total. Different name.", "Dana typed in every one of them, under Marcus's name."],
  },
  {
    type: "texts", set: { revealed: true },
    messages: [
      { from: UNKNOWN, text: "now you see it." },
      { from: UNKNOWN, text: "it was never me." },
      { from: UNKNOWN, text: "— Marcus" },
      { from: OKAFOR, text: "dana.r. 286,000 dollars of trades, typed in under someone else's name." },
    ],
  },
  {
    type: "sticky", term: "Rogue trader",
    def: "Someone making trades they aren't allowed to make, and hiding the losses. Tonight, that's Dana Reyes.",
  },
  { type: "report", require: "s10b" },
  {
    type: "choice", id: "final", speaker: OKAFOR, sound: "footsteps",
    seconds: (s) => Math.max(12, 20 - Math.floor(s.lost / 10) * 2),
    prompt: (s) => `Bell's in ${Math.max(5, 48 - s.lost)} minutes. Who do I arrest? (Behind you, Dana's door opens.)`,
    options: [
      { label: "Dana Reyes. Sending the query as proof.", set: { ending: "caught" } },
      { label: "Dana Reyes. I'll explain on the phone.", set: { ending: "halfright" } },
      { label: "Marcus Lund.", set: { ending: "framed" } },
    ],
    timeout: -1, timeoutSet: { ending: "toolate" }, timeoutText: "You can't make yourself press send.",
  },
  {
    type: "ending", retry: "final",
    endings: {
      caught: {
        title: "Caught", tag: "You proved it with one word: entered_by.", image: "window-dawn.jpg",
        lines: (f) => [
          "9:12 AM. Two agents walk past your desk without looking at you.",
          "Dana's door opens. She looks at you once. She knows.",
          "The fund halts trading at the bell. The losses come out today, not after investors pay for them.",
          f.lockedMarcus
            ? "Marcus gets his access back with an apology. He doesn't reply to it."
            : "Your phone buzzes. Unknown number: 'thank you.'",
        ],
      },
      halfright: {
        title: "Half Right", tag: "You knew. You didn't prove it.", image: "window-dawn.jpg",
        lines: () => [
          "Dana's lawyer calls it a hunch from someone who started three weeks ago.",
          "With no query attached, it's your word against your boss's.",
          "She's suspended. Not charged. Not yet.",
        ],
      },
      framed: {
        title: "Framed", tag: "The name on a record isn't always who made it.", image: "floor-morning.jpg",
        lines: () => [
          "9:05 AM. Agents walk Marcus out past the trading floor. He doesn't fight it.",
          "Dana watches from her glass office, coffee in hand.",
          "9:31 AM. A text from the unknown number: 'you had it. it was in the data.'",
        ],
      },
      toolate: {
        title: "Too Late", tag: "The bell doesn't wait.", image: "floor-morning.jpg",
        lines: () => [
          "9:30 AM. The opening bell. Screens across the floor turn green, then red.",
          "The hidden losses hit the market before anyone can stop them.",
          "By lunch, Dana Reyes has resigned. By dinner, nobody can find her.",
        ],
      },
    },
  },

  // ---------- AFTER ----------
  { type: "chapter", title: "One last thing", sub: "No story. No hints." },
  {
    type: "query", id: "after", challenge: "after", voice: OKAFOR,
    label: "Skills check · after", title: "After: trades over 10,000",
    question: "Show every trade with an amount over 10000.",
    answer: "SELECT amount FROM trades WHERE amount > 10000",
    success: ["Same question as last night. This time, you wrote it yourself."],
  },
  { type: "summary" },
];
