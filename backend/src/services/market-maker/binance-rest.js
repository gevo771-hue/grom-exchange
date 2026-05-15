import crypto from 'node:crypto';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BinanceRest {
  constructor({ apiKey = '', apiSecret = '', baseUrl = 'https://testnet.binance.vision', dryRun = true } = {}) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.dryRun = dryRun;
    this.lastCallAt = 0;
  }

  async rateLimit() {
    const minGap = 100;
    const wait = this.lastCallAt + minGap - Date.now();
    if (wait > 0) await sleep(wait);
    this.lastCallAt = Date.now();
  }

  sign(params) {
    const qs = new URLSearchParams(params);
    const signature = crypto.createHmac('sha256', this.apiSecret).update(qs.toString()).digest('hex');
    qs.set('signature', signature);
    return qs.toString();
  }

  async request(path, { method = 'GET', signed = false, params = {} } = {}) {
    await this.rateLimit();
    const headers = this.apiKey ? { 'X-MBX-APIKEY': this.apiKey } : {};
    const finalParams = signed ? { ...params, timestamp: await this.getServerTime() } : params;
    const qs = signed ? this.sign(finalParams) : new URLSearchParams(finalParams).toString();
    const url = `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`;
    const res = await fetch(url, { method, headers });
    const text = await res.text();
    const body = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const err = new Error(body.msg || `binance_${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  }

  async getServerTime() {
    if (this.dryRun) return Date.now();
    const body = await this.request('/api/v3/time');
    return body.serverTime || Date.now();
  }

  async placeMarketOrder({ symbol, side, quantity, quoteQty }) {
    if (this.dryRun) {
      return {
        orderId: `dry-${Date.now()}`,
        status: 'DRY_RUN',
        executedQty: String(quantity || 0),
        cummulativeQuoteQty: String(quoteQty || 0),
      };
    }
    if (!this.apiKey || !this.apiSecret) throw new Error('binance_credentials_required');
    const params = {
      symbol,
      side: String(side).toUpperCase(),
      type: 'MARKET',
    };
    if (quoteQty) params.quoteOrderQty = String(quoteQty);
    else params.quantity = String(quantity);
    return this.request('/api/v3/order', { method: 'POST', signed: true, params });
  }

  async getAccountBalance(asset) {
    if (this.dryRun) return { asset, free: '1000000', locked: '0' };
    const body = await this.request('/api/v3/account', { signed: true });
    return (body.balances || []).find((row) => row.asset === asset) || { asset, free: '0', locked: '0' };
  }
}

export default BinanceRest;
