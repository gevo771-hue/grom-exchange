/** Classify Polymarket events — tags are localized (en/ru/…), so match both. */
export function pmCategory(ev) {
  const tags = (Array.isArray(ev.tags) ? ev.tags : [])
    .map((t) => [t?.slug, t?.label].filter(Boolean).join(' ').toLowerCase().trim())
    .filter(Boolean);
  const title = String(ev.title || ev.question || '').toLowerCase();
  const series = String(ev.seriesSlug || (Array.isArray(ev.series) && ev.series[0]?.slug) || '').toLowerCase();
  const hay = [String(ev.category || ''), String(ev.slug || '').replace(/-/g, ' '), title, series, ...tags].join(' ').toLowerCase();
  // Short tickers/league names must be complete words: LEC is not elections,
  // ETH is not Netherlands, and IPO is not a fragment of a place name.
  const matches = (text, keyword) => /^[a-z0-9]{2,4}$/.test(keyword)
    ? new RegExp('(?:^|[^a-z0-9])' + keyword + '(?=$|[^a-z0-9])').test(text)
    : text.includes(keyword);
  const has = (...ks) => ks.some((k) => k && matches(hay, String(k).toLowerCase()));
  const tagHas = (...ks) => tags.some((t) => ks.some((k) => {
    const n = String(k).toLowerCase();
    return matches(t, n);
  }));

  // Esports BEFORE sport — RU "киберспорт" contains "спорт"
  if (
    tagHas('esport', 'киберспорт', 'gaming', 'игры', 'games')
    || has(
      'esport', 'киберспорт', 'league of legends', 'лига легенд', 'lol:', 'dota', 'counter-strike',
      'cs2', 'cs:go', 'valorant', 'valorant:', 'overwatch', 'call of duty', 'mobile legends',
      'lck', 'lpl', 'lec', 'lcs', 'worlds', 'asgard', 'epl masters',
    )
  ) return 'esports';

  if (
    tagHas('crypto', 'крипто', 'bitcoin', 'биткоин', 'ethereum', 'эфириум')
    || has(
      'crypto', 'крипто', 'bitcoin', 'btc', 'биткоин', 'ethereum', 'eth', 'эфириум', 'solana', 'sol ',
      'memecoin', 'dogecoin', 'ripple', 'xrp', 'altcoin', 'defi', 'up or down', 'вверх или вниз',
    )
  ) return 'crypto';

  if (
    tagHas(
      'mlb', 'nba', 'nfl', 'nhl', 'soccer', 'футбол', 'tennis', 'теннис', 'ufc', 'hockey', 'хоккей',
      'cricket', 'baseball', 'basketball', 'баскетбол', 'sport', 'спорт',
    )
    || has(
      'nfl', 'nba', 'mlb', 'nhl', 'wnba', 'soccer', 'football', 'футбол', 'tennis', 'теннис',
      'baseball', 'бейсбол', 'basketball', 'баскетбол', 'hockey', 'хоккей', 'ufc', 'mma', 'f1',
      'golf', 'world cup', 'champions league', 'premier league', 'la liga', 'serie a', 'bundesliga',
      'olympic', 'олимпи', 'cricket', 'atp ', 'wta ', 'grand slam',
    )
  ) return 'sport';

  // Fed / macro → economy (even if also tagged Politics)
  if (
    tagHas('economy', 'экономи', 'fed', 'фрс', 'fomc', 'inflation', 'инфляц', 'gdp', 'cpi')
    || has(
      'fed decision', 'fed rate', 'fomc', 'rate cut', 'interest rate', 'inflation', 'инфляц',
      'cpi', 'gdp', 'recession', 'рецесс', 'jobs report', 'безработиц', 'econom', 'экономи',
      'фрс', 'ставк',
    )
  ) return 'economy';

  if (
    tagHas('finance', 'финанс', 'stock', 'акци', 'ipo', 'earnings', 'nasdaq', 'commodit', 'сырь')
    || has(
      'stock', 'акци', 'earnings', 'отчётн', 'nasdaq', 's&p', 'ipo', 'market cap', 'капитализац',
      'tesla', 'nvidia', 'apple', 'gold', 'золот', 'silver', 'серебр', 'oil', 'нефть', 'crude',
      'wti', 'commodit', 'финанс', 'finance',
    )
  ) return 'finance';

  if (
    tagHas('politic', 'политик', 'election', 'выбор', 'geopolit', 'геополит', 'iran', 'иран')
    || has(
      'politic', 'политик', 'election', 'выбор', 'president', 'президент', 'senate', 'сенат',
      'congress', 'конгресс', 'geopolit', 'геополит', 'trump', 'трамп', 'biden', 'байден',
      'iran', 'иран', 'war', 'войн', 'ceasefire', 'перемири', 'prime minister', 'премьер',
      'governor', 'губернатор', 'парламент', 'демократ', 'республик',
    )
  ) return 'politics';

  if (
    tagHas('culture', 'культур', 'entertainment', 'развлеч', 'movie', 'music', 'музык', 'ai', 'ии')
    || has(
      'culture', 'культур', 'movie', 'фильм', 'music', 'музык', 'tv ', 'celebrit', 'award',
      'oscar', 'оскар', 'grammy', 'грамми', 'entertain', 'развлеч', 'pop culture',
      'anthropic', 'openai', 'gemini', 'gpt-', 'claude', 'искусственн', 'ai model', 'ai lab',
      'ии-модел', 'модель ии',
    )
  ) return 'culture';

  // Weather / natural events stay in "all" (shown under Все)
  return 'all';
}
