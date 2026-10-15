/** Presentation only: client reports describe intent; confirmed ledger rows establish revenue. */
const PRODUCTS = new Set(['swap', 'spot', 'futures', 'predict', 'xstocks']);
const CHAINS = { 1: ['Ethereum', 'etherscan.io'], 10: ['Optimism', 'optimistic.etherscan.io'],
  56: ['BNB Chain', 'bscscan.com'], 137: ['Polygon', 'polygonscan.com'], 8453: ['Base', 'basescan.org'],
  42161: ['Arbitrum', 'arbiscan.io'], 43114: ['Avalanche', 'snowtrace.io'],
  1151111081099710: ['Solana', 'solscan.io'] };
const text = (v, max = 120) => typeof v === 'string' ? v.trim().slice(0, max) : '';
export function decimalAmount(v) {
  if (v == null || typeof v === 'boolean' || !['string', 'number'].includes(typeof v)) return null;
  const s = String(v).trim();
  return s.length <= 100 && /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(s)
    && Number.isFinite(Number(s)) && Number(s) >= 0 ? s : null;
}
const chainId = v => Number.isSafeInteger(Number(v)) && Number(v) > 0 ? Number(v) : null;
const chainName = (id, label) => CHAINS[id]?.[0] || text(label, 60) || (id ? `Сеть ${id}` : 'Сеть не записана');
function txEvidence(row, d, cid) {
  const hash = text(row.tx_hash || d.txHash, 150);
  if (/^0x[a-f\d]{64}$/i.test(hash)) return { hash, url: CHAINS[cid]?.[1] && cid !== 1151111081099710 ? `https://${CHAINS[cid][1]}/tx/${hash}` : null };
  if (/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(hash) && cid === 1151111081099710) return { hash, url: `https://solscan.io/tx/${hash}` };
  if (/^hl:\d+$/.test(hash)) return { hash, url: null };
  return null; // Never interpret a free-text note, signed payload or URL as a transaction.
}
const NO_FEE = { status: 'unavailable', amount_usd: null, label: 'Нет подтверждённых данных', evidence: 'Газ и комиссия протокола не считаются доходом GROM' };
function ledgerMatch(row, trade, fills) {
  if (row.product !== 'swap' || !trade.tx || !/^0x[a-f\d]{40}$/i.test(row.wallet_address || '')) return null;
  const matches = fills.filter(f => f.product === 'swap' && f.status === 'confirmed'
    && Number(f.chain_id) === trade.chain_id
    && String(f.tx_hash).toLowerCase() === trade.tx.hash.toLowerCase()
    && String(f.wallet_address).toLowerCase() === row.wallet_address.toLowerCase()
    && f.attribution === 'lifi:grom-exchange' && f.evidence?.source === 'lifi_analytics'
    && f.evidence?.integrator === 'grom-exchange');
  return matches.length === 1 ? matches[0] : null;
}
function confirmedFee(fill) {
  const fees = fill?.evidence?.feeCosts;
  if (!Array.isArray(fees) || !fees.length) return { ...NO_FEE };
  let sum = 0, splits = 0;
  for (const fee of fees) {
    if (fee?.feeSplit?.integratorFee == null) continue;
    const share = decimalAmount(fee.feeSplit.integratorFee), amount = decimalAmount(fee.amount), usd = decimalAmount(fee.amountUSD);
    if (share == null || amount == null || usd == null || !(Number(amount) > 0) || Number(share) > Number(amount)) return { ...NO_FEE };
    sum += Number(usd) * Number(share) / Number(amount); splits++;
  }
  const recorded = decimalAmount(fill.fee_usd);
  if (!splits || recorded == null || !Number.isFinite(sum) || Math.abs(Number(recorded) - sum) > Math.max(1e-10, sum * 1e-8)) return { ...NO_FEE };
  return { status: 'confirmed', amount_usd: recorded, label: 'Подтверждено LiFi',
    evidence: 'Доля GROM по учёту LiFi · не подтверждение вывода средств' };
}
export function tradeFacts(row, fills = []) {
  if (!PRODUCTS.has(row.product)) return null;
  const d = row.detail && typeof row.detail === 'object' ? row.detail : {};
  const from = text(d.from || d.fromSym || row.asset, 40), to = text(d.to || d.toSym, 40);
  const cid = chainId(d.fromChainId || d.chainId || d.chain_id || d.chain);
  const dest = chainId(d.toChainId);
  const hl = ['spot', 'futures'].includes(row.product);
  const instrument = text(d.contract || d.coin || row.asset, 60);
  let amount = decimalAmount(d.amt ?? d.amtNum ?? d.amount ?? row.amount);
  let unit = text(d.amountAsset, 40) || from || null;
  let amountLabel = 'Сумма в записи';
  if (hl) {
    // Historical HL logs store USD notional in row.amount, not the quantity of the asset.
    const size = decimalAmount(d.size ?? d.sz);
    amount = size ?? decimalAmount(row.amount);
    unit = size != null ? (text(d.sizeAsset, 40) || instrument || null) : (amount != null ? 'USD' : null);
    amountLabel = size != null ? 'Размер ордера / исполнения' : 'Объём в записи';
  } else if (row.product === 'predict') {
    unit = text(d.amountAsset, 40) || null; // Old bets do not record collateral units.
  }
  const fields = [];
  const field = (label, value) => { if (value != null && value !== '') fields.push({ label, value: String(value).slice(0, 500) }); };
  const side = text(d.side || d.dir, 80);
  field('Направление', ({ buy: 'Покупка', sell: 'Продажа', long: 'Лонг', short: 'Шорт' })[side] || side);
  field('Рынок', text(d.market, 500)); field('Исход', text(d.outcome, 150));
  field('Тип ордера', text(d.orderType || d.type, 60));
  field('Плечо', decimalAmount(d.leverage) != null ? `${decimalAmount(d.leverage)}×` : null);
  field('Цена в записи', decimalAmount(d.price ?? d.px));
  field('Маршрут', text(d.aggregator || d.bridge || d.venue, 80));
  field('ID ордера', text(d.orderId, 100));
  const stage = text(d.stage || row.status, 60);
  const stages = { awaiting_signature: 'Ожидание подписи', awaiting_approval: 'Разрешение токена', unknown: 'Результат неизвестен', preparing: 'Подготовка', quoting: 'Расчёт маршрута', approving: 'Разрешение токена',
    signing: 'Ожидание подписи', submitted: 'Отправка заявлена клиентом', source_confirmed: 'Клиент сообщил подтверждение исходной сети',
    bridging: 'Межсетевой перевод', completed: 'Клиент сообщил завершение', filled: 'Сообщение об исполнении',
    open: 'Ордер размещён', error: 'Сообщение об ошибке', failed: 'Сообщение о сбое', cancelled: 'Отмена', rejected: 'Отказ', refunded: 'Возврат', partial: 'Частичное исполнение' };
  const trade = { pair_label: row.product === 'predict' ? 'Рынок / исход' : 'Пара / инструмент',
    pair: row.product === 'predict' ? [text(d.market, 180), text(d.outcome, 100)].filter(Boolean).join(' · ') || null : hl ? (instrument || (from && to ? `${from} / ${to}` : null)) : (from && to ? `${from} → ${to}` : from || null),
    amount: amount == null ? null : { value: amount, asset: unit, label: amountLabel },
    chain_id: cid, network: hl ? 'Hyperliquid' : chainName(cid, d.fromChainLabel || d.chainLabel || d.chain)
      + (dest && dest !== cid ? ' → ' + chainName(dest, d.toChainLabel) : ''),
    stage: stages[stage] || stage || 'Этап не записан', fields, tx: txEvidence(row, d, cid),
    execution_label: 'Параметры из сообщения · исполнение не проверено', commission: { ...NO_FEE } };
  if (row.action === 'probe' || row.action === 'probe-canary' || row.action === 'swap_simbolico_poc') {
    trade.execution_label = 'Диагностическая запись · исполнение сделки не подтверждено';
    return trade;
  }
  const fill = ledgerMatch(row, trade, fills);
  if (fill) {
    trade.execution_label = 'Для этой транзакции есть подтверждение LiFi DONE';
    trade.commission = confirmedFee(fill);
  }
  return trade;
}
/** One bounded DB read per page, no chain calls, no transaction actions. */
export async function enrichTradeFacts(rows, query) {
  const initial = rows.map(row => tradeFacts(row));
  const hashes = [...new Set(initial.flatMap((t, i) => rows[i].product === 'swap' && t?.tx && /^0x[a-f\d]{64}$/i.test(t.tx.hash) ? [t.tx.hash.toLowerCase()] : []))];
  let fills = [], unavailable = false;
  if (hashes.length) {
    try {
      ({ rows: fills } = await query(`SELECT product, chain_id, tx_hash, wallet_address, status, attribution, fee_usd, evidence
        FROM dimension_fills WHERE product='swap' AND status='confirmed' AND lower(tx_hash)=ANY($1::text[]) LIMIT 400`, [hashes.slice(0, 200)]));
      if (fills.length >= 400) { fills = []; unavailable = true; }
    } catch (_) { unavailable = true; }
  }
  return rows.map((row, i) => {
    const trade = fills.length ? tradeFacts(row, fills) : initial[i];
    if (unavailable && trade && row.product === 'swap') trade.commission = { ...NO_FEE, label: 'Учёт комиссии временно недоступен' };
    return { ...row, trade };
  });
}
/** Literal substring search: no wildcard surprises, no user text interpolated into SQL. */
export function addActivitySearch(filters, params, raw) {
  const search = text(raw, 160);
  if (!search) return;
  params.push(search);
  filters.push(`strpos(lower(concat_ws(' ', wallet_address, action, asset, amount::text, tx_hash,
    detail->>'from', detail->>'to', detail->>'amt', detail->>'amount', detail->>'txHash', detail->>'contract', detail->>'coin', detail->>'market', detail->>'outcome', detail->>'message')), lower($${params.length})) > 0`);
}
