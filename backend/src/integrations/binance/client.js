import crypto from 'node:crypto';
import config from '../../config/index.js';
import logger from '../../utils/logger.js';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class BinanceClient {
  constructor(opts = {}) {
    this.apiKey = opts.apiKey || config.binance.apiKey;
    this.apiSecret = opts.apiSecret || config.binance.apiSecret;
    this.baseUrl = (opts.baseUrl || config.binance.baseUrl).replace(/\/$/, '');
    this.dryRun = opts.dryRun ?? config.binance.dryRun;
    this.weightLimit = opts.weightLimit || config.binance.apiWeightPerMinute;
    this.weightWindowStarted = Date.now();
    this.weightUsed = 0;
    this.connected = false;
    this.consecutiveFailures = 0;
    this.lastError = null;
  }

  sign(queryString) {
    return crypto.createHmac('sha256', this.apiSecret).update(queryString).digest('hex');
  }

  async consumeWeight(weight = 1) {
    const now = Date.now();
    if (now - this.weightWindowStarted > 60_000) {
      this.weightWindowStarted = now;
      this.weightUsed = 0;
    }
    if (this.weightUsed + weight > this.weightLimit) {
      await sleep(Math.max(250, 60_000 - (now - this.weightWindowStarted)));
      this.weightWindowStarted = Date.now();
      this.weightUsed = 0;
    }
    this.weightUsed += weight;
  }

  async signedRequest(method, path, params = {}, { weight = 1, retries = 2 } = {}) {
    if (!this.apiKey || !this.apiSecret) throw new Error('binance_credentials_required');
    await this.consumeWeight(weight);
    const finalParams = {
      ...params,
      timestamp: Date.now(),
      recvWindow: 5000,
    };
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(finalParams)) {
      if (value !== undefined && value !== null && value !== '') qs.set(key, String(value));
    }
    qs.set('signature', this.sign(qs.toString()));
    const url = `${this.baseUrl}${path}?${qs.toString()}`;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const res = await fetch(url, { method, headers: { 'X-MBX-APIKEY': this.apiKey } });
      const text = await res.text();
      const body = text ? JSON.parse(text) : {};
      if (res.status === 429 && attempt < retries) {
        await sleep(500 * (attempt + 1));
        continue;
      }
      if (!res.ok) {
        const err = new Error(body.msg || `binance_${res.status}`);
        err.status = res.status;
        err.body = body;
        this.markHealth(false, err);
        throw err;
      }
      this.markHealth(true);
      return body;
    }
    throw new Error('binance_retry_exhausted');
  }

  markHealth(ok, err = null) {
    this.connected = ok;
    if (ok) {
      this.consecutiveFailures = 0;
      this.lastError = null;
    } else {
      this.consecutiveFailures += 1;
      this.lastError = err?.message || String(err || 'unknown');
    }
  }

  async withdraw({ coin, network, address, amount, memo }) {
    if (this.dryRun) return { id: `dryrun-${Date.now()}`, status: 'DRY_RUN' };
    return this.signedRequest('POST', '/sapi/v1/capital/withdraw/apply', {
      coin,
      network,
      address,
      amount,
      addressTag: memo || undefined,
    });
  }

  async getServerTime() {
    if (this.dryRun) return { serverTime: Date.now(), dryRun: true };
    await this.consumeWeight(1);
    const res = await fetch(`${this.baseUrl}/api/v3/time`);
    const body = await res.json();
    if (!res.ok) {
      const err = new Error(body.msg || `binance_${res.status}`);
      this.markHealth(false, err);
      throw err;
    }
    this.markHealth(true);
    return body;
  }

  async getWithdrawHistory(params = {}) {
    if (this.dryRun) return [];
    return this.signedRequest('GET', '/sapi/v1/capital/withdraw/history', params, { weight: 18 });
  }

  async getDepositHistory(params = {}) {
    if (this.dryRun) return [];
    return this.signedRequest('GET', '/sapi/v1/capital/deposit/hisrec', params, { weight: 1 });
  }

  async getDepositAddress({ coin, network }) {
    if (this.dryRun) {
      return { address: `dryrun-${coin}-${network}-deposit`, tag: null, coin, network };
    }
    return this.signedRequest('GET', '/sapi/v1/capital/deposit/address', { coin, network }, { weight: 10 });
  }

  async createVirtualSubAccount(subAccountString) {
    if (this.dryRun) return { email: subAccountString, subaccountId: `dry-${subAccountString}` };
    return this.signedRequest('POST', '/sapi/v1/sub-account/virtualSubAccount', { subAccountString });
  }

  async getSubAccountDepositAddress({ email, coin, network }) {
    if (this.dryRun) {
      return { address: `dryrun-${email}-${coin}-${network}`, tag: null, coin, network };
    }
    return this.signedRequest('GET', '/sapi/v1/capital/deposit/subAddress', { email, coin, network }, { weight: 1 });
  }

  async getAccountStatus() {
    if (this.dryRun) {
      this.markHealth(true);
      return { data: 'Normal', dryRun: true };
    }
    return this.signedRequest('GET', '/sapi/v1/account/status');
  }

  status() {
    return {
      connected: this.connected,
      consecutiveFailures: this.consecutiveFailures,
      lastError: this.lastError,
      baseUrl: this.baseUrl,
      dryRun: this.dryRun,
      weightUsed: this.weightUsed,
    };
  }

  startHealthCheck({ intervalMs = 60_000 } = {}) {
    const tick = async () => {
      try {
        await this.getAccountStatus();
      } catch (err) {
        logger.warn({ err: err.message }, 'binance health check failed');
      }
    };
    const timer = setInterval(tick, intervalMs);
    timer.unref?.();
    setTimeout(tick, 1000).unref?.();
    return { stop: () => clearInterval(timer) };
  }
}

export const binance = new BinanceClient();

export default BinanceClient;
