(() => {
  const page = document.getElementById('page-earn');
  if (!page) return;
  const ru = () =>
    (document.documentElement.lang || '').startsWith('ru') || localStorage.getItem('grom_lang') === 'ru';
  const t = (en, russian) => (ru() ? russian : en);
  const esc = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const addr = (v) => /^0x[\da-f]{40}$/i.test(v || '');
  const active = () => page.classList.contains('active');
  const state = {
    tab: 'catalog',
    filters: { sortBy: 'tvl' },
    rows: [],
    next: null,
    generation: 0,
    busy: false,
  };
  const num = (v, style = {}) =>
    v === null || v === '' || !Number.isFinite(Number(v))
      ? '—'
      : new Intl.NumberFormat(ru() ? 'ru-RU' : 'en-US', style).format(Number(v));
  // Earn v1 sends percentage points, including values below one percent.
  const pct = (v) => (v == null ? '—' : num(v, { maximumFractionDigits: 2 }) + '%');
  const usd = (v) =>
    num(v, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 });
  const account = () => window.gromEarnWallet?.account() || '';
  const field = (label, html) => '<label>' + esc(label) + html + '</label>';
  const button = (action, label, cls = '') =>
    '<button type="button" class="' + cls + '" data-action="' + action + '">' + esc(label) + '</button>';
  const currency = (units, dec) => {
    const digits = BigInt(units)
      .toString()
      .padStart(dec + 1, '0');
    if (!dec) return digits;
    const frac = digits.slice(-dec).replace(/0+$/, '');
    return digits.slice(0, -dec) + (frac ? '.' + frac : '');
  };
  function vaultKey(v) {
    return v.chainId + ':' + v.address;
  }
  function readVault() {
    const key = new URL(location.href).searchParams.get('vault') || '';
    return /^\d+:0x[a-fA-F0-9]{40}$/.test(key) ? key : null;
  }
  function href(v) {
    const url = new URL(location.href);
    if (v) url.searchParams.set('vault', v);
    else url.searchParams.delete('vault');
    return url;
  }
  async function api(path, body) {
    const requestGeneration = state.generation;
    try {
      const res = await fetch(
        '/api/earn/' + path,
        body
          ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
          : {}
      );
      if (!res.ok)
        throw Error(
          res.status === 429
            ? t('Too many requests. Try again shortly.', 'Слишком много запросов. Повторите чуть позже.')
            : res.status === 404
              ? t('No route or asset found.', 'Маршрут или актив не найден.')
              : t('Data temporarily unavailable.', 'Данные временно недоступны.')
        );
      return await res.json();
    } catch (e) {
      e.earnGeneration = requestGeneration;
      throw e;
    }
  }
  const getQuote = (order) => api('quote', order);
  async function loadWallet() {
    await window.gromEnsureWalletModule?.();
    if (!window.gromEarnWallet)
      throw Error(t('Wallet module unavailable', 'Не удалось загрузить модуль кошелька'));
    return window.gromEarnWallet;
  }
  function header() {
    page.querySelector('.earn-title').textContent = t('Smarter earning starts here', 'Разумный заработок начинается здесь');
    page.querySelector('.earn-intro').textContent = t(
      'Explore over 300 DeFi vaults by asset, network and yield.',
      'Более 300 хранилищ DeFi. Выбирайте по активу, сети и доходности.'
    );
    for (const item of page.querySelectorAll('.earn-nav button')) {
      const catalogTab = item.dataset.action === 'catalog';
      item.textContent = catalogTab ? t('Vaults', 'Хранилища') : t('My positions', 'Мои позиции');
      item.setAttribute('aria-pressed', String(item.dataset.action === state.tab));
    }
    return page.querySelector('.earn-body');
  }
  let optionsRequest;
  function fillFilters(form) {
    if (!optionsRequest)
      optionsRequest = api('filters').catch((e) => {
        optionsRequest = null;
        throw e;
      });
    optionsRequest
      .then(({ chains, protocols }) => {
        if (!form.isConnected) return;
        function set(name, choices) {
          const select = form.elements[name],
            old = select.value;
          for (const [id, label] of choices) {
            const existing = [...select.options].find((o) => o.value === String(id));
            if (existing) existing.text = label;
            else select.add(new Option(label, id));
          }
          select.value = old;
        }
        set(
          'chainId',
          chains.map((c) => [c.chainId, c.name])
        );
        set(
          'protocol',
          protocols.map((p) => [p.id, p.name])
        );
      })
      .catch(() => {
        /* Asset filtering and catalog remain available. */
      });
  }
  function filterSelect(name, value) {
    return (
      '<select name="' +
      name +
      '"><option value="">' +
      t('All', 'Все') +
      '</option>' +
      (value ? '<option selected value="' + esc(value) + '">' + esc(value) + '</option>' : '') +
      '</select>'
    );
  }
  function filters() {
    const f = state.filters;
    return (
      '<form class="earn-filters">' +
      field(t('Network', 'Сеть'), filterSelect('chainId', f.chainId)) +
      field(t('Asset', 'Актив'), '<input name="asset" type="search" maxlength="50" placeholder="ETH, USDC…" value="' + esc(f.asset) + '">') +
      field(t('Protocol', 'Протокол'), filterSelect('protocol', f.protocol)) +
      field(
        t('Sort', 'Сортировка'),
        '<select name="sortBy"><option value="tvl">TVL</option><option value="apy" ' +
          (f.sortBy === 'apy' ? 'selected' : '') +
          '>APY</option></select>'
      ) +
      '</form>'
    );
  }
  // Common vault assets, keyed by chain and contract from the LI.FI token catalog.
  const vaultLogos = {
    "137:0x03b54a6e9a984069379fae1a4fc4dbae93b3bccd": "cba16ad525b1.png",
    "137:0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": "80ed0849f338.png",
    "137:0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": "d7ef19e45e45.png",
    "137:0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "162be3b4af5d.png",
    "137:0x4ed141110f6eeeaba9a1df36d8c26f684d2475dc": "18c71b49daf1.png",
    "137:0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39": "93677719abcb.png",
    "137:0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": "50f4b6e6c1c2.png",
    "137:0x80eede496655fb9047dd39d9f418d5483ed600df": "c5896f0acff3.png",
    "137:0x8f3cf7ad23cd3cadbd9735aff958023239c6a063": "309bf3f4b5c3.png",
    "137:0xc2132d05d31c914a87c6611c10748aeb04b58e8f": "ad9e2c01cd61.png",
    "137:0xd6df932a45c0f255f85145f286ea0b292b21c90b": "391707f464ef.png",
    "1:0x0000000000000000000000000000000000000000": "50f4b6e6c1c2.png",
    "1:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "d7ef19e45e45.png",
    "1:0x4c9edd5852cd905f086c759e8383e09bff1e68b3": "b701a29dbb82.png",
    "1:0x6c3ea9036406852006290770bedfcaba0e23a0e8": "d5b2b6ab70de.png",
    "1:0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0": "cba16ad525b1.png",
    "1:0x8292bb45bf1ee4d140127049757c2e0ff06317ed": "911e0add005f.png",
    "1:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "0922a472d9ad.png",
    "1:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "ad2a992a5e65.png",
    "1:0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "0a5a63855b92.png",
    "1:0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee": "f57043d625a7.png",
    "1:0xdac17f958d2ee523a2206206994597c13d831ec7": "ad9e2c01cd61.png",
    "1:0xe343167631d89b6ffc58b88d6b7fb0228795491d": "659edcc9fed3.png",
    "1:0xf1c9acdc66974dfb6decb12aa385b9cd01190e38": "3d93dc1398db.png",
    "42161:0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f": "d7ef19e45e45.png",
    "42161:0x35751007a407ca6feffe80b3cb397736d2cf4dbe": "2adbd8aec46f.png",
    "42161:0x5979d7b546e38e414f7e9822514be443a4800529": "c317f3c206c3.png",
    "42161:0x7dff72693f6a4149b17e7c6314655f6a9f7c8b33": "f5023d56edda.png",
    "42161:0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "ed8bce6f75e4.png",
    "42161:0x912ce59144191c1204e64559fe8253a0e49e6548": "01051c8e4736.png",
    "42161:0xaf88d065e77c8cc2239327c5edb3a432268e5831": "0922a472d9ad.png",
    "42161:0xba5ddd1f9d7f570dc94a51479a000e3bce967196": "31c92d40e79a.png",
    "42161:0xf97f4df75117a78c1a5a0dbb814af92458539fb4": "514f57355b03.png",
    "42161:0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "13af19f98a9e.png",
    "4663:0x5fc5360d0400a0fd4f2af552add042d716f1d168": "1073cea755a8.png",
    "56:0x2170ed0880ac9a755fd29b2688956bd959f933f8": "50f4b6e6c1c2.png",
    "56:0x55d398326f99059ff775485246999027b3197955": "ad9e2c01cd61.png",
    "56:0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c": "2b2d33657a3a.png",
    "56:0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": "1785677a64db.png",
    "8453:0x0000000000000000000000000000000000000000": "50f4b6e6c1c2.png",
    "8453:0x04c0599ae5a44757c0af6f9ec3b93da8976c150a": "b3d4cc872d4f.png",
    "8453:0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22": "a29c118d5881.png",
    "8453:0x4200000000000000000000000000000000000006": "fc50be9a2f44.png",
    "8453:0x7ba6f01772924a82d9626c126347a28299e98c98": "867e0ad54c23.png",
    "8453:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "0922a472d9ad.png",
    "8453:0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452": "aed072a3f7f1.png",
    "8453:0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "250f46bdfb5e.png",
    "9745:0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34": "b701a29dbb82.png",
    "999:0x5555555555555555555555555555555555555555": "fb06877979de.png"
  };
  function tokenMark(v) {
    const asset = v.underlyingTokens?.[0];
    const symbol = asset?.symbol || v.name || '?';
    const cached = window.__gwLifiByAddr?.[v.chainId]?.get(String(asset?.address).toLowerCase());
    const seed = window.GromSwapNetworks?.byId[v.chainId]?.tokens.find(
      (token) => token.address.toLowerCase() === asset?.address?.toLowerCase()
    );
    const local = vaultLogos[v.chainId + ':' + asset?.address?.toLowerCase()];
    const external = asset?.logoURI || cached?.logo || seed?.logoURI || window.gwTkBestLogo?.(symbol);
    const url = local ? '/assets/earn/' + local
      : external && /^https:\/\//i.test(external) && !external.endsWith('/unknown.svg') ? external : '';
    const image = url
      ? '<img alt="" loading="' + (local ? 'eager' : 'lazy') + '" decoding="async" referrerpolicy="no-referrer" src="' + esc(url) + '">'
      : '';
    return '<span class="earn-token-mark" aria-hidden="true">' + esc(symbol.slice(0, 2).toUpperCase()) + image + '</span>';
  }
  page.addEventListener('error', (e) => {
    if (e.target.matches?.('.earn-token-mark img')) e.target.hidden = true;
  }, true);
  function listRow(v) {
    const assets = v.underlyingTokens?.map((token) => token.symbol).join(' / ') || '';
    return (
      '<a class="earn-row" href="' +
      esc(href(vaultKey(v))) +
      '" data-vault="' +
      esc(vaultKey(v)) +
      '"><span class="earn-asset">' + tokenMark(v) + '<span class="earn-asset-copy"><b>' +
      esc(v.name) + '</b><small>' + esc(v.protocol?.name) + ' · ' + esc(v.network) +
      '</small>' + (assets && assets.toUpperCase() !== String(v.name).toUpperCase() ? '<small>' + esc(assets) + '</small>' : '') +
      '</span></span><span class="earn-yield"><small>APY</small><b>' +
      pct(v.analytics?.apy?.total) +
      '</b></span><span><small>TVL</small><b>' +
      usd(v.analytics?.tvl?.usd) +
      '</b></span></a>'
    );
  }
  async function catalog(more = false) {
    const id = ++state.generation,
      body = header();
    const existing = more ? state.rows : [];
    state.review = null;
    let form = body.querySelector('.earn-filters');
    if (!form || form.lang !== document.documentElement.lang) {
      body.innerHTML = filters() + '<div class="earn-list"></div><div class="earn-list-footer"></div>';
      form = body.querySelector('form');
      form.lang = document.documentElement.lang;
      fillFilters(form);
    }
    const list = body.querySelector('.earn-list');
    const footer = body.querySelector('.earn-list-footer');
    if (!more) {
      state.rows = [];
      state.next = null;
      list.replaceChildren();
    }
    list.setAttribute('aria-busy', 'true');
    footer.innerHTML = '<p role="status">' + t('Loading vaults…', 'Загружаем хранилища…') + '</p>';
    const query = new URLSearchParams(state.filters);
    if (more && state.next) query.set('cursor', state.next);
    const data = await api('vaults?' + query);
    if (state.generation !== id || !active()) return;
    state.rows = [...existing, ...data.data];
    state.next = data.nextCursor;
    list.setAttribute('aria-busy', 'false');
    list.innerHTML =
      state.rows.map(listRow).join('') ||
      '<p>' + t('No matching vaults.', 'Нет подходящих хранилищ.') + '</p>';
    footer.innerHTML = state.next ? button('more', t('Show more', 'Показать ещё')) : '';
  }
  function detailMarkup(v) {
    const a = v.analytics || {},
      rows = [
        [t('Total APY', 'Итого APY'), pct(a.apy?.total)],
        ['Base APY', pct(a.apy?.base)],
        ['Reward APY', pct(a.apy?.reward)],
        ['7D APY', pct(a.apy7d)],
        ['30D APY', pct(a.apy30d)],
        ['TVL', usd(a.tvl?.usd)],
      ];
    const purl = v.protocol?.url;
    let external = '';
    try {
      const url = new URL(purl);
      if (url.protocol === 'https:')
        external =
          '<a href="' +
          esc(url.href) +
          '" target="_blank" rel="noopener noreferrer">' +
          t('Open protocol', 'Сайт протокола') +
          ' ↗</a>';
    } catch {}
    return (
      button('catalog', t('← Vaults', '← Хранилища')) +
      '<article class="earn-detail"><small>' +
      esc(v.network) +
      ' · ' +
      esc(v.protocol?.name) +
      '</small><h2>' +
      esc(v.name) +
      '</h2><div class="earn-metrics">' +
      rows.map(([k, val]) => '<div><small>' + esc(k) + '</small><b>' + esc(val) + '</b></div>').join('') +
      '</div><p>' +
      t(
        'Yield varies. Deposits carry protocol and asset risks.',
        'Доходность меняется. Стоимость позиции зависит от актива и работы протокола.'
      ) +
      '</p><div class="earn-actions">' +
      (v.isTransactional ? button('deposit', t('Deposit', 'Внести'), 'primary') : '') +
      (v.isRedeemable ? button('withdraw', t('Withdraw', 'Вывести')) : external) +
      '</div><div class="earn-order"></div></article>'
    );
  }
  async function detail(key) {
    const id = ++state.generation,
      body = header();
    state.review = null;
    body.textContent = t('Loading vault…', 'Загружаем хранилище…');
    const [chain, address] = key.split(':');
    const v = await api('vaults/' + chain + '/' + address);
    if (id !== state.generation || !active()) return;
    state.vault = v;
    body.innerHTML = detailMarkup(v);
  }
  async function positions(more = false) {
    const id = ++state.generation,
      body = header();
    state.review = null;
    body.textContent = t('Loading positions…', 'Загружаем позиции…');
    await loadWallet();
    if (id !== state.generation || !active()) return;
    const owner = account();
    if (!addr(owner)) {
      body.innerHTML =
        '<p>' +
        t(
          'Connect your wallet to see your vault positions.',
          'Подключите кошелёк, чтобы увидеть свои позиции.'
        ) +
        '</p>' +
        button('connect', t('Connect wallet', 'Подключить кошелёк'));
      return;
    }
    const saved = more && state.positionsOwner === owner ? state.positionsList : [];
    const cursor =
      saved.length && state.positionsNext ? '?cursor=' + encodeURIComponent(state.positionsNext) : '';
    const data = await api('portfolio/' + owner + '/positions' + cursor);
    if (id !== state.generation || !active() || !sameAccount(owner)) return;
    state.positionsOwner = owner;
    state.positionsList = [...saved, ...data.positions];
    state.positionsNext = data.nextCursor;
    body.innerHTML =
      button('positions', t('Refresh', 'Обновить')) +
      '<div class="earn-list">' +
      state.positionsList
        .map((p) => {
          const label =
            '<span><b>' +
            esc(p.asset?.symbol || p.protocolName || t('Position', 'Позиция')) +
            '</b><small>' +
            esc(p.protocolName || '') +
            ' · ' +
            esc(p.chainId) +
            '</small></span><b>' +
            usd(p.balanceUsd) +
            '</b>';
          return addr(p.address) && p.chainId
            ? '<a class="earn-row" data-vault="' +
                esc(vaultKey(p)) +
                '" href="' +
                esc(href(vaultKey(p))) +
                '">' +
                label +
                '</a>'
            : '<div class="earn-row">' + label + '</div>';
        })
        .join('') +
      '</div>' +
      (!state.positionsList.length
        ? '<p>' + t('No positions found.', 'Открытых позиций пока нет.') + '</p>'
        : '');
    if (state.positionsNext)
      body.insertAdjacentHTML('beforeend', button('more-positions', t('Show more', 'Показать ещё')));
  }
  function sameAccount(a) {
    return a.toLowerCase() === account().toLowerCase();
  }
  function render() {
    if (!active()) return;
    const key = readVault();
    return key ? detail(key) : state.tab === 'positions' ? positions() : catalog();
  }
  function fail(e) {
    if (!active() || (e.earnGeneration !== undefined && e.earnGeneration !== state.generation)) return;
    const body = page.querySelector('.earn-body');
    if (!body) return;
    body.querySelector('[role=status]')?.remove();
    const footer = body.querySelector('.earn-list-footer');
    if (footer) body.querySelector('.earn-list').setAttribute('aria-busy', 'false');
    (footer || body).insertAdjacentHTML(
      'beforeend',
      '<p role="status">' + esc(e.message) + '</p>' + button('retry', t('Retry', 'Повторить'))
    );
  }
  function assetOption(x, i) {
    return (
      '<option value="' +
      i +
      '">' +
      esc(x.symbol) +
      ' · ' +
      esc(x.network || x.chainId) +
      (x.balance ? ' · ' + esc(x.balance) : '') +
      '</option>'
    );
  }
  async function orderForm(side) {
    const id = ++state.generation,
      box = page.querySelector('.earn-order'),
      v = state.vault;
    state.review = null;
    box.textContent = t('Loading wallet assets…', 'Загружаем активы…');
    const wallet = await loadWallet();
    const owner = account();
    if (id !== state.generation) return;
    if (!addr(owner)) {
      box.innerHTML = button('connect', t('Connect wallet', 'Подключить кошелёк'));
      return;
    }
    const assets =
      side === 'withdraw'
        ? (v.underlyingTokens || [])
            .filter((x) => addr(x.address))
            .map((x) => ({ ...x, chainId: v.chainId, network: v.network }))
        : await wallet.assets();
    if (id !== state.generation || !sameAccount(owner) || !active()) return;
    state.assets = assets;
    state.side = side;
    let other = '';
    if (side === 'deposit')
      other = '<option value="custom">' + t('Other token by address', 'Другой токен по адресу') + '</option>';
    box.innerHTML =
      '<form class="earn-order-form">' +
      field(
        side === 'withdraw' ? t('Receive', 'Получить') : t('Pay with', 'Оплата'),
        '<select name="asset">' + assets.map(assetOption).join('') + other + '</select>'
      ) +
      (side === 'deposit'
        ? '<div class="earn-custom" ' +
          (assets.length ? 'hidden' : '') +
          '>' +
          field(
            t('Source network ID', 'ID исходной сети'),
            '<input name="chain" inputmode="numeric" placeholder="42161">'
          ) +
          field(t('Token contract', 'Контракт токена'), '<input name="token" placeholder="0x…">') +
          '</div>'
        : '') +
      field(
        side === 'withdraw'
          ? t('Amount in vault shares', 'Количество долей хранилища')
          : t('Amount to deposit', 'Сумма депозита'),
        '<input name="amount" inputmode="decimal" autocomplete="off" required placeholder="0.00">'
      ) +
      '<button class="primary">' +
      t('Review quote', 'Рассчитать') +
      '</button></form><div class="earn-review" aria-live="polite"></div>';
  }
  async function review(form) {
    const id = ++state.generation,
      f = new FormData(form),
      item = state.assets[Number(f.get('asset'))],
      v = state.vault;
    const custom = f.get('asset') === 'custom';
    const order = {
      side: state.side,
      chain: v.chainId,
      address: v.address,
      payChain: custom ? Number(f.get('chain')) : item?.chainId,
      payToken: custom ? String(f.get('token')).trim() : item?.address,
      amount: String(f.get('amount')).trim().replace(',', '.'),
      account: account(),
    };
    const area = page.querySelector('.earn-review');
    state.review = null;
    area.textContent = t('Getting quote…', 'Получаем котировку…');
    if (
      !addr(order.account) ||
      !addr(order.payToken) ||
      !order.payChain ||
      !/^\d+(\.\d+)?$/.test(order.amount)
    ) {
      area.textContent = t('Check the amount, token and network.', 'Проверьте сумму, токен и сеть.');
      return;
    }
    try {
      const quote = await getQuote(order);
      if (id !== state.generation || !sameAccount(order.account) || !active()) return;
      const mod = await import('/grom-earn-order.js');
      mod.validateEarnQuote(order, quote);
      if (id !== state.generation) return;
      state.review = { order, quote };
      const amount = currency(quote.lifi.estimate.toAmountMin, quote.output.decimals);
      area.innerHTML =
        '<p>' +
        t('Minimum received', 'Минимум к получению') +
        ' <b>' +
        esc(amount) +
        ' ' +
        esc(quote.output.symbol) +
        '</b></p><small>' +
        t('GROM fee 0.20% · Network gas paid separately', 'Комиссия GROM 0,20% · Газ оплачивается отдельно') +
        '</small>' +
        button('confirm', t('Confirm in wallet', 'Подтвердить в кошельке'), 'primary');
    } catch (e) {
      if (id === state.generation) area.textContent = e.message;
    }
  }
  async function confirm() {
    const reviewed = state.review;
    if (!reviewed || state.busy) return;
    const area = page.querySelector('.earn-review');
    state.busy = true;
    const id = state.generation;
    const current = () =>
      id === state.generation && active() && state.review === reviewed && sameAccount(reviewed.order.account);
    const form = page.querySelector('.earn-order-form');
    Array.from(form.elements).forEach((el) => (el.disabled = true));
    area.textContent = t('Waiting for wallet…', 'Ожидаем кошелёк…');
    try {
      const { submitEarnOrder } = await import('/grom-earn-order.js');
      const hash = await submitEarnOrder(
        reviewed.order,
        reviewed.quote,
        window.gromEarnWallet,
        getQuote,
        current
      );
      if (!/^0x[\da-f]{64}$/i.test(hash))
        throw Error(t('No transaction hash returned', 'Не получен хеш транзакции'));
      const source = reviewed.quote.input.chainId;
      const url = window.gromEarnWallet.explorer(source, hash);
      area.innerHTML =
        '<p>' +
        t(
          'Submitted. Destination confirmation is pending.',
          'Отправлено. Ожидается подтверждение в сети назначения.'
        ) +
        '</p>' +
        (url
          ? '<a href="' +
            esc(url) +
            '" rel="noopener noreferrer" target="_blank">' +
            esc(hash.slice(0, 12)) +
            '… ↗</a>'
          : '<code>' + esc(hash) + '</code>') +
        button('positions', t('My positions', 'Мои позиции'));
    } catch (e) {
      area.textContent = e.message;
    } finally {
      state.busy = false;
      state.review = null;
      Array.from(form.elements).forEach((el) => (el.disabled = false));
    }
  }
  page.addEventListener('click', async (e) => {
    const target = e.target.closest('[data-action],[data-vault]');
    if (!target || state.busy) return;
    e.preventDefault();
    try {
      if (target.dataset.vault) {
        history.pushState(null, '', href(target.dataset.vault));
        await detail(target.dataset.vault);
        return;
      }
      const a = target.dataset.action;
      if (a === 'catalog' || a === 'positions') {
        state.tab = a;
        if (readVault()) history.pushState(null, '', href(null));
        await render();
      } else if (a === 'more') await catalog(true);
      else if (a === 'more-positions') await positions(true);
      else if (a === 'retry') await render();
      else if (a === 'deposit' || a === 'withdraw') await orderForm(a);
      else if (a === 'confirm') await confirm();
      else if (a === 'connect') document.getElementById('walletChip')?.click();
    } catch (err) {
      fail(err);
    }
  });
  let filterTimer;
  function applyFilters(form) {
    clearTimeout(filterTimer);
    state.filters = Object.fromEntries(
      [...new FormData(form)].map(([k, v]) => [k, String(v).trim()]).filter(([, v]) => v)
    );
    catalog().catch(fail);
  }
  page.addEventListener('change', (e) => {
    if (e.target.matches('.earn-filters select')) applyFilters(e.target.form);
  });
  page.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.busy) return;
    if (e.target.matches('.earn-filters')) applyFilters(e.target);
    else if (e.target.matches('.earn-order-form')) review(e.target).catch(fail);
  });
  page.addEventListener('input', (e) => {
    if (e.target.matches('.earn-filters input')) {
      const form = e.target.form;
      clearTimeout(filterTimer);
      const id = ++state.generation;
      filterTimer = setTimeout(() => {
        if (form.isConnected && id === state.generation && active()) applyFilters(form);
      }, 220);
      return;
    }
    if (!e.target.closest('.earn-order-form')) return;
    state.generation++;
    state.review = null;
    const area = page.querySelector('.earn-review');
    if (area) area.textContent = '';
    const custom = page.querySelector('.earn-custom');
    if (custom) custom.hidden = page.querySelector('select[name=asset]').value !== 'custom';
  });
  function refresh() {
    state.generation++;
    state.review = null;
    if (active()) render()?.catch(fail);
  }
  window.addEventListener('grom:route-change', refresh);
  window.addEventListener('grom:lang-change', refresh);
  window.addEventListener('popstate', refresh);
  let lastAccount = account();
  function walletChanged() {
    const next = account();
    if (next === lastAccount) return;
    lastAccount = next;
    refresh();
  }
  document.addEventListener('grom:wallet-connected', walletChanged);
  document.addEventListener('grom:wallet-disconnected', walletChanged);
  window.gromEarn = { refresh };
  refresh();
})();
