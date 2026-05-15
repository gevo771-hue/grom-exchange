import express from 'express';
import axios from 'axios';

const BINANCE_SYMBOLS = [
  'BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT','LINKUSDT',
  'TONUSDT','TRXUSDT','DOTUSDT','ATOMUSDT','NEARUSDT','LTCUSDT','BCHUSDT','SUIUSDT','1000PEPEUSDT',
  '1000SHIBUSDT','APTUSDT','UNIUSDT','ETCUSDT','ICPUSDT','ARBUSDT','OPUSDT'
];

function fallbackQuotes() {
  return {
    crypto: {
      BTC: 104218.4, ETH: 3684.15, SOL: 182.27, BNB: 612.88, XRP: 2.48, ADA: 0.752, DOGE: 0.1942,
      AVAX: 38.44, LINK: 17.28, TON: 6.42, TRX: 0.1462, DOT: 7.11, ATOM: 8.54, NEAR: 6.37, LTC: 96.42,
      BCH: 522.18, SUI: 1.84, PEPE: 0.0000124, SHIB: 0.0000246, APT: 9.87, UNI: 11.42, ETC: 31.75,
      ICP: 14.33, ARB: 1.06, OP: 2.91,
    },
    fx: { EURUSD: 1.0842, GBPJPY: 193.482, USDJPY: 151.12 },
    equities: { AAPL: 206.8, TSLA: 173.4, MSFT: 417.2, NVDA: 922.4 },
  };
}

export function createMarketRouter() {
  const r = express.Router();

  r.get('/quotes', async (_req, res) => {
    const payload = fallbackQuotes();

    try {
      const { data } = await axios.get('https://api.binance.com/api/v3/ticker/price', {
        params: { symbols: JSON.stringify(BINANCE_SYMBOLS) },
        timeout: 5000,
      });
      if (Array.isArray(data)) {
        data.forEach((row) => {
          const price = Number(row.price);
          if (!Number.isFinite(price)) return;
          const symbol = String(row.symbol || '').toUpperCase();
          const set = (asset, value) => { payload.crypto[asset] = value; };
          if (symbol === 'BTCUSDT') set('BTC', price);
          else if (symbol === 'ETHUSDT') set('ETH', price);
          else if (symbol === 'SOLUSDT') set('SOL', price);
          else if (symbol === 'BNBUSDT') set('BNB', price);
          else if (symbol === 'XRPUSDT') set('XRP', price);
          else if (symbol === 'ADAUSDT') set('ADA', price);
          else if (symbol === 'DOGEUSDT') set('DOGE', price);
          else if (symbol === 'AVAXUSDT') set('AVAX', price);
          else if (symbol === 'LINKUSDT') set('LINK', price);
          else if (symbol === 'TONUSDT') set('TON', price);
          else if (symbol === 'TRXUSDT') set('TRX', price);
          else if (symbol === 'DOTUSDT') set('DOT', price);
          else if (symbol === 'ATOMUSDT') set('ATOM', price);
          else if (symbol === 'NEARUSDT') set('NEAR', price);
          else if (symbol === 'LTCUSDT') set('LTC', price);
          else if (symbol === 'BCHUSDT') set('BCH', price);
          else if (symbol === 'SUIUSDT') set('SUI', price);
          else if (symbol === '1000PEPEUSDT') set('PEPE', price / 1000);
          else if (symbol === '1000SHIBUSDT') set('SHIB', price / 1000);
          else if (symbol === 'APTUSDT') set('APT', price);
          else if (symbol === 'UNIUSDT') set('UNI', price);
          else if (symbol === 'ETCUSDT') set('ETC', price);
          else if (symbol === 'ICPUSDT') set('ICP', price);
          else if (symbol === 'ARBUSDT') set('ARB', price);
          else if (symbol === 'OPUSDT') set('OP', price);
        });
      }
    } catch (_) {}

    try {
      const { data } = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 5000 });
      if (data && data.rates) {
        const eur = Number(data.rates.EUR);
        const gbp = Number(data.rates.GBP);
        const jpy = Number(data.rates.JPY);
        if (eur) payload.fx.EURUSD = 1 / eur;
        if (gbp && jpy) payload.fx.GBPJPY = (1 / gbp) * jpy;
        if (jpy) payload.fx.USDJPY = jpy;
      }
    } catch (_) {}

    try {
      const { data } = await axios.get('https://stooq.com/q/l/?s=aapl.us,tsla.us,msft.us,nvda.us&i=d', { timeout: 5000 });
      String(data || '').split('\n').forEach((line) => {
        const parts = line.split(',');
        if (parts.length < 7 || parts[0] === 'Symbol') return;
        const symbol = String(parts[0]).toUpperCase();
        const close = Number(parts[6]);
        if (!Number.isFinite(close)) return;
        if (symbol === 'AAPL.US') payload.equities.AAPL = close;
        else if (symbol === 'TSLA.US') payload.equities.TSLA = close;
        else if (symbol === 'MSFT.US') payload.equities.MSFT = close;
        else if (symbol === 'NVDA.US') payload.equities.NVDA = close;
      });
    } catch (_) {}

    res.json(payload);
  });

  return r;
}

export default createMarketRouter;
