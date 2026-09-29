const GW_CM_TR = {
  ru: { eyebrow: 'Q4 · БЕТА', h: 'Единый cross-margin — эффективность капитала ×3–5', sub: 'Используй Spot BTC + токенизированный AAPL + выплаты по прогнозам + yield-позиции как <b>единый залог</b> для perpetual-фьючерсов. Больше никто так не делает. Запуск для GROM Pro в Q4.', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'Прогнозы', c4: 'Yield-позиция', std: 'Стандарт', reg: 'Регулируемый залог', pay: 'Выплата зафиксирована', stab: 'Стейблкоин', a1: 'В список ожидания', a2: 'Подробнее', toast: 'Ты в списке беты cross-margin. Напишем в Telegram при запуске.' },
  en: { eyebrow: 'Q4 · BETA', h: 'Unified cross-margin — capital efficiency ×3–5', sub: 'Use your Spot BTC + tokenized AAPL + Prediction Market payouts + on-chain yield positions as a <b>single collateral pool</b> for perpetual futures. Nobody else does this. Available at Q4 launch for GROM Pro tier.', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'Predict market', c4: 'Yield position', std: 'Standard', reg: 'Regulated collateral', pay: 'Payout locked', stab: 'Stablecoin backed', a1: 'Join waitlist', a2: 'Learn more', toast: "You're on the cross-margin beta waitlist. We'll DM you on Telegram at launch." },
  es: { eyebrow: 'Q4 · BETA', h: 'Cross-margin unificado — eficiencia ×3–5', sub: 'Usa Spot BTC + AAPL tokenizado + Predict + yield como <b>colateral único</b>.', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'Predict', c4: 'Yield', std: 'Estándar', reg: 'Colateral regulado', pay: 'Pago fijo', stab: 'Respaldo estable', a1: 'Unirse', a2: 'Saber más', toast: 'Estás en la lista.' },
  ar: { eyebrow: 'Q4 · بيتا', h: 'هامش متقاطع موحّد — كفاءة رأس مال ×3-5', sub: 'استخدم BTC + AAPL + التنبؤات كضمان واحد.', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'التنبؤات', c4: 'العائد', std: 'قياسي', reg: 'ضمان منظم', pay: 'دفع ثابت', stab: 'مدعوم بمستقر', a1: 'انضم', a2: 'التفاصيل', toast: 'تم إضافتك.' },
  zh: { eyebrow: 'Q4 · 测试', h: '统一交叉保证金 — 资本效率 ×3–5', sub: '将 Spot BTC + 代币化 AAPL + 预测市场 + 收益仓位作为<b>单一抵押池</b>用于永续合约。独一无二。Q4 面向 GROM Pro 上线。', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: '预测市场', c4: '收益仓位', std: '标准', reg: '受监管抵押', pay: '收益锁定', stab: '稳定币支持', a1: '加入候补', a2: '了解更多', toast: '已加入 cross-margin 测试候补名单。上线时会通过 Telegram 通知。' },
  hi: { eyebrow: 'Q4 · बीटा', h: 'एकीकृत क्रॉस-मार्जिन — पूँजी दक्षता ×3–5', sub: 'Spot BTC + xStocks AAPL + Predict + Yield को एकल संपार्श्विक के रूप में उपयोग करें।', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'Predict', c4: 'Yield', std: 'मानक', reg: 'विनियमित', pay: 'लॉक', stab: 'स्थिर', a1: 'शामिल हों', a2: 'और जानें', toast: 'आप सूची में हैं।' },
  tr: { eyebrow: 'Q4 · BETA', h: 'Birleşik cross-margin — sermaye verimliliği ×3–5', sub: 'Spot BTC + xStocks AAPL + Predict + Yield tek teminat havuzu.', c1: 'Spot BTC', c2: 'xStocks AAPL', c3: 'Predict', c4: 'Yield', std: 'Standart', reg: 'Regüle teminat', pay: 'Sabit ödeme', stab: 'Stabil destekli', a1: 'Listeye katıl', a2: 'Daha fazla', toast: 'Listedesin.' },
};
const GW_AD_TR = {
  ru: { h: '🎁 Airdrop-фарминг', sub: 'Активные фарминги — по одному клику попадай на нужный сайт', badge: 'HOT', mark: 'Отметить', done: '✓ Готово' },
  en: { h: '🎁 Airdrop farming', sub: 'Active campaigns — one click to the right dApp', badge: 'HOT', mark: 'Mark done', done: '✓ Done' },
  es: { h: '🎁 Airdrop farming', sub: 'Campañas activas', badge: 'HOT', mark: 'Marcar', done: '✓ Hecho' },
  ar: { h: '🎁 صيد الإردروب', sub: 'حملات نشطة', badge: 'HOT', mark: 'تحديد', done: '✓ منجز' },
  zh: { h: '🎁 空投农场', sub: '活跃活动', badge: 'HOT', mark: '标记', done: '✓ 完成' },
  hi: { h: '🎁 एयरड्रॉप फार्मिंग', sub: 'सक्रिय अभियान', badge: 'HOT', mark: 'चिह्नित', done: '✓ पूर्ण' },
  tr: { h: '🎁 Airdrop çiftçiliği', sub: 'Aktif kampanyalar', badge: 'HOT', mark: 'İşaretle', done: '✓ Tamam' },
};
/* grom-wallet-dash.js — lazy dashboard extras (trending/mega/yield/airdrop/…) */
/* Loaded via import() from grom-wallet.js when dashboard/spot/referral boots. */
const R = window.__gwR || {};
const { gwAiOpen, gwDebounce, gwEnsureWalletUiCss, gwInjectDexPagesCss, gwOnRoute, gwRenderTrending, gwRenderYield, gwToast, gwVisibleInterval, hydrateReferralSlice } = R;

function gwSetupTrending() {
  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderTrending(); console.log('[GROM] trending rendered'); } catch (e) { console.warn('[GROM] trending', e); } } }, 250);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwTrendingCard') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  gwOnRoute(tryRender);
  window.addEventListener('grom:lang-change', () => { const el = document.getElementById('gwTrendingCard'); if (el) el.remove(); tryRender(); });
  // Auto-refresh every 5 min while dashboard is visible.
  gwVisibleInterval(() => { gwRenderTrending(); }, 5 * 60_000, () => !!(document.getElementById('gwTrendingCard') && document.getElementById('page-dashboard')?.offsetParent));
}

/* ==========================================================================
 * MEGA-SHIP 2026-07-09: Items #7 (LimitLop), #8 (Rebalance), #10 (NFT),
 *                       #11 (Perp), #12 (AI bot)
 * Compact card injections. Each ~30-50 lines with live public API.
 * ========================================================================== */
function gwInjectMegaCss() {
  gwEnsureWalletUiCss();
}

