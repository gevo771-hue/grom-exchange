/* ==========================================================================
 * GROM · Master instruments registry
 *
 * 600+ инструментов: ~300 крипты + 80 FX + 150 акций + 30 commodities +
 * 20 indices + 20 ETF. Каждый объект:
 *   { symbol, name, type, base, quote, exchange, logo }
 *
 * type: 'crypto' | 'fx' | 'stock' | 'commodity' | 'index' | 'etf'
 *
 * Логотипы:
 *   crypto: jsdelivr cryptocurrency-icons (atomiclabs/cryptocurrency-icons)
 *   stock:  logo.clearbit.com (бесплатный API)
 *   fx:     flagcdn.com (двойной флаг по ISO-кодам стран в поле base/quote)
 *   commodity / index / etf: inline SVG (см. SYMBOL_GLYPH ниже)
 *
 * Live цены: подписка на Binance public WS для крипты,
 * детерминированный mock для остальных (см. seedPrice).
 *
 * Экспортирует:
 *   window.GROM_INSTRUMENTS         — массив всех инструментов
 *   window.gromGetInstrument(sym)   — поиск по символу
 *   window.gromInstrumentsByType(t) — фильтр по типу
 *   window.gromInstrumentLogo(it)   — URL лого для инструмента
 *   window.gromLivePrice(sym)       — текущая цена (live для крипты)
 *   window.gromOnPriceUpdate(cb)    — подписка на тики
 * ========================================================================== */

