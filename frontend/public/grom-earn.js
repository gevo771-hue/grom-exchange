(() => {
  const page = document.getElementById('page-earn');
  if (!page) return;
  const ru = () => (document.documentElement.lang || '').startsWith('ru') || localStorage.getItem('grom_lang') === 'ru';
  const t = (en, russian) => ru() ? russian : en;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const addr = v => /^0x[\da-f]{40}$/i.test(v || '');
  const active = () => page.classList.contains('active');
  const state = { tab: 'catalog', filters: { sortBy:'tvl' }, rows:[], next:null, generation:0, busy:false };
  const num = (v, style = {}) => v === null || v === '' || !Number.isFinite(Number(v)) ? '—' : new Intl.NumberFormat(ru()?'ru-RU':'en-US',style).format(Number(v));
  // Earn v1 sends percentage points, including values below one percent.
  const pct = v => v == null ? '—' : num(v,{maximumFractionDigits:2}) + '%';
  const usd = v => num(v,{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:2});
  const account = () => window.gromEarnWallet?.account() || '';
  const field = (label,html) => '<label>'+esc(label)+html+'</label>';
  const button = (action,label,cls='') => '<button type="button" class="'+cls+'" data-action="'+action+'">'+esc(label)+'</button>';
  const currency = (units,dec) => {
    const digits=BigInt(units).toString().padStart(dec+1,'0');
    if(!dec)return digits;
    const frac=digits.slice(-dec).replace(/0+$/,'');return digits.slice(0,-dec)+(frac?'.'+frac:'');
  };
  function vaultKey(v){return v.chainId+':'+v.address;}
  function readVault(){const key=new URL(location.href).searchParams.get('vault')||'';return /^\d+:0x[a-fA-F0-9]{40}$/.test(key)?key:null;}
  function href(v) {const url=new URL(location.href);if(v)url.searchParams.set('vault',v);else url.searchParams.delete('vault');return url;}
  async function api(path,body){
    const requestGeneration=state.generation;
    try {
    const res=await fetch('/api/earn/'+path,body?{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{});
    if(!res.ok)throw Error(res.status===429?t('Too many requests. Try again shortly.','Слишком много запросов. Повторите чуть позже.'):res.status===404?t('No route or asset found.','Маршрут или актив не найден.'):t('Data temporarily unavailable.','Данные временно недоступны.'));
    return await res.json();
    } catch (e) { e.earnGeneration=requestGeneration;throw e; }
  }
  const getQuote = order => api('quote',order);
  async function loadWallet(){
    await window.gromEnsureWalletModule?.();
    if(!window.gromEarnWallet)throw Error(t('Wallet module unavailable','Не удалось загрузить модуль кошелька'));
    return window.gromEarnWallet;
  }
  function header(){
    page.innerHTML='<div class="earn-wrap"><header class="earn-head"><small>GROM / EARN</small><h1>Earn</h1><p>'+esc(t('Explore DeFi vaults and manage your deposits.','Хранилища DeFi и ваши позиции.'))+'</p></header><nav class="earn-nav" aria-label="Earn">'+
      button('catalog',t('Vaults','Хранилища'),state.tab==='catalog'?'sel':'')+button('positions',t('My positions','Мои позиции'),state.tab==='positions'?'sel':'')+'</nav><div class="earn-body"></div></div>';
    return page.querySelector('.earn-body');
  }
  let optionsRequest;
  function fillFilters(form) {
    if(!optionsRequest) optionsRequest=api('filters').catch(e=>{optionsRequest=null;throw e;});
    optionsRequest.then(({chains,protocols})=>{
      if(!form.isConnected)return;
      function set(name,choices) {
        const select=form.elements[name], old=select.value;
        for(const [id,label] of choices)if(![...select.options].some(o=>o.value===String(id)))select.add(new Option(label,id));
        select.value=old;
      }
      set('chainId',chains.map(c=>[c.chainId,c.name]));
      set('protocol',protocols.map(p=>[p.id,p.name]));
    }).catch(()=>{ /* Asset filtering and catalog remain available. */ });
  }
  function filterSelect(name,value){
    return '<select name="'+name+'"><option value="">'+t('All','Все')+'</option>'+
      (value?'<option selected value="'+esc(value)+'">'+esc(value)+'</option>':'')+'</select>';
  }
  function filters(){
    const f=state.filters;
    return '<form class="earn-filters">'+field(t('Network','Сеть'),filterSelect('chainId',f.chainId))+
      field(t('Asset','Актив'),'<input name="asset" placeholder="USDC" value="'+esc(f.asset)+'">')+
      field(t('Protocol','Протокол'),filterSelect('protocol',f.protocol))+
      field(t('Sort','Сортировка'),'<select name="sortBy"><option value="tvl">TVL</option><option value="apy" '+(f.sortBy==='apy'?'selected':'')+'>APY</option></select>')+
      '<button>'+esc(t('Apply','Применить'))+'</button></form>';
  }
  function listRow(v){return '<a class="earn-row" href="'+esc(href(vaultKey(v)))+'" data-vault="'+esc(vaultKey(v))+'"><span><small>'+esc(v.protocol?.name)+' · '+esc(v.network)+'</small><b>'+esc(v.name)+'</b><small>'+esc(v.underlyingTokens?.map(x=>x.symbol).join(' / '))+'</small></span><span class="earn-yield"><small>APY</small><b>'+pct(v.analytics?.apy?.total)+'</b></span><span><small>TVL</small><b>'+usd(v.analytics?.tvl?.usd)+'</b></span></a>';}
  async function catalog(more=false){
    const id=++state.generation,body=header();
    const existing=more?state.rows:[]; state.review=null;
    body.innerHTML=filters()+'<div class="earn-list">'+existing.map(listRow).join('')+'</div><p role="status">'+t('Loading vaults…','Загружаем хранилища…')+'</p>';
    fillFilters(body.querySelector("form"));
    const query=new URLSearchParams(state.filters);if(more&&state.next)query.set('cursor',state.next);
    const data=await api('vaults?'+query);
    if(state.generation!==id||!active())return;
    state.rows=[...existing,...data.data];state.next=data.nextCursor;
    body.querySelector('.earn-list').innerHTML=state.rows.map(listRow).join('')||'<p>'+t('No matching vaults.','Нет подходящих хранилищ.')+'</p>';
    body.querySelector('[role=status]').remove();if(state.next)body.insertAdjacentHTML('beforeend',button('more',t('Show more','Показать ещё')));
  }
  function detailMarkup(v){
    const a=v.analytics||{}, rows=[[t('Total APY','Итого APY'),pct(a.apy?.total)],['Base APY',pct(a.apy?.base)],['Reward APY',pct(a.apy?.reward)],['7D APY',pct(a.apy7d)],['30D APY',pct(a.apy30d)],['TVL',usd(a.tvl?.usd)]];
    const purl=v.protocol?.url;let external='';
    try{const url=new URL(purl);if(url.protocol==='https:')external='<a href="'+esc(url.href)+'" target="_blank" rel="noopener noreferrer">'+t('Open protocol','Сайт протокола')+' ↗</a>';}catch{}
    return button('catalog',t('← Vaults','← Хранилища'))+'<article class="earn-detail"><small>'+esc(v.network)+' · '+esc(v.protocol?.name)+'</small><h2>'+esc(v.name)+'</h2><div class="earn-metrics">'+rows.map(([k,val])=>'<div><small>'+esc(k)+'</small><b>'+esc(val)+'</b></div>').join('')+'</div><p>'+t('Yield varies. Deposits carry protocol and asset risks.','Доходность меняется. Стоимость позиции зависит от актива и работы протокола.')+'</p><div class="earn-actions">'+(v.isTransactional?button('deposit',t('Deposit','Внести'),'primary'):'')+(v.isRedeemable?button('withdraw',t('Withdraw','Вывести')):external)+'</div><div class="earn-order"></div></article>';
  }
  async function detail(key){
    const id=++state.generation,body=header();state.review=null;
    body.textContent=t('Loading vault…','Загружаем хранилище…');const [chain,address]=key.split(':');
    const v=await api('vaults/'+chain+'/'+address);if(id!==state.generation||!active())return;
    state.vault=v;body.innerHTML=detailMarkup(v);
  }
  async function positions(){
    const id=++state.generation,body=header();state.review=null;
    body.textContent=t('Loading positions…','Загружаем позиции…');await loadWallet();
    if(id!==state.generation||!active())return;
    const owner=account();if(!addr(owner)){body.innerHTML='<p>'+t('Connect your wallet to see your vault positions.','Подключите кошелёк, чтобы увидеть свои позиции.')+'</p>'+button('connect',t('Connect wallet','Подключить кошелёк'));return;}
    const data=await api('portfolio/'+owner+'/positions');if(id!==state.generation||!active()||!sameAccount(owner))return;
    body.innerHTML=button('positions',t('Refresh','Обновить'))+'<div class="earn-list">'+data.positions.map(p=>{
      const label='<span><b>'+esc(p.asset?.symbol||p.protocolName||t('Position','Позиция'))+'</b><small>'+esc(p.protocolName||'')+' · '+esc(p.chainId)+'</small></span><b>'+usd(p.balanceUsd)+'</b>';
      return addr(p.address)&&p.chainId?'<a class="earn-row" data-vault="'+esc(vaultKey(p))+'" href="'+esc(href(vaultKey(p)))+'">'+label+'</a>':'<div class="earn-row">'+label+'</div>';
    }).join('')+'</div>'+(!data.positions.length?'<p>'+t('No positions found.','Открытых позиций пока нет.')+'</p>':'');
  }
  function sameAccount(a){return a.toLowerCase()===account().toLowerCase();}
  function render(){if(!active())return;const key=readVault();return key?detail(key):state.tab==='positions'?positions():catalog();}
  function fail(e){if(!active() || e.earnGeneration!==undefined && e.earnGeneration!==state.generation)return;const body=page.querySelector('.earn-body');if(!body)return;body.querySelector('[role=status]')?.remove();body.insertAdjacentHTML('beforeend','<p role="status">'+esc(e.message)+'</p>'+button('retry',t('Retry','Повторить')));}
  function assetOption(x,i){return '<option value="'+i+'">'+esc(x.symbol)+' · '+esc(x.network||x.chainId)+(x.balance?' · '+esc(x.balance):'')+'</option>';}
  async function orderForm(side){
    const id=++state.generation,box=page.querySelector('.earn-order'),v=state.vault;
    state.review=null;box.textContent=t('Loading wallet assets…','Загружаем активы…');const wallet=await loadWallet();
    const owner=account();if(id!==state.generation)return;
    if(!addr(owner)){box.innerHTML=button('connect',t('Connect wallet','Подключить кошелёк'));return;}
    const assets=side==='withdraw'?(v.underlyingTokens||[]).filter(x=>addr(x.address)).map(x=>({...x,chainId:v.chainId,network:v.network})):await wallet.assets();
    if(id!==state.generation||!sameAccount(owner)||!active())return;
    state.assets=assets;state.side=side;
    let other='';if(side==='deposit')other='<option value="custom">'+t('Other token by address','Другой токен по адресу')+'</option>';
    box.innerHTML='<form class="earn-order-form">'+field(side==='withdraw'?t('Receive','Получить'):t('Pay with','Оплата'),'<select name="asset">'+assets.map(assetOption).join('')+other+'</select>')+
      (side==='deposit'?'<div class="earn-custom" '+(assets.length?'hidden':'')+'>'+field(t('Source network ID','ID исходной сети'),'<input name="chain" inputmode="numeric" placeholder="42161">')+field(t('Token contract','Контракт токена'),'<input name="token" placeholder="0x…">')+'</div>':'')+
      field(side==='withdraw'?t('Amount in vault shares','Количество долей хранилища'):t('Amount to deposit','Сумма депозита'),'<input name="amount" inputmode="decimal" autocomplete="off" required placeholder="0.00">')+'<button class="primary">'+t('Review quote','Рассчитать')+'</button></form><div class="earn-review" aria-live="polite"></div>';
  }
  async function review(form){
    const id=++state.generation, f=new FormData(form),item=state.assets[Number(f.get('asset'))],v=state.vault;
    const custom=f.get('asset')==='custom';const order={side:state.side,chain:v.chainId,address:v.address,payChain:custom?Number(f.get('chain')):item?.chainId,payToken:custom?String(f.get('token')).trim():item?.address,amount:String(f.get('amount')).trim().replace(',','.'),account:account()};
    const area=page.querySelector('.earn-review');state.review=null;
    area.textContent=t('Getting quote…','Получаем котировку…');
    if(!addr(order.account)||!addr(order.payToken)||!order.payChain||!/^\d+(\.\d+)?$/.test(order.amount)){area.textContent=t('Check the amount, token and network.','Проверьте сумму, токен и сеть.');return;}
    try{
      const quote=await getQuote(order);if(id!==state.generation||!sameAccount(order.account)||!active())return;
      const mod=await import('/grom-earn-order.js');mod.validateEarnQuote(order,quote);
      if(id!==state.generation)return;
      state.review={order,quote};
      const amount=currency(quote.lifi.estimate.toAmountMin,quote.output.decimals);
      area.innerHTML='<p>'+t('Minimum received','Минимум к получению')+' <b>'+esc(amount)+' '+esc(quote.output.symbol)+'</b></p><small>'+t('GROM fee 0.20% · Network gas paid separately','Комиссия GROM 0,20% · Газ оплачивается отдельно')+'</small>'+button('confirm',t('Confirm in wallet','Подтвердить в кошельке'),'primary');
    }catch(e){if(id===state.generation)area.textContent=e.message;}
  }
  async function confirm(){
    const reviewed=state.review;if(!reviewed||state.busy)return;
    const area=page.querySelector('.earn-review');state.busy=true;
    const id=state.generation;const current=()=>id===state.generation&&active()&&state.review===reviewed&&sameAccount(reviewed.order.account);
    const form=page.querySelector('.earn-order-form'); Array.from(form.elements).forEach(el=>el.disabled=true);
    area.textContent=t('Waiting for wallet…','Ожидаем кошелёк…');
    try{
      const {submitEarnOrder}=await import('/grom-earn-order.js');
      const hash=await submitEarnOrder(reviewed.order,reviewed.quote,window.gromEarnWallet,getQuote,current);
      if(!/^0x[\da-f]{64}$/i.test(hash))throw Error(t('No transaction hash returned','Не получен хеш транзакции'));
      const source=reviewed.quote.input.chainId;const url=window.gromEarnWallet.explorer(source,hash);
      area.innerHTML='<p>'+t('Submitted. Destination confirmation is pending.','Отправлено. Ожидается подтверждение в сети назначения.')+'</p>'+(url?'<a href="'+esc(url)+'" rel="noopener noreferrer" target="_blank">'+esc(hash.slice(0,12))+'… ↗</a>':'<code>'+esc(hash)+'</code>')+button('positions',t('My positions','Мои позиции'));
    }catch(e){area.textContent=e.message;}finally{state.busy=false;state.review=null;Array.from(form.elements).forEach(el=>el.disabled=false);}
  }
  page.addEventListener('click',async e=>{
    const target=e.target.closest('[data-action],[data-vault]');if(!target||state.busy)return;
    e.preventDefault();try{
      if(target.dataset.vault){history.pushState(null,'',href(target.dataset.vault));await detail(target.dataset.vault);return;}
      const a=target.dataset.action;
      if(a==='catalog'||a==='positions'){state.tab=a;if(readVault())history.pushState(null,'',href(null));await render();}
      else if(a==='more')await catalog(true);
      else if(a==='retry')await render();
      else if(a==='deposit'||a==='withdraw')await orderForm(a);
      else if(a==='confirm')await confirm();
      else if(a==='connect')document.getElementById('walletChip')?.click();
    }catch(err){fail(err);}
  });
  page.addEventListener('submit',e=>{e.preventDefault();if(state.busy)return;
    if(e.target.matches('.earn-filters')){state.filters=Object.fromEntries([...new FormData(e.target)].map(([k,v])=>[k,String(v).trim()]).filter(([,v])=>v));catalog().catch(fail);}
    else if(e.target.matches('.earn-order-form'))review(e.target).catch(fail);
  });
  page.addEventListener('input',e=>{if(!e.target.closest('.earn-order-form'))return;state.generation++;state.review=null;
    const area=page.querySelector('.earn-review');if(area)area.textContent='';
    const custom=page.querySelector('.earn-custom');if(custom)custom.hidden=page.querySelector('select[name=asset]').value!=='custom';
  });
  function refresh(){state.generation++;state.review=null;if(active())render()?.catch(fail);}
  window.addEventListener('grom:route-change',refresh);
  window.addEventListener('grom:lang-change',refresh);
  window.addEventListener('popstate',refresh);
  let lastAccount=account();
  function walletChanged(){
    const next=account();if(next===lastAccount)return;
    lastAccount=next;refresh();
  }
  document.addEventListener('grom:wallet-connected',walletChanged);
  document.addEventListener('grom:wallet-disconnected',walletChanged);
  window.gromEarn={refresh};refresh();
})();