async function gwRenderRebalance() {
  try { document.getElementById('gwRebalanceCard')?.remove(); } catch (_) {}
  return;
  const page = document.getElementById('page-dashboard'); if (!page) return;
  gwInjectMegaCss();
  let wrap = document.getElementById('gwRebalanceCard');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwRebalanceCard'; wrap.className = 'gw-mg-wrap';
    const trending = document.getElementById('gwTrendingCard');
    if (trending) trending.after(wrap); else page.appendChild(wrap);
  }
  wrap.innerHTML = `<div class="gw-mg-card rebal">
    <div class="gw-mg-head"><div>
      <h3 class="gw-mg-h">⚖ Portfolio Rebalance</h3>
      <p class="gw-mg-sub">Задай целевое распределение — посчитаем свапы по твоему кошельку и исполним через DEX</p>
    </div><span class="gw-mg-badge">ONE-CLICK</span></div>
    <div id="gwRbCurrent" style="font-size:12px;color:#98a8c0;margin:0 0 10px;line-height:1.5">Connect wallet to see current allocation…</div>
    <div class="gw-rb-wrap">
      <div class="gw-rb-bar" id="gwRbBar">
        <div class="gw-rb-seg btc" id="gwRbBarBtc" style="width:50%"></div>
        <div class="gw-rb-seg eth" id="gwRbBarEth" style="width:30%"></div>
        <div class="gw-rb-seg usdt" id="gwRbBarUsdt" style="width:20%"></div>
      </div>
      <div class="gw-rb-grid">
        <div class="gw-rb-item"><div class="k"><span class="gw-rb-dot btc"></span>BTC</div><input class="gw-mg-inp" id="gwRbBtc" type="number" value="50" min="0" max="100" step="1" inputmode="numeric" />%</div>
        <div class="gw-rb-item"><div class="k"><span class="gw-rb-dot eth"></span>ETH</div><input class="gw-mg-inp" id="gwRbEth" type="number" value="30" min="0" max="100" step="1" inputmode="numeric" />%</div>
        <div class="gw-rb-item"><div class="k"><span class="gw-rb-dot usdt"></span>USDT</div><input class="gw-mg-inp" id="gwRbUsdt" type="number" value="20" min="0" max="100" step="1" inputmode="numeric" />%</div>
      </div>
      <div class="gw-rb-foot"><span>Target allocation</span><span class="gw-rb-sum ok" id="gwRbSum">100%</span></div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="gw-mg-cta o" id="gwRbGo" style="flex:1;justify-content:center;min-width:160px">Compute swap plan →</button>
      <button class="gw-mg-cta" id="gwRbExec" style="flex:1;justify-content:center;min-width:160px;display:none;background:linear-gradient(135deg,#22c17c,#0ea5e9);border:0;color:#04121f;font-weight:800">Execute plan →</button>
    </div>
    <div id="gwRbOut" style="margin-top:12px;font-size:12.5px;color:#98a8c0;line-height:1.55"></div>
  </div>`;

  const BUCKETS = ['BTC', 'ETH', 'USDT'];
  const DUST_USD = 0.75;

  function gwRbBucketOf(sym) {
    const s = String(sym || '').toUpperCase();
    if (s === 'BTC' || s === 'WBTC' || s === 'BTCB') return 'BTC';
    if (s === 'ETH' || s === 'WETH') return 'ETH';
    if (s === 'USDT' || s === 'USDC' || s === 'BUSD' || s === 'DAI') return 'USDT';
    return null;
  }

  function gwRbBuySym(bucket, chainId) {
    const cfg = (typeof GW_OC_SWAP !== 'undefined') ? GW_OC_SWAP[chainId] : null;
    if (!cfg) return null;
    if (bucket === 'ETH') {
      if (cfg.native === 'ETH') return 'ETH';
      if (cfg.tokens?.ETH) return 'ETH';
      if (cfg.tokens?.WETH) return 'WETH';
      return null;
    }
    if (bucket === 'USDT') {
      if (cfg.tokens?.USDT) return 'USDT';
      if (cfg.tokens?.USDC) return 'USDC';
      return null;
    }
    if (bucket === 'BTC') {
      if (cfg.tokens?.WBTC) return 'WBTC';
      if (cfg.tokens?.BTC) return 'BTC';
      return null;
    }
    return null;
  }

  function gwRbSyncBar() {
    const btc = Math.max(0, Math.min(100, Number(document.getElementById('gwRbBtc')?.value) || 0));
    const eth = Math.max(0, Math.min(100, Number(document.getElementById('gwRbEth')?.value) || 0));
    const usdt = Math.max(0, Math.min(100, Number(document.getElementById('gwRbUsdt')?.value) || 0));
    const sum = btc + eth + usdt;
    const sumEl = document.getElementById('gwRbSum');
    if (sumEl) {
      sumEl.textContent = Math.round(sum * 10) / 10 + '%';
      const ok = Math.abs(sum - 100) < 0.51;
      sumEl.classList.toggle('ok', ok);
      sumEl.classList.toggle('bad', !ok);
    }
    const scale = sum > 0 ? 100 / sum : 0;
    const barBtc = document.getElementById('gwRbBarBtc');
    const barEth = document.getElementById('gwRbBarEth');
    const barUsdt = document.getElementById('gwRbBarUsdt');
    if (barBtc) barBtc.style.width = (btc * scale) + '%';
    if (barEth) barEth.style.width = (eth * scale) + '%';
    if (barUsdt) barUsdt.style.width = (usdt * scale) + '%';
  }
  ['gwRbBtc', 'gwRbEth', 'gwRbUsdt'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', gwRbSyncBar);
  });
  gwRbSyncBar();

  async function gwRbPrices() {
    const px = { USDT: 1, USDC: 1, BUSD: 1, DAI: 1 };
    const need = ['BTC', 'ETH', 'BNB', 'WBTC'];
    await Promise.all(need.map(async (s) => {
      try {
        let p = 0;
        if (typeof gwDsPriceUsd === 'function') p = await gwDsPriceUsd(s);
        if (!(p > 0) && typeof gwOcFetchPrices === 'function') {
          const all = await gwOcFetchPrices();
          p = all[s] || all[s.replace('WBTC', 'BTC')] || 0;
        }
        if (!(p > 0) && typeof gwDsPriceUsd === 'function') {
          p = await gwDsPriceUsd(s === 'WBTC' ? 'BTC' : s);
        }
        if (p > 0) {
          px[s] = p;
          if (s === 'BTC') px.WBTC = p;
          if (s === 'WBTC') px.BTC = p;
        }
      } catch (_) {}
    }));
    return px;
  }

  async function gwRbLoadPortfolio() {
    let addr = null;
    try { addr = (typeof gwDisplayAddress === 'function') ? gwDisplayAddress() : null; } catch (_) {}
    if (!addr && typeof gwOcConnectedAddress === 'function') {
      try { addr = gwOcConnectedAddress(); } catch (_) {}
    }
    if (!addr) return { addr: null, total: 0, byBucket: { BTC: 0, ETH: 0, USDT: 0 }, positions: [] };

    const [prices, chains] = await Promise.all([
      gwRbPrices(),
      (typeof gwOcFetchAllChains === 'function') ? gwOcFetchAllChains(addr) : Promise.resolve([]),
    ]);
    const positions = [];
    for (const c of chains || []) {
      if (!c?.data) continue;
      const meta = c.meta || (typeof GW_OC_CHAIN_META !== 'undefined' ? GW_OC_CHAIN_META[c.chainId] : {}) || {};
      const nativeSym = meta.native || 'ETH';
      if (c.data.nativeEth > 0.0000001) {
        const bucket = gwRbBucketOf(nativeSym);
        // Only bucket native ETH/etc — never treat BNB as ETH
        if (bucket) {
          const px = prices[nativeSym] || prices[bucket] || 0;
          const usd = c.data.nativeEth * px;
          if (usd > 0.01) {
            positions.push({
              bucket, sym: nativeSym, chainId: c.chainId,
              chain: meta.label || String(c.chainId),
              amt: c.data.nativeEth, usd, px,
            });
          }
        }
      }
      for (const [sym, amt] of Object.entries(c.data.tokens || {})) {
        if (!(amt > 0)) continue;
        const bucket = gwRbBucketOf(sym);
        if (!bucket) continue;
        const px = prices[sym] || prices[bucket] || (bucket === 'USDT' ? 1 : 0);
        const usd = amt * px;
        if (usd < 0.01) continue;
        positions.push({
          bucket, sym: String(sym).toUpperCase(), chainId: c.chainId,
          chain: meta.label || String(c.chainId),
          amt, usd, px,
        });
      }
    }
    const byBucket = { BTC: 0, ETH: 0, USDT: 0 };
    for (const p of positions) byBucket[p.bucket] += p.usd;
    const total = byBucket.BTC + byBucket.ETH + byBucket.USDT;
    return { addr, total, byBucket, positions, prices };
  }

  function gwRbFmtUsd(n) {
    return '$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  function gwRbFmtAmt(n) {
    const x = Number(n) || 0;
    if (x >= 1) return x.toLocaleString('en-US', { maximumFractionDigits: 6 });
    return x.toPrecision(4).replace(/0+$/, '').replace(/\.$/, '');
  }

  async function gwRbRefreshCurrent() {
    const el = document.getElementById('gwRbCurrent');
    if (!el) return null;
    el.textContent = 'Loading balances…';
    try {
      const port = await gwRbLoadPortfolio();
      window.__gwRbPortfolio = port;
      if (!port.addr) {
        el.innerHTML = 'Подключи кошелёк (сверху справа), чтобы увидеть текущее распределение BTC / ETH / USDT.';
        return port;
      }
      if (!(port.total > 0.5)) {
        el.innerHTML = `Кошелёк <b style="color:#cfdfee">${port.addr.slice(0, 6)}…${port.addr.slice(-4)}</b> — нет значимого BTC / ETH / USDT для ребаланса.`;
        return port;
      }
      const pct = (u) => port.total > 0 ? ((u / port.total) * 100) : 0;
      el.innerHTML = `Now · <b style="color:#cfdfee">${gwRbFmtUsd(port.total)}</b>
        · BTC ${pct(port.byBucket.BTC).toFixed(0)}% (${gwRbFmtUsd(port.byBucket.BTC)})
        · ETH ${pct(port.byBucket.ETH).toFixed(0)}% (${gwRbFmtUsd(port.byBucket.ETH)})
        · Stable ${pct(port.byBucket.USDT).toFixed(0)}% (${gwRbFmtUsd(port.byBucket.USDT)})`;
      return port;
    } catch (e) {
      el.textContent = 'Не удалось загрузить балансы: ' + String(e?.message || e).slice(0, 120);
      return null;
    }
  }

  function gwRbPickSellPosition(positions, bucket, needUsd) {
    const list = positions.filter((p) => p.bucket === bucket && p.usd > DUST_USD)
      .sort((a, b) => b.usd - a.usd);
    if (!list.length) return null;
    const p = list[0];
    const takeUsd = Math.min(p.usd * 0.995, needUsd); // leave dust / gas buffer
    const amt = p.px > 0 ? (takeUsd / p.px) : 0;
    if (!(amt > 0) || !(takeUsd > DUST_USD)) return null;
    return { ...p, takeUsd, takeAmt: amt };
  }

  function gwRbBuildPlan(port, targets) {
    const total = port.total;
    const plan = [];
    if (!(total > DUST_USD)) return plan;

    const targetUsd = {};
    const delta = {};
    for (const b of BUCKETS) {
      targetUsd[b] = total * (targets[b] / 100);
      delta[b] = targetUsd[b] - port.byBucket[b];
    }

    // Work on a mutable clone of USD left per bucket
    const remaining = { ...port.byBucket };
    const sells = BUCKETS.filter((b) => delta[b] < -DUST_USD)
      .map((b) => ({ bucket: b, usd: -delta[b] }))
      .sort((a, b) => b.usd - a.usd);
    const buys = BUCKETS.filter((b) => delta[b] > DUST_USD)
      .map((b) => ({ bucket: b, usd: delta[b] }))
      .sort((a, b) => b.usd - a.usd);

    // Direct same-chain when possible, else sell→USDT then USDT→buy
    for (const sell of sells) {
      let left = sell.usd;
      for (const buy of buys) {
        if (left < DUST_USD || buy.usd < DUST_USD) continue;
        const pairUsd = Math.min(left, buy.usd);
        const sellPos = gwRbPickSellPosition(port.positions, sell.bucket, pairUsd);
        if (!sellPos) break;
        const takeUsd = Math.min(pairUsd, sellPos.takeUsd);
        const takeAmt = sellPos.px > 0 ? takeUsd / sellPos.px : 0;
        const buySymSame = gwRbBuySym(buy.bucket, sellPos.chainId);
        if (buySymSame && buySymSame !== sellPos.sym) {
          plan.push({
            kind: 'swap',
            fromSym: sellPos.sym,
            toSym: buySymSame,
            chainId: sellPos.chainId,
            chain: sellPos.chain,
            amt: takeAmt,
            usd: takeUsd,
            label: `Sell ${gwRbFmtAmt(takeAmt)} ${sellPos.sym} → ${buy.bucket} on ${sellPos.chain}`,
          });
        } else {
          // Two-leg via USDT on sell chain
          const mid = gwRbBuySym('USDT', sellPos.chainId);
          if (mid && mid !== sellPos.sym) {
            plan.push({
              kind: 'swap',
              fromSym: sellPos.sym,
              toSym: mid,
              chainId: sellPos.chainId,
              chain: sellPos.chain,
              amt: takeAmt,
              usd: takeUsd,
              label: `Sell ${gwRbFmtAmt(takeAmt)} ${sellPos.sym} → ${mid} on ${sellPos.chain}`,
            });
            // Find buy chain with USDT + target
            let buyChain = sellPos.chainId;
            let buySym = gwRbBuySym(buy.bucket, buyChain);
            if (!buySym) {
              const pref = [1, 42161, 56, 8453, 137, 10].find((c) => gwRbBuySym(buy.bucket, c) && gwRbBuySym('USDT', c));
              if (pref) { buyChain = pref; buySym = gwRbBuySym(buy.bucket, pref); }
            }
            const usdtSym = gwRbBuySym('USDT', buyChain) || 'USDT';
            if (buySym && buySym !== usdtSym) {
              const pxBuy = port.prices?.[buySym] || port.prices?.[buy.bucket] || 0;
              const buyAmt = pxBuy > 0 ? takeUsd / pxBuy : 0;
              plan.push({
                kind: 'swap',
                fromSym: usdtSym,
                toSym: buySym,
                chainId: buyChain,
                chain: ((typeof GW_OC_CHAIN_META !== 'undefined' && GW_OC_CHAIN_META[buyChain]) || {}).label || String(buyChain),
                amt: takeUsd / (port.prices?.[usdtSym] || 1), // ~USD of stables
                usd: takeUsd,
                label: `Buy ${buy.bucket}: ${usdtSym} → ${buySym} on ${((typeof GW_OC_CHAIN_META !== 'undefined' && GW_OC_CHAIN_META[buyChain]) || {}).label || buyChain} (~${gwRbFmtUsd(takeUsd)})`,
                note: buyAmt,
              });
            }
          } else {
            plan.push({
              kind: 'skip',
              label: `Cannot route ${sell.bucket} → ${buy.bucket} (no pool mapping on ${sellPos.chain})`,
            });
          }
        }
        left -= takeUsd;
        buy.usd -= takeUsd;
        remaining[sell.bucket] -= takeUsd;
        remaining[buy.bucket] = (remaining[buy.bucket] || 0) + takeUsd;
      }
    }
    return plan.filter((s) => s.kind !== 'skip' || true);
  }

  window.__gwRbPlan = null;

  document.getElementById('gwRbGo').onclick = async () => {
    const btc = Number(document.getElementById('gwRbBtc').value) || 0;
    const eth = Number(document.getElementById('gwRbEth').value) || 0;
    const usdt = Number(document.getElementById('gwRbUsdt').value) || 0;
    const sum = btc + eth + usdt;
    const out = document.getElementById('gwRbOut');
    const execBtn = document.getElementById('gwRbExec');
    if (Math.abs(sum - 100) > 0.51) {
      out.innerHTML = `<span style="color:#f87171">Сумма должна быть 100% (сейчас ${sum}%).</span>`;
      if (execBtn) execBtn.style.display = 'none';
      return;
    }
    out.innerHTML = 'Считаем план по балансу кошелька…';
    if (execBtn) execBtn.style.display = 'none';
    const port = await gwRbRefreshCurrent();
    if (!port?.addr) {
      out.innerHTML = `<span style="color:#f5b94d">Подключи кошелёк, чтобы посчитать реальный план.</span>`;
      return;
    }
    if (!(port.total > DUST_USD)) {
      out.innerHTML = `<span style="color:#f5b94d">Недостаточно BTC / ETH / USDT на кошельке.</span>`;
      return;
    }
    // Normalize tiny float drift
    const targets = { BTC: btc, ETH: eth, USDT: usdt };
    const plan = gwRbBuildPlan(port, targets);
    window.__gwRbPlan = { plan, port, targets, at: Date.now() };

    if (!plan.length) {
      out.innerHTML = `<span style="color:#22c17c">✓ Уже близко к цели</span> — существенных свапов не нужно (порог ~${gwRbFmtUsd(DUST_USD)}).`;
      return;
    }

    const swaps = plan.filter((p) => p.kind === 'swap');
    const skips = plan.filter((p) => p.kind === 'skip');
    out.innerHTML = `
      <div style="color:#cfdfee;font-weight:700;margin-bottom:6px">План · ${swaps.length} swap${swaps.length === 1 ? '' : 's'} · портфель ${gwRbFmtUsd(port.total)}</div>
      <ol style="margin:0;padding-left:18px">
        ${plan.map((p, i) => `<li style="margin:4px 0;color:${p.kind === 'skip' ? '#f5b94d' : '#98a8c0'}">${p.label}${p.usd && p.kind === 'swap' ? ` · ~${gwRbFmtUsd(p.usd)}` : ''}</li>`).join('')}
      </ol>
      <div style="margin-top:8px;font-size:11.5px;color:#6b7a92">Каждый шаг — подпись в кошельке (approve + swap). Можно остановить, отклонив транзакцию.</div>`;
    if (execBtn) execBtn.style.display = swaps.length ? 'inline-flex' : 'none';
  };

  document.getElementById('gwRbExec').onclick = async () => {
    const pack = window.__gwRbPlan;
    const out = document.getElementById('gwRbOut');
    const execBtn = document.getElementById('gwRbExec');
    const goBtn = document.getElementById('gwRbGo');
    if (!pack?.plan?.length) return;
    const swaps = pack.plan.filter((p) => p.kind === 'swap');
    if (!swaps.length) return;
    if (typeof gwOnChainSwapExec !== 'function') {
      out.innerHTML += `<div style="color:#f87171;margin-top:8px">Swap engine недоступен.</div>`;
      return;
    }
    if (execBtn) { execBtn.disabled = true; execBtn.textContent = 'Executing…'; }
    if (goBtn) goBtn.disabled = true;

    const logs = [];
    for (let i = 0; i < swaps.length; i++) {
      const s = swaps[i];
      logs.push(`<div style="color:#5dd5ff">[${i + 1}/${swaps.length}] ${s.label}…</div>`);
      out.innerHTML = logs.join('');
      try {
        // Align UI chain chip so quote/exec resolve the right network
        try {
          currentChainId = s.chainId;
          document.querySelectorAll('.gw-ds-chain.on').forEach((x) => x.classList.remove('on'));
          document.querySelector(`.gw-ds-chain[data-cid="${s.chainId}"]`)?.classList.add('on');
        } catch (_) {}
        const hash = await gwOnChainSwapExec(s.fromSym, s.toSym, s.amt);
        logs.push(`<div style="color:#22c17c">✓ ${s.fromSym}→${s.toSym} ${hash ? String(hash).slice(0, 12) + '…' : 'done'}</div>`);
        out.innerHTML = logs.join('');
      } catch (e) {
        const msg = String(e?.message || e || '').slice(0, 180);
        logs.push(`<div style="color:#f87171">✗ ${s.fromSym}→${s.toSym}: ${msg}</div>`);
        out.innerHTML = logs.join('') + `<div style="margin-top:8px;color:#f5b94d">Остановлено. Исправь и нажми Compute снова.</div>`;
        if (execBtn) { execBtn.disabled = false; execBtn.textContent = 'Execute plan →'; }
        if (goBtn) goBtn.disabled = false;
        return;
      }
    }
    logs.push(`<div style="color:#22c17c;font-weight:800;margin-top:8px">Готово. Обновляю балансы…</div>`);
    out.innerHTML = logs.join('');
    await gwRbRefreshCurrent();
    if (execBtn) { execBtn.disabled = false; execBtn.style.display = 'none'; execBtn.textContent = 'Execute plan →'; }
    if (goBtn) goBtn.disabled = false;
    try { if (typeof gwToast === 'function') gwToast('Rebalance complete', 'success'); } catch (_) {}
  };

  // Initial load + refresh when wallet connects
  gwRbRefreshCurrent();
  try {
    window.addEventListener('grom:wallet-changed', () => { gwRbRefreshCurrent(); });
  } catch (_) {}
}