(function () {
'use strict';

/* ---------- Crypto: top ~300 by Binance USDT-перпы / спот ----------
 * Источник: Binance listed pairs (популярные USDT-margined).
 * Заполняем минимально: symbol + name. Лого формируется автоматически. */
var CRYPTO = [
  ['BTC','Bitcoin'],['ETH','Ethereum'],['BNB','BNB'],['SOL','Solana'],['XRP','XRP'],
  ['ADA','Cardano'],['DOGE','Dogecoin'],['AVAX','Avalanche'],['TRX','TRON'],['DOT','Polkadot'],
  ['LINK','Chainlink'],['MATIC','Polygon'],['LTC','Litecoin'],['BCH','Bitcoin Cash'],['SHIB','Shiba Inu'],
  ['UNI','Uniswap'],['ATOM','Cosmos'],['XLM','Stellar'],['ETC','Ethereum Classic'],['NEAR','NEAR Protocol'],
  ['APT','Aptos'],['ARB','Arbitrum'],['OP','Optimism'],['FIL','Filecoin'],['ICP','Internet Computer'],
  ['HBAR','Hedera'],['VET','VeChain'],['INJ','Injective'],['SUI','Sui'],['SEI','Sei'],
  ['TIA','Celestia'],['IMX','Immutable'],['LDO','Lido DAO'],['STX','Stacks'],['RUNE','THORChain'],
  ['FTM','Fantom'],['ALGO','Algorand'],['QNT','Quant'],['AAVE','Aave'],['GRT','The Graph'],
  ['MKR','Maker'],['SAND','The Sandbox'],['AXS','Axie Infinity'],['EGLD','MultiversX'],['THETA','Theta Network'],
  ['XTZ','Tezos'],['EOS','EOS'],['MANA','Decentraland'],['FLOW','Flow'],['CHZ','Chiliz'],
  ['NEO','Neo'],['CRV','Curve DAO'],['SNX','Synthetix'],['XMR','Monero'],['ENJ','Enjin Coin'],
  ['DASH','Dash'],['ZEC','Zcash'],['KSM','Kusama'],['BAT','Basic Attention Token'],['ZIL','Zilliqa'],
  ['1INCH','1inch'],['COMP','Compound'],['ENS','Ethereum Name Service'],['DYDX','dYdX'],['GMX','GMX'],
  ['BLUR','Blur'],['PYTH','Pyth Network'],['JUP','Jupiter'],['JTO','Jito'],['RNDR','Render'],
  ['FET','Fetch.ai'],['AGIX','SingularityNET'],['OCEAN','Ocean Protocol'],['ROSE','Oasis Network'],['MINA','Mina'],
  ['KAVA','Kava'],['DCR','Decred'],['ZRX','0x Protocol'],['ANKR','Ankr'],['ICX','ICON'],
  ['ONE','Harmony'],['IOTA','IOTA'],['CELO','Celo'],['SKL','SKALE'],['LRC','Loopring'],
  ['CFX','Conflux'],['CKB','Nervos Network'],['WAVES','Waves'],['STORJ','Storj'],['BAND','Band Protocol'],
  ['UMA','UMA'],['REN','Ren'],['BAL','Balancer'],['SUSHI','SushiSwap'],['YFI','yearn.finance'],
  ['KNC','Kyber Network'],['OMG','OMG Network'],['ANT','Aragon'],['LPT','Livepeer'],['NMR','Numeraire'],
  ['REQ','Request'],['REP','Augur'],['ZEN','Horizen'],['NKN','NKN'],['OXT','Orchid'],
  ['POLY','Polymath'],['CTSI','Cartesi'],['HOT','Holo'],['IOST','IOST'],['NANO','Nano'],
  ['SC','Siacoin'],['DGB','DigiByte'],['RVN','Ravencoin'],['ZRX','0x'],['DODO','DODO'],
  ['ALPHA','Alpha Venture DAO'],['AUDIO','Audius'],['BNT','Bancor'],['CTK','Certik'],['DENT','Dent'],
  ['FLM','Flamingo'],['GTC','Gitcoin'],['HIVE','Hive'],['ILV','Illuvium'],['JASMY','JasmyCoin'],
  ['KEEP','Keep Network'],['KMD','Komodo'],['LINA','Linear'],['LOOM','Loom Network'],['LSK','Lisk'],
  ['LTO','LTO Network'],['MASK','Mask Network'],['MDT','Measurable Data'],['MFT','Hifi Finance'],['MITH','Mithril'],
  ['MTL','Metal'],['NU','NuCypher'],['NULS','Nuls'],['OGN','Origin Protocol'],['ORBS','Orbs'],
  ['OXT','Orchid'],['PERP','Perpetual Protocol'],['POND','Marlin'],['POWR','Power Ledger'],['QKC','QuarkChain'],
  ['QUICK','QuickSwap'],['QTUM','Qtum'],['RAY','Raydium'],['RGT','Rari'],['RSR','Reserve Rights'],
  ['SLP','Smooth Love Potion'],['SPELL','Spell Token'],['SRM','Serum'],['STMX','StormX'],['STPT','STP'],
  ['STRAX','Stratis'],['SXP','Solar'],['SYS','Syscoin'],['TLM','Alien Worlds'],['TOMO','TomoChain'],
  ['TRB','Tellor'],['TRU','TrueFi'],['UFT','UniLend'],['UTK','Utrust'],['VTHO','VeThor'],
  ['WAN','Wanchain'],['WAXP','WAX'],['WIN','WINkLink'],['WRX','WazirX'],['XEM','NEM'],
  ['XVG','Verge'],['XVS','Venus'],['YGG','Yield Guild Games'],['ZEN','Horizen'],['MEME','Memecoin'],
  ['PEPE','Pepe'],['BONK','Bonk'],['WIF','dogwifhat'],['FLOKI','FLOKI'],['BOME','BOOK OF MEME'],
  ['MEW','cat in a dogs world'],['POPCAT','Popcat'],['NEIRO','Neiro'],['TRUMP','Trump'],['MAGA','MAGA'],
  ['ARKM','Arkham'],['ALT','Altlayer'],['MANTA','Manta Network'],['STRK','Starknet'],['ZK','ZKsync'],
  ['ENA','Ethena'],['W','Wormhole'],['REZ','Renzo'],['BB','BounceBit'],['IO','io.net'],
  ['ZRO','LayerZero'],['LISTA','Lista DAO'],['NOT','Notcoin'],['DOGS','DOGS'],['HMSTR','Hamster Kombat'],
  ['CATI','Catizen'],['TON','Toncoin'],['BANANA','Banana Gun'],['BAKE','BakeryToken'],['BURGER','Burger Swap'],
  ['CAKE','PancakeSwap'],['XRD','Radix'],['KAS','Kaspa'],['KASPA','Kaspa'],['DYM','Dymension'],
  ['SAGA','Saga'],['SUPER','SuperVerse'],['ETHFI','Ether.fi'],['OMNI','Omni Network'],['ONDO','Ondo'],
  ['TNSR','Tensor'],['PIXEL','Pixels'],['BEAMX','Beam'],['BICO','Biconomy'],['CYBER','CyberConnect'],
  ['ID','SPACE ID'],['LEVER','LeverFi'],['MAV','Maverick'],['ORDI','ORDI'],['SATS','Sats'],
  ['1000SATS','1000SATS'],['RATS','Rats'],['BTT','BitTorrent'],['BSV','Bitcoin SV'],['LUNC','Terra Luna Classic'],
  ['LUNA','Terra Luna 2.0'],['UST','TerraClassicUSD'],['USTC','TerraClassicUSD'],['USDC','USD Coin'],['USDT','Tether'],
  ['DAI','Dai'],['BUSD','Binance USD'],['TUSD','TrueUSD'],['FDUSD','First Digital USD'],['USDD','USDD'],
  ['FRAX','Frax'],['XAUT','Tether Gold'],['PAXG','PAX Gold'],['WBTC','Wrapped Bitcoin'],['WETH','Wrapped Ether'],
  ['STETH','Lido Staked ETH'],['CBETH','Coinbase Wrapped ETH'],['RETH','Rocket Pool ETH'],['EZETH','Renzo ezETH'],['SFRXETH','Frax Staked ETH'],
  ['MOG','Mog Coin'],['GME','GME Token'],['BRETT','Brett'],['DEGEN','Degen'],['TURBO','Turbo'],
  ['MOTHER','MOTHER'],['BODEN','Jeo Boden'],['WLD','Worldcoin'],['BIGTIME','Big Time'],['FLOKI','Floki'],
  ['HIFI','Hifi Finance'],['HOOK','Hooked Protocol'],['HFT','Hashflow'],['MAGIC','Magic'],['RIF','RSK Infrastructure'],
  ['STG','Stargate Finance'],['T','Threshold'],['TWT','Trust Wallet'],['VANRY','Vanar Chain'],['XAI','Xai'],
  ['XRD','Radix'],['ACH','Alchemy Pay'],['ACX','Across Protocol'],['AERGO','Aergo'],['AGI','Delysium'],
  ['AKRO','Akropolis'],['AMB','AirSwap'],['AMP','Amp'],['APE','ApeCoin'],['API3','API3'],
  ['ARDR','Ardor'],['ARK','Ark'],['ARPA','ARPA Chain'],['ASR','AS Roma Fan Token'],['ASTR','Astar'],
  ['ATA','Automata'],['AUCTION','Bounce'],['AUTO','Auto'],['AVA','Travala'],['BADGER','Badger DAO'],
  ['BAR','FC Barcelona Fan Token'],['BEAM','Beam'],['BEL','Bella Protocol'],['BETA','Beta Finance'],['BICO','Biconomy'],
  ['BLZ','Bluzelle'],['BOND','BarnBridge'],['BSW','Biswap'],['BTCST','BTC Standard'],['BTS','BitShares'],
  ['BURGER','BurgerSwap'],['C98','Coin98'],['CELR','Celer Network'],['CHESS','Tranchess'],['CHR','Chromia'],
  ['CITY','Manchester City Fan Token'],['CLV','Clover Finance'],['COCOS','Cocos-BCX'],['COS','Contentos'],['COTI','COTI'],
  ['CREAM','Cream Finance'],['CTXC','Cortex'],['CVC','Civic'],['CVP','PowerPool'],['CVX','Convex Finance'],
  ['DAR','Mines of Dalarnia'],['DATA','Streamr'],['DEGO','Dego Finance'],['DEXE','DeXe'],['DF','dForce'],
  ['DIA','DIA'],['DOCK','Dock'],['DREP','Drep'],['DUSK','Dusk Network'],['EFI','Efinity'],
  ['ELF','aelf'],['EPS','Ellipsis'],['ERN','Ethernity Chain'],['EVX','Everex'],['FARM','Harvest Finance'],
  ['FIDA','Bonfida'],['FIO','FIO Protocol'],['FIRO','Firo'],['FIS','Stafi'],['FLUX','Flux'],
  ['FOR','ForTube'],['FORTH','Ampleforth Governance'],['FRONT','Frontier'],['FUN','FUN Token'],['FXS','Frax Share'],
  ['GAL','Galxe'],['GALA','Gala'],['GHST','Aavegotchi'],['GLM','Golem'],['GMT','STEPN'],
  ['GNO','Gnosis'],['GST','Green Satoshi Token'],['HARD','Kava Lend'],['HBAR','Hedera'],['HIGH','Highstreet'],
  ['IDEX','IDEX'],['IRIS','IRISnet'],['JOE','JOE'],['JST','JUST'],['JUV','Juventus Fan Token'],
  ['KDA','Kadena'],['KLAY','Klaytn'],['LAZIO','Lazio Fan Token'],['LIT','Litentry'],['MBL','MovieBloc'],
  ['MBOX','MOBOX'],['MDX','Mdex'],['MOVR','Moonriver'],['MULTI','Multichain'],['NEBL','Neblio']
];

/* ---------- FX: 80 пар (мажоры, кроссы, экзотика) ----------
 * Формат: [pair, base, quote, base_country_iso, quote_country_iso] */
var FX = [
  ['EURUSD','EUR','USD','eu','us'],['USDJPY','USD','JPY','us','jp'],['GBPUSD','GBP','USD','gb','us'],
  ['USDCHF','USD','CHF','us','ch'],['AUDUSD','AUD','USD','au','us'],['USDCAD','USD','CAD','us','ca'],
  ['NZDUSD','NZD','USD','nz','us'],['EURJPY','EUR','JPY','eu','jp'],['GBPJPY','GBP','JPY','gb','jp'],
  ['EURGBP','EUR','GBP','eu','gb'],['EURCHF','EUR','CHF','eu','ch'],['EURAUD','EUR','AUD','eu','au'],
  ['EURCAD','EUR','CAD','eu','ca'],['EURNZD','EUR','NZD','eu','nz'],['GBPCHF','GBP','CHF','gb','ch'],
  ['GBPAUD','GBP','AUD','gb','au'],['GBPCAD','GBP','CAD','gb','ca'],['GBPNZD','GBP','NZD','gb','nz'],
  ['AUDJPY','AUD','JPY','au','jp'],['AUDCAD','AUD','CAD','au','ca'],['AUDCHF','AUD','CHF','au','ch'],
  ['AUDNZD','AUD','NZD','au','nz'],['CADJPY','CAD','JPY','ca','jp'],['CADCHF','CAD','CHF','ca','ch'],
  ['CHFJPY','CHF','JPY','ch','jp'],['NZDJPY','NZD','JPY','nz','jp'],['NZDCAD','NZD','CAD','nz','ca'],
  ['NZDCHF','NZD','CHF','nz','ch'],['USDSEK','USD','SEK','us','se'],['USDNOK','USD','NOK','us','no'],
  ['USDDKK','USD','DKK','us','dk'],['USDPLN','USD','PLN','us','pl'],['USDCZK','USD','CZK','us','cz'],
  ['USDHUF','USD','HUF','us','hu'],['USDRON','USD','RON','us','ro'],['USDTRY','USD','TRY','us','tr'],
  ['USDZAR','USD','ZAR','us','za'],['USDMXN','USD','MXN','us','mx'],['USDBRL','USD','BRL','us','br'],
  ['USDARS','USD','ARS','us','ar'],['USDCLP','USD','CLP','us','cl'],['USDCOP','USD','COP','us','co'],
  ['USDPEN','USD','PEN','us','pe'],['USDCNH','USD','CNH','us','cn'],['USDHKD','USD','HKD','us','hk'],
  ['USDSGD','USD','SGD','us','sg'],['USDKRW','USD','KRW','us','kr'],['USDTHB','USD','THB','us','th'],
  ['USDIDR','USD','IDR','us','id'],['USDPHP','USD','PHP','us','ph'],['USDMYR','USD','MYR','us','my'],
  ['USDINR','USD','INR','us','in'],['USDPKR','USD','PKR','us','pk'],['USDILS','USD','ILS','us','il'],
  ['USDAED','USD','AED','us','ae'],['USDSAR','USD','SAR','us','sa'],['USDEGP','USD','EGP','us','eg'],
  ['USDNGN','USD','NGN','us','ng'],['EURTRY','EUR','TRY','eu','tr'],['EURPLN','EUR','PLN','eu','pl'],
  ['EURSEK','EUR','SEK','eu','se'],['EURNOK','EUR','NOK','eu','no'],['EURHUF','EUR','HUF','eu','hu'],
  ['EURCZK','EUR','CZK','eu','cz'],['EURZAR','EUR','ZAR','eu','za'],['EURMXN','EUR','MXN','eu','mx'],
  ['EURSGD','EUR','SGD','eu','sg'],['EURHKD','EUR','HKD','eu','hk'],['GBPTRY','GBP','TRY','gb','tr'],
  ['GBPSEK','GBP','SEK','gb','se'],['GBPNOK','GBP','NOK','gb','no'],['GBPZAR','GBP','ZAR','gb','za'],
  ['GBPSGD','GBP','SGD','gb','sg'],['GBPHKD','GBP','HKD','gb','hk'],['CHFNOK','CHF','NOK','ch','no'],
  ['CHFSEK','CHF','SEK','ch','se'],['NOKSEK','NOK','SEK','no','se'],['CADNOK','CAD','NOK','ca','no'],
  ['ZARJPY','ZAR','JPY','za','jp'],['MXNJPY','MXN','JPY','mx','jp'],['TRYJPY','TRY','JPY','tr','jp'],
  ['SGDJPY','SGD','JPY','sg','jp']
];

/* ---------- STOCKS: 150 ----------
 * Формат: [symbol, name, exchange, domain_for_clearbit] */
var STOCKS = [
  ['AAPL','Apple Inc.','NASDAQ','apple.com'],['MSFT','Microsoft','NASDAQ','microsoft.com'],
  ['NVDA','NVIDIA','NASDAQ','nvidia.com'],['GOOGL','Alphabet Class A','NASDAQ','abc.xyz'],
  ['GOOG','Alphabet Class C','NASDAQ','abc.xyz'],['AMZN','Amazon','NASDAQ','amazon.com'],
  ['META','Meta Platforms','NASDAQ','meta.com'],['TSLA','Tesla','NASDAQ','tesla.com'],
  ['BRK.B','Berkshire Hathaway','NYSE','berkshirehathaway.com'],['LLY','Eli Lilly','NYSE','lilly.com'],
  ['V','Visa','NYSE','visa.com'],['JPM','JPMorgan Chase','NYSE','jpmorganchase.com'],
  ['MA','Mastercard','NYSE','mastercard.com'],['XOM','Exxon Mobil','NYSE','exxonmobil.com'],
  ['UNH','UnitedHealth','NYSE','unitedhealthgroup.com'],['JNJ','Johnson & Johnson','NYSE','jnj.com'],
  ['PG','Procter & Gamble','NYSE','pg.com'],['HD','Home Depot','NYSE','homedepot.com'],
  ['AVGO','Broadcom','NASDAQ','broadcom.com'],['CVX','Chevron','NYSE','chevron.com'],
  ['COST','Costco','NASDAQ','costco.com'],['MRK','Merck','NYSE','merck.com'],
  ['ABBV','AbbVie','NYSE','abbvie.com'],['BAC','Bank of America','NYSE','bankofamerica.com'],
  ['KO','Coca-Cola','NYSE','coca-colacompany.com'],['ADBE','Adobe','NASDAQ','adobe.com'],
  ['PEP','PepsiCo','NASDAQ','pepsico.com'],['WMT','Walmart','NYSE','walmart.com'],
  ['CRM','Salesforce','NYSE','salesforce.com'],['MCD','McDonald’s','NYSE','mcdonalds.com'],
  ['CSCO','Cisco','NASDAQ','cisco.com'],['TMO','Thermo Fisher','NYSE','thermofisher.com'],
  ['ACN','Accenture','NYSE','accenture.com'],['ABT','Abbott','NYSE','abbott.com'],
  ['LIN','Linde','NYSE','linde.com'],['DHR','Danaher','NYSE','danaher.com'],
  ['VZ','Verizon','NYSE','verizon.com'],['NKE','Nike','NYSE','nike.com'],
  ['NFLX','Netflix','NASDAQ','netflix.com'],['ORCL','Oracle','NYSE','oracle.com'],
  ['TXN','Texas Instruments','NASDAQ','ti.com'],['INTC','Intel','NASDAQ','intel.com'],
  ['AMD','AMD','NASDAQ','amd.com'],['QCOM','Qualcomm','NASDAQ','qualcomm.com'],
  ['IBM','IBM','NYSE','ibm.com'],['HON','Honeywell','NASDAQ','honeywell.com'],
  ['UNP','Union Pacific','NYSE','up.com'],['LOW','Lowe’s','NYSE','lowes.com'],
  ['UPS','UPS','NYSE','ups.com'],['CAT','Caterpillar','NYSE','caterpillar.com'],
  ['MS','Morgan Stanley','NYSE','morganstanley.com'],['GS','Goldman Sachs','NYSE','goldmansachs.com'],
  ['BLK','BlackRock','NYSE','blackrock.com'],['T','AT&T','NYSE','att.com'],
  ['SCHW','Charles Schwab','NYSE','schwab.com'],['AXP','American Express','NYSE','americanexpress.com'],
  ['DE','Deere','NYSE','deere.com'],['BA','Boeing','NYSE','boeing.com'],
  ['SBUX','Starbucks','NASDAQ','starbucks.com'],['NEE','NextEra Energy','NYSE','nexteraenergy.com'],
  ['DIS','Disney','NYSE','thewaltdisneycompany.com'],['PFE','Pfizer','NYSE','pfizer.com'],
  ['BMY','Bristol-Myers','NYSE','bms.com'],['AMGN','Amgen','NASDAQ','amgen.com'],
  ['GILD','Gilead','NASDAQ','gilead.com'],['MDT','Medtronic','NYSE','medtronic.com'],
  ['CB','Chubb','NYSE','chubb.com'],['SPGI','S&P Global','NYSE','spglobal.com'],
  ['MMC','Marsh & McLennan','NYSE','mmc.com'],['ICE','Intercontinental Exchange','NYSE','theice.com'],
  ['PYPL','PayPal','NASDAQ','paypal.com'],['SQ','Block (Square)','NYSE','block.xyz'],
  ['SHOP','Shopify','NYSE','shopify.com'],['UBER','Uber','NYSE','uber.com'],
  ['LYFT','Lyft','NASDAQ','lyft.com'],['ABNB','Airbnb','NASDAQ','airbnb.com'],
  ['DASH','DoorDash','NYSE','doordash.com'],['SPOT','Spotify','NYSE','spotify.com'],
  ['SNAP','Snap','NYSE','snap.com'],['PINS','Pinterest','NYSE','pinterest.com'],
  ['TWLO','Twilio','NYSE','twilio.com'],['ZM','Zoom','NASDAQ','zoom.us'],
  ['DOCU','DocuSign','NASDAQ','docusign.com'],['ROKU','Roku','NASDAQ','roku.com'],
  ['SNOW','Snowflake','NYSE','snowflake.com'],['DDOG','Datadog','NASDAQ','datadoghq.com'],
  ['NET','Cloudflare','NYSE','cloudflare.com'],['CRWD','CrowdStrike','NASDAQ','crowdstrike.com'],
  ['PANW','Palo Alto Networks','NASDAQ','paloaltonetworks.com'],['ZS','Zscaler','NASDAQ','zscaler.com'],
  ['OKTA','Okta','NASDAQ','okta.com'],['MDB','MongoDB','NASDAQ','mongodb.com'],
  ['TEAM','Atlassian','NASDAQ','atlassian.com'],['HUBS','HubSpot','NYSE','hubspot.com'],
  ['NOW','ServiceNow','NYSE','servicenow.com'],['WDAY','Workday','NASDAQ','workday.com'],
  ['INTU','Intuit','NASDAQ','intuit.com'],['ADP','ADP','NASDAQ','adp.com'],
  ['BKNG','Booking Holdings','NASDAQ','bookingholdings.com'],['MAR','Marriott','NASDAQ','marriott.com'],
  ['HLT','Hilton','NYSE','hilton.com'],['F','Ford','NYSE','ford.com'],
  ['GM','General Motors','NYSE','gm.com'],['RIVN','Rivian','NASDAQ','rivian.com'],
  ['LCID','Lucid','NASDAQ','lucidmotors.com'],['NIO','NIO','NYSE','nio.com'],
  ['XPEV','XPeng','NYSE','heyxpeng.com'],['LI','Li Auto','NASDAQ','lixiang.com'],
  ['BABA','Alibaba','NYSE','alibaba.com'],['JD','JD.com','NASDAQ','jd.com'],
  ['PDD','PDD Holdings','NASDAQ','pddholdings.com'],['BIDU','Baidu','NASDAQ','baidu.com'],
  ['NTES','NetEase','NASDAQ','netease.com'],['TME','Tencent Music','NYSE','tencentmusic.com'],
  ['BILI','Bilibili','NASDAQ','bilibili.com'],['TSM','TSMC','NYSE','tsmc.com'],
  ['SAP','SAP','NYSE','sap.com'],['ASML','ASML','NASDAQ','asml.com'],
  ['NVS','Novartis','NYSE','novartis.com'],['HSBC','HSBC','NYSE','hsbc.com'],
  ['TM','Toyota','NYSE','toyota.com'],['SONY','Sony','NYSE','sony.com'],
  ['BHP','BHP Group','NYSE','bhp.com'],['RIO','Rio Tinto','NYSE','riotinto.com'],
  ['SHEL','Shell','NYSE','shell.com'],['BP','BP','NYSE','bp.com'],
  ['TTE','TotalEnergies','NYSE','totalenergies.com'],['UL','Unilever','NYSE','unilever.com'],
  ['DEO','Diageo','NYSE','diageo.com'],['LVMUY','LVMH','OTC','lvmh.com'],
  ['MC','LVMH (PA)','EPA','lvmh.com'],['NVO','Novo Nordisk','NYSE','novonordisk.com'],
  ['AZN','AstraZeneca','NASDAQ','astrazeneca.com'],['GSK','GSK','NYSE','gsk.com'],
  ['GME','GameStop','NYSE','gamestop.com'],['AMC','AMC Entertainment','NYSE','amctheatres.com'],
  ['BB','BlackBerry','NYSE','blackberry.com'],['PLTR','Palantir','NYSE','palantir.com'],
  ['COIN','Coinbase','NASDAQ','coinbase.com'],['HOOD','Robinhood','NASDAQ','robinhood.com'],
  ['MSTR','MicroStrategy','NASDAQ','microstrategy.com'],['MARA','Marathon Digital','NASDAQ','marathondh.com'],
  ['RIOT','Riot Platforms','NASDAQ','riotplatforms.com'],['SOFI','SoFi','NASDAQ','sofi.com'],
  ['AFRM','Affirm','NASDAQ','affirm.com'],['UPST','Upstart','NASDAQ','upstart.com'],
  ['SMCI','Super Micro','NASDAQ','supermicro.com'],['ARM','Arm Holdings','NASDAQ','arm.com'],
  ['DELL','Dell','NYSE','dell.com'],['HPQ','HP Inc','NYSE','hp.com']
];

/* ---------- COMMODITIES: 30 ---------- */
var COMMODITIES = [
  ['XAUUSD','Gold','metals','🧈'],['XAGUSD','Silver','metals','⚪'],
  ['XPTUSD','Platinum','metals','⚪'],['XPDUSD','Palladium','metals','⚪'],
  ['CL','WTI Crude Oil','energy','🛢️'],['BZ','Brent Crude','energy','🛢️'],
  ['NG','Natural Gas','energy','🔥'],['HO','Heating Oil','energy','🔥'],
  ['RB','RBOB Gasoline','energy','⛽'],['HG','Copper','metals','🔶'],
  ['ALI','Aluminum','metals','⚙️'],['ZNC','Zinc','metals','⚙️'],
  ['NI','Nickel','metals','⚙️'],['LE','Live Cattle','agri','🐄'],
  ['HE','Lean Hogs','agri','🐖'],['ZC','Corn','agri','🌽'],
  ['ZS','Soybeans','agri','🌱'],['ZW','Wheat','agri','🌾'],
  ['ZL','Soybean Oil','agri','🦴'],['ZM','Soybean Meal','agri','🌱'],
  ['KC','Coffee','agri','☕'],['CT','Cotton','agri','🧶'],
  ['SB','Sugar','agri','🍬'],['CC','Cocoa','agri','🍫'],
  ['OJ','Orange Juice','agri','🍊'],['LBR','Lumber','materials','🪵'],
  ['URA','Uranium','energy','☢️'],['LITHIUM','Lithium','metals','⚡'],
  ['COBALT','Cobalt','metals','⚙️'],['IRON','Iron Ore','metals','⛏️']
];

/* ---------- INDICES: 20 ---------- */
var INDICES = [
  ['SPX','S&P 500','us'],['NDX','Nasdaq 100','us'],['DJI','Dow Jones 30','us'],
  ['RUT','Russell 2000','us'],['VIX','VIX Volatility','us'],['DXY','US Dollar Index','us'],
  ['DAX','DAX 40','de'],['FTSE','FTSE 100','gb'],['CAC','CAC 40','fr'],
  ['IBEX','IBEX 35','es'],['MIB','FTSE MIB','it'],['SMI','Swiss SMI','ch'],
  ['AEX','AEX','nl'],['STOXX50','Euro Stoxx 50','eu'],['N225','Nikkei 225','jp'],
  ['HSI','Hang Seng','hk'],['SSEC','Shanghai','cn'],['ASX','ASX 200','au'],
  ['BSE','Sensex','in'],['BVSP','Bovespa','br']
];

/* ---------- ETF: 20 ---------- */
var ETFS = [
  ['SPY','SPDR S&P 500 ETF','statestreet.com'],['QQQ','Invesco QQQ','invesco.com'],
  ['IWM','iShares Russell 2000','ishares.com'],['DIA','SPDR Dow Jones','statestreet.com'],
  ['VOO','Vanguard S&P 500','vanguard.com'],['VTI','Vanguard Total Market','vanguard.com'],
  ['EFA','iShares MSCI EAFE','ishares.com'],['EEM','iShares MSCI Emerging','ishares.com'],
  ['VWO','Vanguard Emerging','vanguard.com'],['AGG','iShares Core US Bond','ishares.com'],
  ['TLT','iShares 20+ Year Treasury','ishares.com'],['HYG','iShares High Yield','ishares.com'],
  ['LQD','iShares Investment Grade','ishares.com'],['GLD','SPDR Gold Trust','statestreet.com'],
  ['SLV','iShares Silver','ishares.com'],['USO','US Oil Fund','uscfinvestments.com'],
  ['UNG','US Natural Gas','uscfinvestments.com'],['XLF','Financial Select Sector','statestreet.com'],
  ['XLE','Energy Select Sector','statestreet.com'],['XLK','Technology Select Sector','statestreet.com']
];

/* ---------- Network catalog (для Wallet/Deposit как у Binance) ---------- */
var NETWORKS = [
  { id:'BTC',     name:'Bitcoin',           symbol:'BTC',  min:0.0001,  fee:0.0001,  confirm:2 },
  { id:'ETH',     name:'Ethereum (ERC-20)', symbol:'ETH',  min:0.001,   fee:0.002,   confirm:12 },
  { id:'BSC',     name:'BNB Smart Chain (BEP-20)', symbol:'BNB', min:0.001, fee:0.0005, confirm:15 },
  { id:'TRX',     name:'TRON (TRC-20)',     symbol:'TRX',  min:1,       fee:1,       confirm:1 },
  { id:'SOL',     name:'Solana',            symbol:'SOL',  min:0.01,    fee:0.000005, confirm:1 },
  { id:'ARB',     name:'Arbitrum One',      symbol:'ETH',  min:0.001,   fee:0.0001,  confirm:1 },
  { id:'OP',      name:'Optimism',          symbol:'ETH',  min:0.001,   fee:0.0001,  confirm:1 },
  { id:'BASE',    name:'Base',              symbol:'ETH',  min:0.001,   fee:0.0001,  confirm:1 },
  { id:'POLYGON', name:'Polygon (PoS)',     symbol:'MATIC',min:0.1,     fee:0.001,   confirm:128 },
  { id:'AVAX',    name:'Avalanche C-Chain', symbol:'AVAX', min:0.01,    fee:0.0025,  confirm:1 },
  { id:'TON',     name:'TON',               symbol:'TON',  min:0.01,    fee:0.005,   confirm:1 },
  { id:'NEAR',    name:'NEAR',              symbol:'NEAR', min:0.01,    fee:0.001,   confirm:1 },
  { id:'XLM',     name:'Stellar',           symbol:'XLM',  min:1,       fee:0.00001, confirm:1 },
  { id:'XRP',     name:'XRP Ledger',        symbol:'XRP',  min:1,       fee:0.0001,  confirm:1 },
  { id:'LTC',     name:'Litecoin',          symbol:'LTC',  min:0.001,   fee:0.0001,  confirm:6 },
  { id:'BCH',     name:'Bitcoin Cash',      symbol:'BCH',  min:0.001,   fee:0.0001,  confirm:6 },
  { id:'DOGE',    name:'Dogecoin',          symbol:'DOGE', min:1,       fee:1,       confirm:6 },
  { id:'DOT',     name:'Polkadot',          symbol:'DOT',  min:0.1,     fee:0.01,    confirm:1 },
  { id:'ATOM',    name:'Cosmos',            symbol:'ATOM', min:0.1,     fee:0.005,   confirm:1 },
  { id:'ALGO',    name:'Algorand',          symbol:'ALGO', min:1,       fee:0.001,   confirm:1 },
  { id:'APT',     name:'Aptos',             symbol:'APT',  min:0.01,    fee:0.0001,  confirm:1 },
  { id:'SUI',     name:'Sui',               symbol:'SUI',  min:0.01,    fee:0.0001,  confirm:1 },
  { id:'MATIC',   name:'Polygon zkEVM',     symbol:'MATIC',min:0.1,     fee:0.001,   confirm:1 },
  { id:'STARK',   name:'Starknet',          symbol:'ETH',  min:0.001,   fee:0.0001,  confirm:1 },
  { id:'ZKSYNC',  name:'zkSync Era',        symbol:'ETH',  min:0.001,   fee:0.0001,  confirm:1 }
];

/* ---------- Build registry ---------- */
var REG = [];

CRYPTO.forEach(function (c) {
  var sym = c[0], name = c[1];
  REG.push({
    symbol: sym + 'USDT',
    base: sym, quote: 'USDT',
    name: name,
    type: 'crypto',
    binance: sym + 'USDT',
    logo: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/svg/color/' + sym.toLowerCase() + '.svg'
  });
});

FX.forEach(function (f) {
  REG.push({
    symbol: f[0],
    base: f[1], quote: f[2],
    name: f[1] + '/' + f[2],
    type: 'fx',
    countryBase: f[3], countryQuote: f[4],
    logo: 'https://flagcdn.com/w40/' + f[3] + '.png',
    logoQuote: 'https://flagcdn.com/w40/' + f[4] + '.png'
  });
});

STOCKS.forEach(function (s) {
  REG.push({
    symbol: s[0],
    base: s[0], quote: 'USD',
    name: s[1],
    type: 'stock',
    exchange: s[2],
    logo: 'https://logo.clearbit.com/' + s[3]
  });
});

COMMODITIES.forEach(function (c) {
  REG.push({
    symbol: c[0],
    base: c[0], quote: c[0].indexOf('XAU') === 0 || c[0].indexOf('XAG') === 0 || c[0].indexOf('XP') === 0 ? 'USD' : 'USD',
    name: c[1],
    type: 'commodity',
    sector: c[2],
    glyph: c[3],
    logo: null /* SVG-glyph рендерится прямо */
  });
});

INDICES.forEach(function (i) {
  REG.push({
    symbol: i[0],
    base: i[0], quote: 'USD',
    name: i[1],
    type: 'index',
    country: i[2],
    logo: 'https://flagcdn.com/w40/' + i[2] + '.png'
  });
});

ETFS.forEach(function (e) {
  REG.push({
    symbol: e[0],
    base: e[0], quote: 'USD',
    name: e[1],
    type: 'etf',
    logo: 'https://logo.clearbit.com/' + e[2]
  });
});

/* ---------- Seed prices (детерминированный псевдо-рандом для не-крипты) ----------
 * Хеш по символу → стартовая цена. Мутация в ±0.5% в gromLivePrice.
 * Для крипты — переписывается реальной ценой из Binance WS. */
function hashStr(s) {
  var h = 2166136261 >>> 0;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h;
}
function seedPrice(it) {
  var h = hashStr(it.symbol);
  var r = (h % 10000) / 10000;
  switch (it.type) {
    case 'crypto':
      if (it.base === 'BTC') return 60000 + r * 50000;
      if (it.base === 'ETH') return 2000 + r * 2500;
      if (it.base === 'BNB') return 400 + r * 400;
      if (it.base === 'SOL') return 80 + r * 200;
      if (['USDT','USDC','DAI','BUSD','TUSD','FDUSD','USDD','FRAX'].indexOf(it.base) >= 0) return 1 + (r-0.5) * 0.001;
      if (['DOGE','SHIB','PEPE','BONK','WIF','FLOKI'].indexOf(it.base) >= 0) return 0.00001 + r * 0.5;
      return 0.05 + r * 50;
    case 'fx':
      if (it.symbol === 'EURUSD') return 1.05 + r * 0.10;
      if (it.symbol === 'USDJPY') return 140 + r * 25;
      if (it.symbol === 'GBPUSD') return 1.20 + r * 0.20;
      if (it.symbol === 'USDCHF') return 0.85 + r * 0.15;
      if (it.symbol.indexOf('JPY') >= 0) return 100 + r * 80;
      if (it.symbol.indexOf('TRY') >= 0) return 30 + r * 10;
      if (it.symbol.indexOf('IDR') >= 0) return 15000 + r * 1000;
      return 0.5 + r * 1.5;
    case 'stock':
      return 20 + r * 600;
    case 'commodity':
      if (it.symbol === 'XAUUSD') return 2400 + r * 200;
      if (it.symbol === 'XAGUSD') return 28 + r * 8;
      if (it.symbol === 'XPTUSD') return 950 + r * 200;
      if (it.symbol === 'XPDUSD') return 950 + r * 250;
      if (it.symbol === 'CL' || it.symbol === 'BZ') return 70 + r * 30;
      if (it.symbol === 'NG') return 2 + r * 4;
      return 50 + r * 300;
    case 'index':
      if (it.symbol === 'SPX') return 5000 + r * 800;
      if (it.symbol === 'NDX') return 16000 + r * 4000;
      if (it.symbol === 'DJI') return 38000 + r * 5000;
      if (it.symbol === 'DAX') return 17000 + r * 3000;
      if (it.symbol === 'N225') return 38000 + r * 5000;
      if (it.symbol === 'HSI') return 17000 + r * 4000;
      if (it.symbol === 'DXY') return 100 + r * 8;
      if (it.symbol === 'VIX') return 12 + r * 25;
      return 1000 + r * 5000;
    case 'etf':
      if (it.symbol === 'SPY') return 500 + r * 80;
      if (it.symbol === 'QQQ') return 400 + r * 100;
      return 20 + r * 200;
  }
  return 100 + r * 100;
}

/* ---------- Live price store ---------- */
var PRICES = Object.create(null);
var CHANGES = Object.create(null); // 24h % change
var SUBS = [];

REG.forEach(function (it) {
  PRICES[it.symbol] = seedPrice(it);
  CHANGES[it.symbol] = ((hashStr(it.symbol + 'chg') % 2000) / 100) - 10; // -10% .. +10%
});

function notifySubs() {
  for (var i = 0; i < SUBS.length; i++) {
    try { SUBS[i](); } catch (_) {}
  }
}

/* ---------- Binance public WS (live crypto) ---------- */
var WS = null, WS_RETRY = 0;

function connectBinanceWS() {
  if (typeof WebSocket === 'undefined') return;
  if (location.protocol === 'file:') return; // file:// → CSP/CORS; работает только http(s)
  try {
    WS = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');
    WS.onopen = function () {
      WS_RETRY = 0;
      console.log('[grom-instruments] Binance miniTicker stream connected');
      try {
        window.__gromLiveFeedActive = true;
        window.__gromLastLiveTick = Date.now();
        window.dispatchEvent(new CustomEvent('grom-public-feed', { detail: { active: true, source: 'binance' } }));
      } catch (_) {}
    };
    WS.onmessage = function (ev) {
      try {
        var arr = JSON.parse(ev.data);
        if (!Array.isArray(arr)) return;
        var changed = false;
        for (var i = 0; i < arr.length; i++) {
          var t = arr[i];
          if (!t || !t.s) continue;
          if (PRICES[t.s] === undefined) continue;
          var p = parseFloat(t.c);
          if (!isFinite(p) || p <= 0) continue;
          PRICES[t.s] = p;
          if (t.o) {
            var open = parseFloat(t.o);
            if (isFinite(open) && open > 0) CHANGES[t.s] = ((p - open) / open) * 100;
          }
          changed = true;
        }
        if (changed) {
          try {
            window.__gromLiveFeedActive = true;
            window.__gromLastLiveTick = Date.now();
            window.dispatchEvent(new CustomEvent('grom-public-feed', { detail: { active: true, source: 'binance' } }));
          } catch (_) {}
          notifySubs();
        }
      } catch (_) {}
    };
    WS.onclose = function () {
      WS = null;
      WS_RETRY++;
      var delay = Math.min(30000, 1000 * Math.pow(2, WS_RETRY));
      setTimeout(connectBinanceWS, delay);
    };
    WS.onerror = function () { try { WS.close(); } catch (_) {} };
  } catch (e) {
    console.warn('[grom-instruments] WS init failed', e);
  }
}

/* ---------- Mock движения для не-крипты (раз в секунду) ---------- */
function mockTickNonCrypto() {
  for (var i = 0; i < REG.length; i++) {
    var it = REG[i];
    if (it.type === 'crypto') continue;
    var cur = PRICES[it.symbol];
    if (!isFinite(cur)) continue;
    // случайный шум ±0.05%
    var drift = (Math.random() - 0.5) * 0.001;
    PRICES[it.symbol] = cur * (1 + drift);
  }
  notifySubs();
}
setInterval(mockTickNonCrypto, 1000);

/* ---------- Public API ---------- */
window.GROM_INSTRUMENTS = REG;
window.GROM_NETWORKS = NETWORKS;

window.gromGetInstrument = function (sym) {
  if (!sym) return null;
  var s = String(sym).toUpperCase().replace(/\//g, '');
  for (var i = 0; i < REG.length; i++) {
    var it = REG[i];
    if (it.symbol === s) return it;
    if (it.symbol === s + 'USDT') return it;
    if ((it.base + it.quote) === s) return it;
  }
  return null;
};

window.gromInstrumentsByType = function (type) {
  if (!type || type === 'all') return REG.slice();
  return REG.filter(function (it) { return it.type === type; });
};

window.gromInstrumentLogo = function (it) {
  if (!it) return '';
  return it.logo || '';
};

window.gromLivePrice = function (sym) {
  var it = window.gromGetInstrument(sym);
  if (!it) return null;
  return PRICES[it.symbol];
};

window.gromLiveChange = function (sym) {
  var it = window.gromGetInstrument(sym);
  if (!it) return 0;
  return CHANGES[it.symbol] || 0;
};

window.gromOnPriceUpdate = function (cb) {
  if (typeof cb !== 'function') return function () {};
  SUBS.push(cb);
  return function unsub() {
    var i = SUBS.indexOf(cb);
    if (i >= 0) SUBS.splice(i, 1);
  };
};

/* Bootstrap */
connectBinanceWS();
console.log('[grom-instruments] loaded:',
  REG.length, 'instruments ·',
  REG.filter(function(x){return x.type==='crypto';}).length, 'crypto ·',
  REG.filter(function(x){return x.type==='fx';}).length, 'fx ·',
  REG.filter(function(x){return x.type==='stock';}).length, 'stocks ·',
  REG.filter(function(x){return x.type==='commodity';}).length, 'commodities ·',
  REG.filter(function(x){return x.type==='index';}).length, 'indices ·',
  REG.filter(function(x){return x.type==='etf';}).length, 'etfs');

})();
