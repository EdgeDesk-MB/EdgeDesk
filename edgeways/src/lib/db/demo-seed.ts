/**
 * Demo dataset (G2) - seeded into a FRESH edgeways-demo.db only. Real and
 * demo data never share a file (the demo DB is selected by resolveDbPath at
 * connection time), so demo rows can never leak into real analytics.
 * Numbers are realistic but invented; the account named "Demo Bank" and the
 * top-bar watermark make the mode unmistakable in screenshots.
 */
import type Database from "better-sqlite3";

const DAY = 24 * 60 * 60 * 1000;

export function seedDemoData(sqlite: Database.Database, now = Date.now()): void {
  const t = (daysAgo: number, hour = 12) => {
    const d = new Date(now - daysAgo * DAY);
    d.setHours(hour, 0, 0, 0);
    return d.getTime();
  };
  // Day N of the CURRENT month (capped at today) - keeps every settled demo
  // campaign inside one month so the Edge Report always renders ready.
  const md = (dayOfMonth: number, hour = 12) => {
    const ref = new Date(now);
    const day = Math.min(dayOfMonth, ref.getDate());
    return new Date(ref.getFullYear(), ref.getMonth(), day, hour, 0, 0, 0).getTime();
  };

  const insertAccount = sqlite.prepare(
    `INSERT INTO accounts (name, type, is_active, access_status, wr_remaining, wr_type, created_at)
     VALUES (?, ?, 1, ?, 0, 'stake', ?)`
  );
  const bankId = insertAccount.run("Demo Bank", "bank", "available", t(21)).lastInsertRowid;
  const bookies: Record<string, number | bigint> = {};
  for (const [name, access] of [
    ["Bet365", "available"],
    ["William Hill", "available"],
    ["Coral", "gubbed"],
    ["Sky Bet", "available"],
  ] as const) {
    bookies[name] = insertAccount.run(name, "bookie", access, t(21)).lastInsertRowid;
  }
  const exchangeAccId = insertAccount.run("Betfair", "exchange", "available", t(21)).lastInsertRowid;

  const insertTx = sqlite.prepare(
    `INSERT INTO balance_transactions (account_id, amount, category, note, created_at)
     VALUES (?, ?, ?, ?, ?)`
  );
  insertTx.run(bankId, 500, "top_up", "Starting bankroll", t(21));
  insertTx.run(exchangeAccId, 300, "top_up", "Exchange float", t(20));
  insertTx.run(bookies["Bet365"]!, 100, "top_up", "Deposit", t(20));
  insertTx.run(bookies["William Hill"]!, 50, "top_up", "Deposit", t(14));
  insertTx.run(bookies["Sky Bet"]!, 25, "top_up", "Deposit", t(6));

  const insertOffer = sqlite.prepare(
    `INSERT INTO offers (title, bookmaker, status, expected_profit, expires_at, created_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertBet = sqlite.prepare(
    `INSERT INTO bets (label, market, selection, bet_type, bookmaker, back_stake, back_odds,
       lay_stake, lay_odds, commission, status, actual_profit, balance_ledgered, balance_settled,
       created_at, settled_at, offer_id)
     VALUES (?, 'win', '', ?, ?, ?, ?, ?, ?, 0, ?, ?, 1, 1, ?, ?, ?)`
  );
  const insertSnapshot = sqlite.prepare(
    `INSERT INTO offer_ev_snapshots (offer_id, version, locked_at, expected_profit, basis,
       realized_profit, capture_pct, settled_at, mistake_tag)
     VALUES (?, 1, ?, ?, 'estimated', ?, ?, ?, ?)`
  );

  // Settled campaigns - all inside the current month so the Edge Report
  // (minimum five settled campaigns) always renders ready.
  const settled: Array<{
    title: string; bookie: string; expected: number; realized: number;
    lockDom: number; settleDom: number; tag: string | null;
  }> = [
    { title: "Bet £10 get £30 in free bets", bookie: "Bet365", expected: 22.5, realized: 21.1, lockDom: 1, settleDom: 3, tag: null },
    { title: "Bet £25 get £25 free bet", bookie: "William Hill", expected: 18.75, realized: 17.4, lockDom: 4, settleDom: 6, tag: null },
    { title: "Acca insurance reload", bookie: "Coral", expected: 12.0, realized: 4.8, lockDom: 7, settleDom: 9, tag: "laid_late" },
    { title: "Bet £10 get £10 reload", bookie: "Sky Bet", expected: 7.5, realized: 7.2, lockDom: 10, settleDom: 12, tag: null },
    { title: "Weekend price boost", bookie: "Bet365", expected: 6.0, realized: 6.4, lockDom: 12, settleDom: 13, tag: null },
  ];

  for (const c of settled) {
    const offerId = insertOffer.run(
      c.title, c.bookie, "completed", c.expected, null, md(c.lockDom), md(c.settleDom)
    ).lastInsertRowid;
    insertSnapshot.run(
      offerId, md(c.lockDom), c.expected, c.realized,
      c.realized / c.expected, md(c.settleDom), c.tag
    );
    // Qualifying leg (small loss) + conversion (the win)
    const qualLoss = -(Math.round(c.expected * 8) / 100);
    insertBet.run(
      `${c.title} - qualifier`, "qualifying", c.bookie, 10, 4.5, 9.8, 4.6,
      "lost", qualLoss, md(c.lockDom), md(c.lockDom), offerId
    );
    insertBet.run(
      `${c.title} - FB conversion`, "free_snr", c.bookie, 25, 5.5, 20.5, 5.7,
      "won", c.realized - qualLoss, md(c.settleDom), md(c.settleDom), offerId
    );
  }

  // Live pipeline: one active offer with an open qualifier, one planned.
  const activeId = insertOffer.run(
    "Bet £20 get £20 free bet", "Sky Bet", "active", 14.5, now + 2 * DAY, t(1), null
  ).lastInsertRowid;
  insertSnapshot.run(activeId, t(1), 14.5, null, null, null, null);
  sqlite
    .prepare(
      `INSERT INTO bets (label, market, selection, bet_type, bookmaker, back_stake, back_odds,
         lay_stake, lay_odds, commission, status, balance_ledgered, balance_settled, created_at, offer_id)
       VALUES (?, 'win', '', 'qualifying', 'Sky Bet', 20, 3.8, 19.6, 3.9, 0, 'open', 1, 0, ?, ?)`
    )
    .run("Bet £20 get £20 - qualifier", t(0, 9), activeId);
  insertOffer.run(
    "Midweek reload - bet £10 get £5", "William Hill", "planned", 3.75, now + 5 * DAY, t(0, 8), null
  );
}