function gwSetupMegaCards() {
  const strip = () => {
    ['gwPerpCard', 'gwAiBotCard', 'gwRef2Card', 'gwNftCard', 'gwRebalanceCard']
      .forEach((id) => document.getElementById(id)?.remove());
  };
  strip();
  const run = gwDebounce(() => {
    if (!document.getElementById('page-dashboard')) return;
    strip();
  }, 300);
  run();
  gwOnRoute(run);
  window.addEventListener('grom:lang-change', strip);
}

/* ==========================================================================
 * CEX cleanup — 2026-07-09
 * User pivot: full DEX, no more custodial deposit / cash / send.
 *   - Hide "Депозит" pill in top nav (Cursor-owned).
 *   - Hide "Пополнить" (Deposit) button inside Meta-Portfolio actions row.
 *   - Guard: clicking Wallet or Referral in the sidebar accidentally
 *     opens the wallet-modal on the Deposit tab (Cursor's SPA quirk) —
 *     close it right back if the current route is wallet/referral.
 *   - Landing "coins list / waitlist" is Cursor's territory — a note
 *     lives in PERF-SUGGESTIONS-FOR-CURSOR.md for him to pick up.
 * ========================================================================== */

/* ==========================================================================
 * DEX overlay for Referral / Wallet / Settings — 2026-07-10
 * Adds DEX-native cards + hides stubborn CEX cards that survived
 * gwInjectDexPagesCss. Idempotent, i18n-friendly.
 * ========================================================================== */
