export class MarketMakerState {
  constructor({ dbQuery, logger = console } = {}) {
    this.query = dbQuery;
    this.logger = logger;
    this.openQuotes = new Map();
    this.positions = new Map();
    this.enabled = false;
    this.hedgeHealth = true;
    this.lastBinanceOkAt = 0;
  }

  async load() {
    const [quotes, positions] = await Promise.all([
      this.query(
        `SELECT mq.*, so.filled
           FROM mm_quotes mq
           LEFT JOIN spot_orders so ON so.id=mq.order_id
          WHERE mq.status IN ('placed','partial')
          ORDER BY mq.pair, mq.side, mq.layer`
      ),
      this.query(`SELECT * FROM mm_positions ORDER BY pair ASC`),
    ]);
    this.openQuotes.clear();
    for (const quote of quotes.rows || []) this.setQuote(quote);
    this.positions.clear();
    for (const position of positions.rows || []) this.positions.set(position.pair, position);
  }

  setQuote(quote) {
    if (!this.openQuotes.has(quote.pair)) this.openQuotes.set(quote.pair, []);
    const list = this.openQuotes.get(quote.pair);
    const idx = list.findIndex((item) => item.id === quote.id || item.order_id === quote.order_id);
    if (idx >= 0) list[idx] = quote;
    else list.push(quote);
  }

  clearPairQuotes(pair) {
    this.openQuotes.set(pair, []);
  }

  getPairQuotes(pair) {
    return this.openQuotes.get(pair) || [];
  }

  getPosition(pair) {
    return this.positions.get(pair) || { pair, net_position: 0, hedged_position: 0, realised_pnl_usdt: 0, unrealised_pnl_usdt: 0 };
  }

  async upsertPosition({ pair, netDelta = 0, hedgeDelta = 0, price = null }) {
    const current = this.getPosition(pair);
    const nextNet = Number(current.net_position || 0) + Number(netDelta || 0);
    const nextHedged = Number(current.hedged_position || 0) + Number(hedgeDelta || 0);
    const avgEntry = price || current.avg_entry_price || null;
    const { rows } = await this.query(
      `INSERT INTO mm_positions(pair, net_position, avg_entry_price, hedged_position, last_updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT(pair)
       DO UPDATE SET net_position=$2, avg_entry_price=COALESCE($3, mm_positions.avg_entry_price), hedged_position=$4, last_updated_at=NOW()
       RETURNING *`,
      [pair, nextNet, avgEntry, nextHedged]
    );
    this.positions.set(pair, rows[0]);
    return rows[0];
  }

  status() {
    const positions = Array.from(this.positions.values());
    return {
      enabled: this.enabled,
      hedgeHealth: this.hedgeHealth ? 'ok' : 'degraded',
      pairs: Array.from(this.openQuotes.keys()),
      positions,
      totalPnl: positions.reduce((sum, row) => sum + Number(row.realised_pnl_usdt || 0) + Number(row.unrealised_pnl_usdt || 0), 0),
    };
  }
}

export default MarketMakerState;