const GW_DP_TR = {
  ru: {
    walletH: '⚡ DEX Quick Actions', walletSub: 'Всё что нужно — свап, мост, обзор on-chain',
    walletA1: 'Мгновенный своп', walletA1s: '20+ сетей', walletA2: 'Bridge между сетями', walletA2s: 'LiFi + Squid', walletA3: 'Открыть в explorer', walletA3s: 'Etherscan/BscScan', walletA4: 'Свап через wallet', walletA4s: 'Non-custodial',
    setH: '⚙ DEX Preferences', setSub: 'Настройки маршрутизации и защиты от MEV',
    setSlip: 'Slippage по умолчанию', setSlipS: 'Максимальное проскальзывание для свапов', setMev: 'MEV protection', setMevS: 'Приоритет CoWSwap batch, если доступно', setAgg: 'Основной агрегатор', setAggS: 'Наш meta-agg сравнивает 6 источников', setRpc: 'Свой RPC (опционально)', setRpcS: 'Для приватного нод-провайдера',
    saved: 'Сохранено',
  },
  en: {
    walletH: '⚡ DEX Quick Actions', walletSub: 'Everything you need — swap, bridge, on-chain review',
    walletA1: 'Instant Swap', walletA1s: '20+ chains', walletA2: 'Cross-chain Bridge', walletA2s: 'LiFi + Squid', walletA3: 'View on explorer', walletA3s: 'Etherscan/BscScan', walletA4: 'Swap via wallet', walletA4s: 'Non-custodial',
    setH: '⚙ DEX Preferences', setSub: 'Routing settings and MEV protection',
    setSlip: 'Default slippage', setSlipS: 'Maximum slippage tolerated on swaps', setMev: 'MEV protection', setMevS: 'Prefer CoWSwap batch when available', setAgg: 'Preferred aggregator', setAggS: 'Our meta-agg compares 6 sources', setRpc: 'Custom RPC (optional)', setRpcS: 'For private node providers',
    saved: 'Saved',
  },
};
function gwDpLang() { let l='en'; try { const s=localStorage.getItem('grom_lang'); if (s&&GW_DP_TR[s]) l=s; } catch (_) {} return GW_DP_TR[l]||GW_DP_TR.en; }
function gwDpPrefLoad() { try { return JSON.parse(localStorage.getItem('gw_dex_prefs') || '{}'); } catch (_) { return {}; } }
function gwDpPrefSave(v) { try { localStorage.setItem('gw_dex_prefs', JSON.stringify(v)); } catch (_) {} }

function gwRenderDexWalletActions() {
  const page = document.getElementById('page-wallet'); if (!page) return;
  gwInjectDexPagesCss();
  let wrap = document.getElementById('gwDpWalletCard');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwDpWalletCard'; wrap.className = 'gw-dp-wrap';
    // Insert right after page title.
    const title = page.querySelector('.page-title, h1.page-title') || page.querySelector('h1');
    const subtitle = title?.nextElementSibling?.classList.contains('page-subtitle') ? title.nextElementSibling : null;
    (subtitle || title || page).after ? (subtitle || title || page).after(wrap) : page.prepend(wrap);
  }
  const t = gwDpLang();
  const addr = (localStorage.getItem('gw_addr') || '').toLowerCase();
  const explorerUrl = addr ? `https://etherscan.io/address/${addr}` : 'https://etherscan.io';
  wrap.innerHTML = `<div class="gw-dp-card">
    <div class="gw-dp-head"><div>
      <h3 class="gw-dp-h">${t.walletH}</h3>
      <p class="gw-dp-sub">${t.walletSub}</p>
    </div><span class="gw-dp-badge">DEX</span></div>
    <div class="gw-dp-grid">
      <a class="gw-dp-action" href="#dashboard" data-scroll="gw-ds-wrap"><span class="ic">⚡</span><span class="lbl">${t.walletA1}<div class="hint">${t.walletA1s}</div></span></a>
      <a class="gw-dp-action" href="#dashboard" data-scroll="gw-ds-wrap"><span class="ic">🌉</span><span class="lbl">${t.walletA2}<div class="hint">${t.walletA2s}</div></span></a>
      <a class="gw-dp-action" href="${explorerUrl}" target="_blank" rel="noopener"><span class="ic">🔍</span><span class="lbl">${t.walletA3}<div class="hint">${t.walletA3s}</div></span></a>
      <a class="gw-dp-action" href="#dashboard" data-scroll="gw-ds-wrap"><span class="ic">🔐</span><span class="lbl">${t.walletA4}<div class="hint">${t.walletA4s}</div></span></a>
    </div>
  </div>`;
  wrap.querySelectorAll('[data-scroll]').forEach((a) => {
    a.addEventListener('click', () => {
      setTimeout(() => { const el = document.querySelector('.' + a.dataset.scroll); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 250);
    });
  });
}

function gwRenderDexSettings() {
  const page = document.getElementById('page-settings'); if (!page) return;
  gwInjectDexPagesCss();
  let wrap = document.getElementById('gwDpSettingsCard');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwDpSettingsCard'; wrap.className = 'gw-dp-wrap';
    const title = page.querySelector('.page-title, h1.page-title') || page.querySelector('h1');
    const subtitle = title?.nextElementSibling?.classList.contains('page-subtitle') ? title.nextElementSibling : null;
    (subtitle || title || page).after ? (subtitle || title || page).after(wrap) : page.prepend(wrap);
  }
  const t = gwDpLang();
  const prefs = gwDpPrefLoad();
  const slip = prefs.slippage ?? '0.5';
  const mev = prefs.mev !== false;
  const agg = prefs.agg || 'auto';
  const rpc = prefs.rpc || '';
  wrap.innerHTML = `<div class="gw-dp-card">
    <div class="gw-dp-head"><div>
      <h3 class="gw-dp-h">${t.setH}</h3>
      <p class="gw-dp-sub">${t.setSub}</p>
    </div><span class="gw-dp-badge">DEX</span></div>
    <div class="gw-dp-row">
      <div class="k">${t.setSlip}<small>${t.setSlipS}</small></div>
      <div><input type="number" step="0.1" min="0.05" max="10" class="gw-dp-inp" id="gwDpSlippage" value="${slip}" style="width:80px" /> %</div>
    </div>
    <div class="gw-dp-row">
      <div class="k">${t.setMev}<small>${t.setMevS}</small></div>
      <label class="gw-dp-toggle"><input type="checkbox" id="gwDpMev" ${mev ? 'checked' : ''} /><span class="slider"></span></label>
    </div>
    <div class="gw-dp-row">
      <div class="k">${t.setAgg}<small>${t.setAggS}</small></div>
      <select class="gw-dp-sel" id="gwDpAgg">
        <option value="auto" ${agg === 'auto' ? 'selected' : ''}>Auto (best rate)</option>
        <option value="lifi" ${agg === 'lifi' ? 'selected' : ''}>LiFi</option>
        <option value="cow" ${agg === 'cow' ? 'selected' : ''}>CoWSwap (MEV-safe)</option>
        <option value="squid" ${agg === 'squid' ? 'selected' : ''}>Squid (Axelar)</option>
        <option value="paraswap" ${agg === 'paraswap' ? 'selected' : ''}>Paraswap</option>
        <option value="kyber" ${agg === 'kyber' ? 'selected' : ''}>KyberSwap</option>
        <option value="odos" ${agg === 'odos' ? 'selected' : ''}>Odos</option>
      </select>
    </div>
    <div class="gw-dp-row">
      <div class="k">${t.setRpc}<small>${t.setRpcS}</small></div>
      <input type="text" class="gw-dp-inp" id="gwDpRpc" placeholder="https://…" value="${rpc}" style="width:220px;text-align:left" />
    </div>
  </div>`;
  const save = () => {
    gwDpPrefSave({
      slippage: Number(document.getElementById('gwDpSlippage').value) || 0.5,
      mev: document.getElementById('gwDpMev').checked,
      agg: document.getElementById('gwDpAgg').value,
      rpc: document.getElementById('gwDpRpc').value.trim(),
    });
    try { gwToast(t.saved, 'success'); } catch (_) {}
  };
  ['gwDpSlippage', 'gwDpMev', 'gwDpAgg', 'gwDpRpc'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', save);
  });
}

/** Replaces Cursor's static fake-QR SVG on the Referral page with a real
 *  QR code generated by api.qrserver.com (dependency-free, public API).
 *  Also wipes the demo KPI numbers so anonymous users don't see fake stats. */
function gwFixReferralQR() {
  const page = document.getElementById('page-referral'); if (!page) return;
  const linkEl = page.querySelector('#refLink');
  if (!linkEl) return;
  const link = (linkEl.textContent || 'https://grom.exchange').trim();
  if (!link) return;
  // Find the fake QR SVG inside .ref-qr and swap it for a real image.
  const qrBox = page.querySelector('.ref-qr');
  if (qrBox && !qrBox.dataset.gwQrFixed) {
    qrBox.dataset.gwQrFixed = '1';
    const svg = qrBox.querySelector('svg');
    if (svg) {
      const img = document.createElement('img');
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(link)}`;
      img.alt = 'Scan to join GROM';
      img.width = 120; img.height = 120;
      img.style.cssText = 'display:block;margin:6px auto 0;background:#fff;border-radius:10px;padding:6px;box-sizing:content-box';
      svg.replaceWith(img);
    }
  }
  // Reset demo KPI numbers to '—' for anonymous users. Real numbers come
  // from hydrateReferralSlice once authed. Fake defaults (1,284 / 487 /
  // $18,473 / $342) were CEX-marketing — bad look on a fresh DEX.
  const isAuth = !!localStorage.getItem('grom_jwt') || !!localStorage.getItem('gw_addr');
  if (!isAuth) {
    const dashed = ['refKpiTotalReferred', 'refKpiActive30d', 'refKpiTotalEarned', 'refKpiPendingPayout'];
    dashed.forEach((id) => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
    ['refKpiTotalReferredDelta', 'refKpiActivationRate', 'refKpiTotalEarnedDelta',
     'refFunnelClicks', 'refFunnelSignups', 'refFunnelKyc', 'refFunnelFirstTrade'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.textContent = '—';
    });
    // Kill Cursor's fake accrual + batch-in copy in the Commission-status card.
    page.querySelectorAll('.ref-mini-card .v.mono').forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (/^\+?\$?\d/.test(txt) && !/^—$/.test(txt)) el.textContent = '$0.00';
    });
    page.querySelectorAll('.ref-mini-card .s').forEach((el) => {
      const txt = (el.textContent || '').trim();
      if (/^Next batch in\s+\d/i.test(txt) || /^Ready to settle$/i.test(txt)) el.textContent = 'Awaiting first referral';
    });
    // Blank out the hero's placeholder code + link before user signs in —
    // shows '—' instead of a nonexistent GROM-G7K3Q9 code.
    const refCode = document.getElementById('refCode');
    if (refCode && /^GROM-[A-Z0-9]+$/.test((refCode.textContent || '').trim())) {
      refCode.textContent = 'Sign in to generate';
    }
    const refLinkEl = document.getElementById('refLink');
    if (refLinkEl && (refLinkEl.textContent || '').includes('grom.exchange/r/G7K3Q9')) {
      refLinkEl.textContent = 'Sign in to reveal your link';
    }
  }
}

function gwSetupDexPages() {
  const run = gwDebounce(() => {
    try { if (document.getElementById('page-wallet'))   gwRenderDexWalletActions();   } catch (_) {}
    try { if (document.getElementById('page-settings')) gwRenderDexSettings();        } catch (_) {}
    try { if (document.getElementById('page-referral')) {
      gwFixReferralQR();
    } } catch (_) {}
  }, 250);
  run();
  let n = 0; const id = setInterval(() => { n++; const anyMounted = document.getElementById('gwDpWalletCard') || document.getElementById('gwDpSettingsCard'); if (anyMounted || n >= 20) clearInterval(id); else run(); }, 500);
  gwOnRoute(run);
  window.addEventListener('grom:lang-change', () => {
    ['gwDpWalletCard', 'gwDpSettingsCard'].forEach(id => document.getElementById(id)?.remove());
    run();
  });
}

function gwSetupYield() {
  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderYield(); console.log('[GROM] yield rendered'); } catch (e) { console.warn('[GROM] yield', e); } } }, 200);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwYieldCard') || n >= 20) clearInterval(id); else tryRender(); }, 500);
    gwOnRoute(tryRender);
  gwVisibleInterval(() => { gwRenderYield(); }, 5 * 60 * 1000, () => !!(document.getElementById('gwYieldCard') && document.getElementById('page-dashboard')?.offsetParent));
  window.addEventListener('grom:lang-change', () => { const el = document.getElementById('gwYieldCard'); if (el) el.remove(); tryRender(); });
}


/* ============================================================================
 * PHASE 5 — AIRDROP FARMING MODE
 * Curated list of currently active farming opportunities. Progress tracked
 * per-user in localStorage. Data is static-updated (revisit list monthly). */
const GW_AD_LIST = [
  { key: 'monad',     name: 'Monad',      cat: 'Testnet',   fee: 'Bridge $10',        est: 'S-tier · $500-2000',  url: 'https://testnet.monad.xyz/', desc: 'Bridge + swap on Monad testnet — expected mainnet Q4 2026.' },
  { key: 'megaeth',   name: 'MegaETH',    cat: 'Testnet',   fee: 'Bridge $5',         est: 'S-tier · $500-1500',  url: 'https://testnet.megaeth.systems/', desc: 'High-perf L2 testnet, active devnet with airdrop hints.' },
  { key: 'linea',     name: 'Linea',      cat: 'Mainnet',   fee: '~$1-3 gas',         est: 'A-tier · $200-800',   url: 'https://linea.build/', desc: 'ConsenSys L2 — active LXP campaign, weekly quests.' },
  { key: 'scroll',    name: 'Scroll',     cat: 'Mainnet',   fee: '~$2-4 gas',         est: 'A-tier · $150-500',   url: 'https://scroll.io/', desc: 'zkEVM L2 · bridge, swap on DEXs, deposit to lending.' },
  { key: 'blast',     name: 'Blast',      cat: 'Mainnet',   fee: 'ETH deposit',       est: 'B-tier · $100-400',   url: 'https://blast.io/', desc: 'ETH yield L2, points multiplier on referrals and swaps.' },
  { key: 'zksync',    name: 'zkSync Era', cat: 'Mainnet',   fee: '~$1 gas',           est: 'A-tier · $200-600',   url: 'https://zksync.io/', desc: 'Regular activity — 5+ tx / month keeps you eligible.' },
  { key: 'layerzero', name: 'LayerZero',  cat: 'Cross-chain', fee: '~$3-8 bridge',    est: 'Confirmed · claim',   url: 'https://layerzero.foundation/', desc: 'Season 2 farming — bridge messages via Stargate.' },
  { key: 'hyperliq',  name: 'Hyperliquid',cat: 'Perp DEX',  fee: '$100+ volume',      est: 'S-tier · $1000+',     url: 'https://app.hyperliquid.xyz/', desc: 'Trade perps — points from volume + referrals.' },
  { key: 'berachain', name: 'Berachain',  cat: 'Testnet→Live', fee: 'Testnet actions',est: 'S-tier · $500-2000',  url: 'https://www.berachain.com/', desc: 'Mainnet live · PoL farming via LPs and validators.' },
];
function gwInjectAirdropCss() {
  gwEnsureWalletUiCss();
}

function gwAdLang() { let l = 'en'; try { const s = localStorage.getItem('grom_lang'); if (s && GW_AD_TR[s]) l = s; } catch (_) {} return GW_AD_TR[l] || GW_AD_TR.en; }
function gwAdDone() { try { return JSON.parse(localStorage.getItem('gw_ad_done') || '[]'); } catch (_) { return []; } }
function gwAdToggle(key) { const set = new Set(gwAdDone()); if (set.has(key)) set.delete(key); else set.add(key); try { localStorage.setItem('gw_ad_done', JSON.stringify([...set])); } catch (_) {} gwRenderAirdrop(); }
function gwRenderAirdrop() {
  const page = document.getElementById('page-dashboard');
  if (!page) return;
  gwInjectAirdropCss();
  const t = gwAdLang();
  let wrap = document.getElementById('gwAirdropCard');
  if (!wrap) {
    wrap = document.createElement('div'); wrap.id = 'gwAirdropCard'; wrap.className = 'gw-ad-wrap';
    const yield_ = document.getElementById('gwYieldCard');
    if (yield_) yield_.after(wrap); else page.appendChild(wrap);
  }
  const done = new Set(gwAdDone());
  wrap.innerHTML = `
    <div class="gw-ad-card">
      <div class="gw-ad-head"><div><h3 class="gw-ad-title">${t.h}</h3><p class="gw-ad-sub">${t.sub}</p></div><span class="gw-ad-badge">${t.badge}</span></div>
      <div class="gw-ad-grid">
        ${GW_AD_LIST.map((a) => `
          <div class="gw-ad-item ${done.has(a.key) ? 'done' : ''}">
            <div class="top"><span class="name">${a.name}</span><span class="cat">${a.cat}</span></div>
            <span class="est">${a.est}</span>
            <span class="fee">${a.fee}</span>
            <p class="desc">${a.desc}</p>
            <div style="display:flex;gap:6px;margin-top:auto">
              <a class="cta" href="${a.url}" target="_blank" rel="noopener" style="flex:1">Open →</a>
              <button class="mark ${done.has(a.key) ? 'done' : ''}" data-key="${a.key}">${done.has(a.key) ? t.done : t.mark}</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  wrap.querySelectorAll('.mark').forEach((b) => b.onclick = () => gwAdToggle(b.dataset.key));
}
function gwSetupAirdrop() {
  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderAirdrop(); console.log('[GROM] airdrop rendered'); } catch (e) { console.warn('[GROM] airdrop', e); } } }, 200);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwAirdropCard') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  gwOnRoute(tryRender);
  window.addEventListener('grom:lang-change', () => { const el = document.getElementById('gwAirdropCard'); if (el) el.remove(); tryRender(); });
}


/* ============================================================================
 * PHASE 4 — PREDICTION ↔ SPOT ARB SPOTTER
 * v1: static "opportunities" derived from live BTC price + a couple of
 * Polymarket-style questions. Placeholder for the full arb engine in Phase 4b.
 * Compact card, easy to expand later. */
function gwInjectPredictArbCss() {
  gwEnsureWalletUiCss();
}

async function gwRenderPredictArb() {
  // GROM_DASH_HEAVY_DISABLED
  try { document.getElementById('gwPredictArbCard')?.remove(); } catch (_) {}
  return;

  const page = document.getElementById('page-dashboard');
  if (!page) return;
  gwInjectPredictArbCss();
  let wrap = document.getElementById('gwPredictArbCard');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'gwPredictArbCard'; wrap.className = 'gw-pa-wrap'; const airdrop = document.getElementById('gwAirdropCard'); if (airdrop) airdrop.after(wrap); else page.appendChild(wrap); }

  // Live BTC price for reference
  let btcPrice = 65000;
  try { btcPrice = (await (typeof gwRefPriceFromMarket==='function'?gwRefPriceFromMarket('BTC'):Promise.resolve(null))) || btcPrice; } catch (_) {}
  const opportunities = [
    { q: `BTC > $${(btcPrice * 1.10 | 0).toLocaleString()} by end of month`, polyPct: 22, ivPct: 34, hedge: 'Buy Poly YES + short 0.02 BTC perp' },
    { q: `ETH > $2500 in 30 days`, polyPct: 41, ivPct: 55, hedge: 'Buy YES + short 0.05 ETH perp' },
    { q: `FOMC cuts 25bps in July`, polyPct: 71, ivPct: 85, hedge: 'Buy YES + long TLT (bond)' },
    { q: `BTC < $${(btcPrice * 0.90 | 0).toLocaleString()} by end of month`, polyPct: 18, ivPct: 24, hedge: 'Buy YES + long 0.01 BTC' },
  ];

  wrap.innerHTML = `
    <div class="gw-pa-card">
      <div class="gw-pa-head"><div><h3 class="gw-pa-title">🎯 Predict ↔ Spot arbs</h3><p class="gw-pa-sub">Polymarket odds vs Binance implied vol — where retail is mis-priced</p></div><span class="gw-pa-badge">EDGE</span></div>
      <div class="gw-pa-list">
        ${opportunities.map((o) => {
          const edge = o.ivPct - o.polyPct;
          return `<div class="gw-pa-row">
            <div>
              <div class="gw-pa-q">${o.q}</div>
              <div class="gw-pa-meta"><span>Poly: <b style="color:#a855f7">${o.polyPct}%</b></span><span>IV: <b style="color:#3ac2ff">${o.ivPct}%</b></span><span>${o.hedge}</span></div>
            </div>
            <div class="gw-pa-ev"><div class="n">+${edge}%</div><div class="s">EDGE</div></div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}
function gwSetupPredictArb() {
  // GROM_DASH_HEAVY_DISABLED — do not re-enable without product ask
  try { document.getElementById('gwPredictArbCard')?.remove(); } catch (_) {}
  return;

  // Disabled on dashboard (perf 2026-07-18).
  try { document.getElementById('gwPredictArbCard')?.remove(); } catch (_) {}
  return;

  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderPredictArb(); console.log('[GROM] predict-arb rendered'); } catch (e) { console.warn('[GROM] predict-arb', e); } } }, 200);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwPredictArbCard') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  gwOnRoute(tryRender);
  window.addEventListener('grom:lang-change', () => { const el = document.getElementById('gwPredictArbCard'); if (el) el.remove(); tryRender(); });
}


/* ============================================================================
 * PHASE 6 — CROSS-MARGIN UNIFIED (v1 preview only, no on-chain engine yet)
 * Marketing teaser card showing the concept: use spot + xStocks + predict
 * positions as unified collateral. "Coming soon · join beta" CTA. */
function gwInjectCrossMarginCss() {
  gwEnsureWalletUiCss();
}

function gwCmLang() { let l='en'; try { const s=localStorage.getItem('grom_lang'); if (s&&GW_CM_TR[s]) l=s; } catch (_) {} return GW_CM_TR[l]||GW_CM_TR.en; }

function gwRenderCrossMargin() {
  // GROM_DASH_HEAVY_DISABLED
  try { document.getElementById('gwCrossMarginCard')?.remove(); } catch (_) {}
  return;

  const page = document.getElementById('page-dashboard');
  if (!page) return;
  gwInjectCrossMarginCss();
  let wrap = document.getElementById('gwCrossMarginCard');
  if (!wrap) { wrap = document.createElement('div'); wrap.id = 'gwCrossMarginCard'; wrap.className = 'gw-cm-wrap'; const pa = document.getElementById('gwPredictArbCard'); if (pa) pa.after(wrap); else page.appendChild(wrap); }
  const t = gwCmLang();
  wrap.innerHTML = `
    <div class="gw-cm-card">
      <p class="gw-cm-eyebrow">${t.eyebrow}</p>
      <h3 class="gw-cm-title">${t.h}</h3>
      <p class="gw-cm-sub">${t.sub}</p>
      <div class="gw-cm-cols">
        <div class="gw-cm-col"><div class="k">${t.c1}</div><div class="v">80% LTV</div><div class="s">${t.std}</div></div>
        <div class="gw-cm-col"><div class="k">${t.c2}</div><div class="v">75% LTV</div><div class="s">${t.reg}</div></div>
        <div class="gw-cm-col"><div class="k">${t.c3}</div><div class="v">50% LTV</div><div class="s">${t.pay}</div></div>
        <div class="gw-cm-col"><div class="k">${t.c4}</div><div class="v">85% LTV</div><div class="s">${t.stab}</div></div>
      </div>
      <div class="gw-cm-actions">
        <button class="gw-cm-btn primary" id="gwCmJoin">${t.a1}</button>
        <a class="gw-cm-btn ghost" href="https://t.me/grom_finence_hub" target="_blank" rel="noopener">${t.a2}</a>
      </div>
    </div>
  `;
  document.getElementById('gwCmJoin')?.addEventListener('click', () => {
    try { const list = JSON.parse(localStorage.getItem('gw_cm_waitlist') || '[]'); const id = localStorage.getItem('grom_wallet_label') || 'anonymous'; if (!list.includes(id)) list.push(id); localStorage.setItem('gw_cm_waitlist', JSON.stringify(list)); } catch (_) {}
    gwToast(t.toast, 'success');
  });
}
function gwSetupCrossMargin() {
  // GROM_DASH_HEAVY_DISABLED — do not re-enable without product ask
  try { document.getElementById('gwCrossMarginCard')?.remove(); } catch (_) {}
  return;

  // Disabled on dashboard (perf 2026-07-18).
  try { document.getElementById('gwCrossMarginCard')?.remove(); } catch (_) {}
  return;

  const tryRender = gwDebounce(() => { if (document.getElementById('page-dashboard')) { try { gwRenderCrossMargin(); console.log('[GROM] cross-margin rendered'); } catch (e) { console.warn('[GROM] cross-margin', e); } } }, 200);
  tryRender();
  let n = 0; const id = setInterval(() => { n++; if (document.getElementById('gwCrossMarginCard') || n >= 20) clearInterval(id); else tryRender(); }, 500);
  gwOnRoute(tryRender);
  window.addEventListener('grom:lang-change', () => { const el = document.getElementById('gwCrossMarginCard'); if (el) el.remove(); tryRender(); });
}


/* ============================================================================
 * LANDING MARKETING POLISH (2026-07-05)
 *
 * Adds two conversion-focused sections to Cursor's #page-landing right
 * before the final CTA:
 *   1. Comparison strip — GROM vs Traditional CEX vs DEX. Neutralises the
 *      "why switch" objection with a scannable side-by-side.
 *   2. FAQ — 6 real questions that come up in support: KYC threshold, key
 *      custody, supported fiat, withdrawal timing, insurance, sign-up
 *      speed. Answers keep it honest (no fake claims of licensing etc).
 * Both are fully i18n across the 7 languages we support, and re-render
 * on language change. Injected via grom-wallet.js so we don't touch
 * Cursor's index.html — same coexistence pattern as everything else.
 * ============================================================================ */


// Register implementations for core stubs
window.__gwDashImpl = Object.assign(window.__gwDashImpl || {}, {
  gwSetupAirdrop,
  gwSetupCrossMargin,
  gwSetupDexPages,
  gwSetupMegaCards,
  gwSetupPredictArb,
  gwSetupTrending,
  gwSetupYield,
});

export const ready = true;
