/**
 * Localized SEO copy: Stage 1 es + pt-BR; Stage 2 tr + ru; Stage 3 vi + id.
 * English remains in seo-route-content.mjs SEO_COPY.
 */
import { SEO_LOCALES, localePath } from './seo-locales.mjs';
import { SEO_META_TR_RU, SEO_COPY_TR, SEO_COPY_RU } from './seo-copy-tr-ru.mjs';
import { SEO_META_VI_ID, SEO_COPY_VI, SEO_COPY_ID } from './seo-copy-vi-id.mjs';

function p(localeCode, productPath) {
  const loc = SEO_LOCALES.find((l) => l.code === localeCode) || SEO_LOCALES[0];
  return localePath(loc, productPath);
}

function nav(localeCode) {
  const L = {
    en: ['Home', 'Swap', 'Trade', 'Predictions', 'Stocks', 'Markets'],
    es: ['Inicio', 'Swap', 'Trade', 'Predicciones', 'Stocks', 'Markets'],
    'pt-BR': ['Início', 'Swap', 'Trade', 'Predições', 'Stocks', 'Markets'],
    tr: ['Ana sayfa', 'Swap', 'Trade', 'Predictions', 'Stocks', 'Markets'],
    ru: ['Главная', 'Swap', 'Trade', 'Predictions', 'Stocks', 'Markets'],
    vi: ['Trang chủ', 'Swap', 'Trade', 'Predictions', 'Stocks', 'Markets'],
    id: ['Beranda', 'Swap', 'Trade', 'Predictions', 'Stocks', 'Markets'],
  }[localeCode] || ['Home', 'Swap', 'Trade', 'Predictions', 'Stocks', 'Markets'];
  const paths = ['/', '/swap', '/futures', '/predict', '/stocks', '/markets'];
  const links = paths.map((path, i) => `<a href="${p(localeCode, path)}">${L[i]}</a>`).join('\n  ');
  return `<nav class="grom-seo-nav" aria-label="Product links">\n  ${links}\n</nav>`;
}

export function localizedNavHtml(localeCode) {
  return nav(localeCode);
}

/** Unique title + description per locale × route */
export const SEO_META_BY_LOCALE = {
  en: {
    landing: {
      title: 'GROM Exchange — Crypto DEX, Futures, Prediction Markets & Tokenized stocks',
      description: 'Swaps, perpetual futures, prediction markets and tokenized stocks from your own wallet. No sign-up, no deposits, no KYC for swaps.',
    },
    dashboard: {
      title: 'Cross-Chain Crypto Swap — Best Route, 20+ Chains',
      description: 'Swap 10 000+ tokens across 20+ chains. Six routers queried in parallel, you get the best quote. Signed in your wallet, settled on-chain.',
    },
    futures: {
      title: 'Perpetual Futures From Your Wallet — Up to 40x',
      description: 'Trade spot and perpetual futures from a self-custody wallet. Margin stays on the venue — GROM never holds your deposit.',
    },
    predict: {
      title: 'Prediction Markets — Politics, Sports, Crypto',
      description: 'Live event markets funded from your own wallet and resolved on-chain. 0.30% taker, 0% maker. No balance to top up, nothing to withdraw.',
    },
    xstocks: {
      title: 'Tokenized Stocks On-Chain, 24/7 — AAPL, TSLA, NVDA',
      description: 'Buy fractional tokenized equities any time, including weekends. Settles to the same wallet you swap and trade perps with. No brokerage account.',
    },
    markets: {
      title: 'Crypto Markets & Live Prices — GROM Exchange',
      description: 'Live prices, 24h volume and depth across crypto, TradFi and trending pairs. Open any market straight into the terminal.',
    },
  },
  es: {
    landing: {
      title: 'GROM Exchange — Terminal DeFi sin custodia',
      description: 'Swap, futuros perpetuos, mercados de predicción y Tokenized Stocks desde tu propio monedero. Sin depósito custodial en GROM.',
    },
    dashboard: {
      title: 'Swap cripto cross-chain desde tu monedero',
      description: 'Cambia tokens entre muchas redes firmando en tu wallet. Cotizaciones de varios routers; liquidación on-chain a tu dirección.',
    },
    futures: {
      title: 'Spot y Perpetual Futures desde tu wallet',
      description: 'Opera spot y perpetuos con firma desde un monedero de autocustodia. El margen vive en el venue, no en un saldo GROM.',
    },
    predict: {
      title: 'Prediction Markets desde tu monedero',
      description: 'Toma posiciones sobre eventos con fondos de tu wallet. Liquidación según las reglas del mercado, no un pago discrecional de GROM.',
    },
    xstocks: {
      title: 'Tokenized Stocks (RWA) on-chain 24/7',
      description: 'Exposición tokenizada a acciones desde tu monedero, a menudo fuera del horario bursátil tradicional. No es una cuenta de bróker.',
    },
    markets: {
      title: 'Markets y precios en vivo — GROM Exchange',
      description: 'Descubre precios y abre Swap, Trade, Predictions o Stocks. Markets no custodia fondos; solo ayuda a elegir el mercado.',
    },
  },
  'pt-BR': {
    landing: {
      title: 'GROM Exchange — Terminal DeFi não custodial',
      description: 'Swap, perpetual futures, prediction markets e Tokenized Stocks pela sua própria carteira. Sem depósito custodial na GROM.',
    },
    dashboard: {
      title: 'Swap cripto cross-chain pela sua carteira',
      description: 'Troque tokens entre várias redes assinando na wallet. Cotações de vários roteadores; liquidação on-chain no seu endereço.',
    },
    futures: {
      title: 'Spot e Perpetual Futures pela sua wallet',
      description: 'Negocie spot e perpétuos com assinatura de uma carteira de autocustódia. A margem fica no venue, não em saldo GROM.',
    },
    predict: {
      title: 'Prediction Markets pela sua carteira',
      description: 'Posições em eventos com fundos da sua wallet. Liquidação pelas regras do mercado — não um pagamento discricionário da GROM.',
    },
    xstocks: {
      title: 'Ações tokenizadas (RWA) on-chain 24/7 — GROM Stocks',
      description: 'Exposição tokenizada a ações pela sua carteira, muitas vezes fora do horário da bolsa tradicional. Não é conta de corretora.',
    },
    markets: {
      title: 'Markets e preços ao vivo — GROM Exchange',
      description: 'Descubra preços e abra Swap, Trade, Predictions ou Stocks. Markets não custodia fundos; só ajuda a escolher o mercado.',
    },
  },
  ...SEO_META_TR_RU,
  ...SEO_META_VI_ID,
};

const ES = {
  landing: {
    h1: 'GROM Exchange — terminal DeFi sin custodia',
    lead: 'GROM es un hub cripto centrado en el monedero. Conectas un wallet de autocustodia, conservas las claves y firmas cada operación. No hay cuenta de depósito en el exchange ni KYC de GROM para el trading básico con wallet.',
    appName: 'GROM Exchange',
    appDesc: 'Terminal DeFi no custodial para swaps cross-chain, spot y perpetual futures, prediction markets y tokenized stocks.',
    sections: [
      {
        h2: 'Cuatro líneas de producto, un monedero',
        html: `<p>GROM reúne cuatro mercados en una interfaz: <a href="${p('es', '/swap')}">swaps cross-chain y enrutado tipo spot</a>, <a href="${p('es', '/futures')}">perpetual futures y trading spot</a>, <a href="${p('es', '/predict')}">prediction markets</a> y <a href="${p('es', '/stocks')}">Tokenized Stocks (RWA)</a>. Los precios y el descubrimiento viven en <a href="${p('es', '/markets')}">Markets</a>.</p>
<p>Cada producto liquida a direcciones que controlas. Cotizaciones y fills vienen de venues y agregadores on-chain; GROM no custodia tus saldos.</p>`,
      },
      {
        h2: 'Cómo funciona el trading',
        html: `<p>Conecta un monedero Web3 (extensión o WalletConnect). Elige un producto, revisa la cotización o el ticket y confirma la firma o transacción en tu wallet. Los activos se mueven en la red o venue de destino — no a un saldo GROM del que luego debas retirar.</p>
<p>Las redes disponibles para Swap incluyen las EVM principales y otros ecosistemas que muestre la capa de routing. Futuros, predicciones y Tokenized Stocks usan las redes que cada producto exige. Verifica siempre red y activo en el prompt del monedero antes de firmar.</p>`,
      },
      {
        h2: 'Comisiones y riesgos',
        html: `<p>Los swaps muestran fees de routing en la cotización más el gas de red. Perpetuals, Predictions y Tokenized Stocks cobran fees del venue revelados en el ticket antes de confirmar. GROM no promete rentabilidades, volumen ni profundidad de liquidez.</p>
<p>Operar implica riesgo de pérdida. Los perpetuos apalancados pueden liquidarse. Las apuestas de predicción pueden quedar en cero. Los Tokenized Stocks son wrappers cripto de exposición a acciones — no acciones de bróker tradicional — y pueden diferir en liquidación, horario y regulación. Usa solo fondos que puedas permitirte perder.</p>`,
      },
    ],
    faq: [
      { q: '¿Qué es GROM Exchange?', a: 'GROM es un terminal DeFi no custodial. Operas desde tu propio monedero en Swap, perpetuos, prediction markets y Tokenized Stocks sin depositar en una cuenta custodial del exchange.' },
      { q: '¿Necesito crear cuenta o pasar KYC?', a: 'El trading básico con wallet no exige cuenta de email ni KYC de GROM. Los on-ramps fiat y algunas regiones pueden aplicar sus propias comprobaciones. Cumple siempre la ley local.' },
      { q: '¿Dónde están mis fondos?', a: 'En tu monedero y en los venues donde operas. El software de GROM ayuda a enrutar y firmar; no retiene depósitos de usuarios.' },
      { q: '¿Qué productos puedo abrir desde la home?', a: 'Swap (/es/swap), Trade para spot y perpetuos (/es/futures), Predictions (/es/predict), Stocks (/es/stocks) y Markets (/es/markets).' },
    ],
  },
  dashboard: {
    h1: 'Swap cripto cross-chain desde tu monedero',
    lead: 'Cambia tokens entre muchas redes sin crear un saldo GROM. Instant Swap consulta varios routers, muestra una cotización y pide a tu wallet que firme. La liquidación es on-chain a tu dirección.',
    appName: 'GROM Instant Swap',
    appDesc: 'Agregador de swap cripto cross-chain no custodial con firmas de wallet y liquidación on-chain.',
    sections: [
      {
        h2: 'Qué hace Instant Swap',
        html: `<p>Elige token y red de origen, token y red de destino, y un importe. GROM pide cotizaciones a varios agregadores y bridges en paralelo y presenta una ruta que puedes aceptar o rechazar. Nunca envías el principal del swap a un hot wallet de GROM.</p>
<p>La cobertura incluye miles de tokens en más de veinte redes cuando hay liquidez y bridges. La disponibilidad exacta depende de los routers en el momento de la cotización — puede no haber ruta para pares ilíquidos.</p>`,
      },
      {
        h2: 'Redes, monederos y firmas',
        html: `<p>Usa un monedero de autocustodia capaz de firmar transacciones EVM (y otros ecosistemas que soporte el desk). Tras confirmar, el wallet puede pedir aprobar un spend y luego enviar el swap o bridge. Las rutas cross-chain pueden tardar más que un swap en la misma red; sigue el estado en el desk y en la actividad del monedero.</p>
<p>Productos relacionados a un clic: <a href="${p('es', '/futures')}">Trade</a> para spot y perpetuos, <a href="${p('es', '/markets')}">Markets</a> para precios, <a href="${p('es', '/predict')}">Predictions</a> y <a href="${p('es', '/stocks')}">Tokenized Stocks</a>.</p>`,
      },
      {
        h2: 'Fees, slippage y riesgos',
        html: `<p>Cada cotización lista salida estimada, fee de ruta y gas de red. El slippage controla cuánto movimiento de precio aceptas. Bridges y DEXs pueden fallar, retrasarse o devolver menos de lo estimado en mercados volátiles.</p>
<p>Revisa siempre contratos, redes e importes en el prompt del monedero. GROM no inventa precios garantizados ni bridges sin riesgo.</p>`,
      },
    ],
    faq: [
      { q: '¿Instant Swap es custodial?', a: 'No. Firmas en tu monedero y la liquidación va a tu dirección. GROM no custodia el principal del swap.' },
      { q: '¿Por qué no hay ruta?', a: 'Los agregadores pueden carecer de liquidez, pausar un bridge o rechazar el par o el tamaño. Prueba otro token, red o importe.' },
      { q: '¿Qué fees pago?', a: 'Fees de routing mostrados en la cotización más gas en la red de origen (y a veces destino). Fees de bridge de terceros pueden ir dentro de la ruta.' },
      { q: '¿Puedo pasar del swap a perps o stocks?', a: 'Sí. Cuando los tokens lleguen a tu monedero, abre Trade (/es/futures), Stocks (/es/stocks) o Predictions (/es/predict) con la misma conexión.' },
    ],
  },
  futures: {
    h1: 'Spot y perpetual futures desde tu monedero',
    lead: 'El desk Trade permite comprar y vender mercados spot y perpetual futures firmando desde un wallet de autocustodia. Margen y posiciones viven en el venue de trading — no en una cuenta de depósito GROM.',
    appName: 'GROM Trade',
    appDesc: 'Terminal de spot y perpetual futures con firma desde el monedero.',
    sections: [
      {
        h2: 'Spot y perps en un terminal',
        html: `<p>Cambia entre modos spot y perpetual en la página Trade. Los tickets spot compran o venden el activo listado frente a la divisa de cotización. Los tickets perpetual abren exposición long o short con el apalancamiento que elijas dentro de los límites del venue.</p>
<p>Gráficos, saldos y órdenes abiertas se actualizan desde el venue tras conectar. Las listas de pares incluyen cripto principal y listados adicionales del venue — la disponibilidad puede cambiar.</p>`,
      },
      {
        h2: 'Flujo de monedero y funding',
        html: `<p>Conecta el monedero, fondea el venue cuando el producto lo exija, y coloca órdenes market o limit. Toda acción sensible pide firma o transacción. Cerrar o reducir una posición sigue el mismo patrón wallet-first.</p>
<p>Usa <a href="${p('es', '/swap')}">Swap</a> si necesitas activos en otra red antes. Mira precios en <a href="${p('es', '/markets')}">Markets</a>, o pasa a <a href="${p('es', '/predict')}">Predictions</a> y <a href="${p('es', '/stocks')}">Stocks</a> sin crear un login GROM aparte.</p>`,
      },
      {
        h2: 'Fees y riesgo apalancado',
        html: `<p>Los tickets muestran fees estimados antes de confirmar. Maker y taker dependen del venue y del tipo de orden. Pueden aparecer fees de builder o plataforma cuando estén configurados; si están en pausa, el ticket lo indica.</p>
<p>El apalancamiento amplifica ganancias y pérdidas. Las posiciones pueden liquidarse si el margen no basta. Los pagos de funding en perpetuos pueden abonar o cargar tu cuenta con el tiempo. No trates el trading de perpetuos como libre de riesgo ni apto para todos.</p>`,
      },
    ],
    faq: [
      { q: '¿Trade exige un depósito GROM?', a: 'No hay saldo custodial GROM. Conectas un monedero, fondeas el venue como indique el producto y firmas las órdenes tú mismo.' },
      { q: '¿Qué diferencia hay entre spot y perpetuos?', a: 'Spot intercambia el activo. Los perpetuos siguen un mercado con apalancamiento y funding, sin entregar el subyacente en cada trade.' },
      { q: '¿Puedo perder más de lo depositado?', a: 'La liquidación cierra posiciones cuando se agota el margen, pero gaps y fees aún pueden causar pérdidas. Conoce las reglas del venue antes de usar apalancamiento.' },
      { q: '¿Dónde veo precios antes de operar?', a: 'Abre Markets (/es/markets) o el gráfico de Trade del par seleccionado.' },
    ],
  },
  predict: {
    h1: 'Prediction markets financiados desde tu monedero',
    lead: 'GROM Predictions te deja tomar posiciones sobre resultados de eventos con fondos de tu wallet conectado. Los mercados cubren temas como cripto, deporte y política cuando están listados. La resolución sigue las reglas del mercado — no un pago discrecional de GROM.',
    appName: 'GROM Predictions',
    appDesc: 'Prediction markets no custodiales con funding desde el monedero y liquidación en el venue.',
    sections: [
      {
        h2: 'Cómo funcionan aquí los prediction markets',
        html: `<p>Explora eventos abiertos, lee la pregunta y las reglas, y compra o vende shares del outcome a los precios mostrados. Los precios reflejan probabilidades implícitas del mercado y pueden moverse. Cerrar antes de la resolución vende tus shares de vuelta al mercado.</p>
<p>Stake y claim usan firmas de monedero y la cadena del producto. No hay un “saldo de predicción” custodiado por GROM.</p>`,
      },
      {
        h2: 'Empezar y productos relacionados',
        html: `<p>Conecta un monedero, asegúrate de tener el colateral que pide el mercado, introduce el tamaño y confirma. Si necesitas bridge o swap del colateral antes, usa <a href="${p('es', '/swap')}">Instant Swap</a>. Precios macro en <a href="${p('es', '/markets')}">Markets</a>; exposición cripto apalancada en <a href="${p('es', '/futures')}">Trade</a>; tokens tipo equity en <a href="${p('es', '/stocks')}">Stocks</a>.</p>`,
      },
      {
        h2: 'Fees y riesgos',
        html: `<p>Los tickets revelan trading fees antes de confirmar. Spreads y liquidez varían — libros finos pueden resbalar. Si el evento resuelve en contra, puedes perder el stake. Retrasos de disputa o resolución son posibles.</p>
<p>Los prediction markets no son cash-out de casa de apuestas ni sirven para quien busca ingresos garantizados. Respeta las restricciones regionales que apliquen a contratos de eventos.</p>`,
      },
    ],
    faq: [
      { q: '¿Las ganancias de predicción se depositan en GROM?', a: 'No. Colateral y payouts liquidan a tu monedero a través del venue del mercado.' },
      { q: '¿Qué temas hay?', a: 'Los listados cambian. Puedes ver cripto, deporte, política y otras categorías cuando los mercados estén abiertos.' },
      { q: '¿Qué fees aplican?', a: 'Fees de trading del venue en el ticket, más gas de red en los pasos on-chain.' },
      { q: '¿Pueden resolverse lento?', a: 'Sí. La resolución depende de oráculos y reglas del mercado. Lee los términos de cada mercado antes de operar.' },
    ],
  },
  xstocks: {
    h1: 'Tokenized Stocks (RWA) desde tu monedero',
    lead: 'GROM Stocks ofrece exposición tokenizada a acciones — tokens cripto que siguen empresas cotizadas — para operar tamaños fraccionarios fuera del horario bursátil tradicional cuando el venue esté abierto. La liquidación va a tu monedero, no a una cuenta de bróker GROM.',
    appName: 'GROM Stocks',
    appDesc: 'Tokenized stocks y tokens RWA de equity operados desde el monedero.',
    sections: [
      {
        h2: 'Qué son los Tokenized Stocks',
        html: `<p>Los Tokenized Stocks son representaciones on-chain de exposición a equity. Pueden negociarse en tamaños menores que una acción entera y estar disponibles cuando los mercados tradicionales están cerrados, según horario y liquidez del venue. No son idénticos a acciones de bróker: custodia, acciones corporativas y regulación difieren.</p>
<p>Nombres populares de grandes tecnológicas pueden aparecer cuando emisor y venue los listen. Lee siempre las divulgaciones del token y del mercado en la UI.</p>`,
      },
      {
        h2: 'Cómo comprar y vender',
        html: `<p>Conecta un monedero, elige un Tokenized Stock, introduce el tamaño y confirma. Puede hacer falta el activo de cotización del venue (a menudo un stablecoin) en la red correcta — usa <a href="${p('es', '/swap')}">Swap</a> si debes hacer bridge antes. Supervisa posiciones en el desk Stocks y en la lista de tokens del monedero.</p>
<p>Combina con <a href="${p('es', '/futures')}">Trade</a> para spot y perps cripto, <a href="${p('es', '/predict')}">Predictions</a> para eventos y <a href="${p('es', '/markets')}">Markets</a> para descubrir precios.</p>`,
      },
      {
        h2: 'Fees y riesgos',
        html: `<p>Espera fees de trading del venue y gas de red. Los spreads pueden ampliarse fuera de horas pico. Las equities tokenizadas pueden despegarse del precio de referencia, pausar mint/redeem o enfrentar límites del emisor y de regulación.</p>
<p>Esto no es asesoramiento de inversión. Los Tokenized Stocks pueden perder valor y no estar disponibles en algunas jurisdicciones.</p>`,
      },
    ],
    faq: [
      { q: '¿Son certificados bursátiles tradicionales?', a: 'No. Son tokens cripto que siguen exposición a equity. Derechos y custodia difieren de una cuenta de bróker regulada.' },
      { q: '¿Puedo operar el fin de semana?', a: 'Los venues pueden permitir trading cripto 24/7 de los tokens, pero liquidez y precio pueden diferir del horario bursátil entre semana.' },
      { q: '¿Necesito KYC de bróker con GROM?', a: 'GROM no te abre cuenta de bróker. El acceso por wallet es no custodial; emisores u on-ramps pueden imponer sus propias reglas.' },
      { q: '¿Cómo fondeo una compra?', a: 'Ten el activo de cotización requerido en tu monedero en la red soportada y confirma el trade. Usa Swap si necesitas bridge o conversión primero.' },
    ],
  },
  markets: {
    h1: 'Markets y precios en vivo en GROM',
    lead: 'Markets es la capa de descubrimiento de GROM: precios en vivo, movers y atajos a Swap, Trade, Predictions y Stocks. No custodia fondos — te ayuda a elegir un mercado y saltar al desk correspondiente.',
    appName: 'GROM Markets',
    appDesc: 'Descubrimiento de mercados cripto y relacionados para el terminal DeFi GROM.',
    sections: [
      {
        h2: 'Qué ves en Markets',
        html: `<p>Explora pares y activos listados con contexto de precio reciente. Abre una fila para continuar en el producto que puede operarlo — por ejemplo Instant Swap para tokens cross-chain, Trade para spot y perpetuos, o Stocks para equities tokenizadas cuando estén disponibles.</p>
<p>Las cifras se actualizan desde fuentes públicas de mercado. Puede haber huecos o retrasos breves; confirma siempre el ticket en vivo antes de firmar.</p>`,
      },
      {
        h2: 'Del precio al trade',
        html: `<p>Usa Markets para comparar nombres con rapidez y navega con enlaces normales: <a href="${p('es', '/swap')}">Swap</a>, <a href="${p('es', '/futures')}">Trade</a>, <a href="${p('es', '/predict')}">Predictions</a>, <a href="${p('es', '/stocks')}">Stocks</a> e <a href="${p('es', '/')}">Inicio</a>. La misma conexión de monedero se mantiene entre productos.</p>`,
      },
      {
        h2: 'Precisión y notas de riesgo',
        html: `<p>GROM no reivindica datos exclusivos ni uptime garantizado de cada feed. Gráficos y tablas son informativos. Las decisiones de trading son tuyas; fees y riesgos se revelan en el ticket de cada producto.</p>`,
      },
    ],
    faq: [
      { q: '¿Markets ejecuta trades?', a: 'Markets es para descubrimiento. La ejecución ocurre en Swap, Trade, Predictions o Stocks tras confirmar en tu monedero.' },
      { q: '¿Los precios son en tiempo real?', a: 'Buscan ser casi en tiempo real desde feeds conectados, pero pueden retrasarse. Verifica en el ticket de orden.' },
      { q: '¿Qué productos puedo abrir desde aquí?', a: 'Según el activo: Swap, Trade spot/perps, Predictions o Tokenized Stocks.' },
      { q: '¿Los datos de mercado son custodiales?', a: 'No. Ver precios no mueve fondos. Solo las firmas del monedero mueven activos.' },
    ],
  },
};

const PT = {
  landing: {
    h1: 'GROM Exchange — terminal DeFi não custodial',
    lead: 'A GROM é um hub cripto centrado na carteira. Você conecta uma wallet de autocustódia, mantém as chaves e assina cada operação. Não há conta de depósito no exchange nem KYC da GROM para o trading básico com wallet.',
    appName: 'GROM Exchange',
    appDesc: 'Terminal DeFi não custodial para swaps cross-chain, spot e perpetual futures, prediction markets e tokenized stocks.',
    sections: [
      {
        h2: 'Quatro linhas de produto, uma carteira',
        html: `<p>A GROM reúne quatro mercados numa interface: <a href="${p('pt-BR', '/swap')}">swaps cross-chain e roteamento estilo spot</a>, <a href="${p('pt-BR', '/futures')}">perpetual futures e trading spot</a>, <a href="${p('pt-BR', '/predict')}">prediction markets</a> e <a href="${p('pt-BR', '/stocks')}">Tokenized Stocks (RWA)</a>. Preços e descoberta ficam em <a href="${p('pt-BR', '/markets')}">Markets</a>.</p>
<p>Cada produto liquida para endereços que você controla. Cotações e fills vêm de venues e agregadores on-chain; a GROM não custodia seus saldos.</p>`,
      },
      {
        h2: 'Como o trading funciona',
        html: `<p>Conecte uma carteira Web3 (extensão ou WalletConnect). Escolha um produto, revise a cotação ou o ticket e confirme a assinatura ou transação na wallet. Os ativos se movem na rede ou venue de destino — não para um saldo GROM do qual você precise sacar depois.</p>
<p>As redes disponíveis para Swap incluem as principais EVM e outros ecossistemas exibidos pela camada de roteamento. Futuros, predições e Tokenized Stocks usam as redes que cada produto exige. Sempre confira rede e ativo no prompt da carteira antes de assinar.</p>`,
      },
      {
        h2: 'Taxas e riscos',
        html: `<p>Os swaps mostram fees de roteamento na cotação mais o gas da rede. Perpetuals, Predictions e Tokenized Stocks cobram fees do venue revelados no ticket antes de confirmar. A GROM não promete retorno, volume nem profundidade de liquidez.</p>
<p>Negociar envolve risco de perda. Perpétuos alavancados podem ser liquidados. Apostas de predição podem zerar. Tokenized Stocks são wrappers cripto de exposição a ações — não ações de corretora tradicional — e podem diferir em liquidação, horário e regulação. Use só fundos que você pode perder.</p>`,
      },
    ],
    faq: [
      { q: 'O que é a GROM Exchange?', a: 'A GROM é um terminal DeFi não custodial. Você opera da própria carteira em Swap, perpétuos, prediction markets e Tokenized Stocks sem depositar numa conta custodial do exchange.' },
      { q: 'Preciso criar conta ou passar por KYC?', a: 'O trading básico com wallet não exige conta de e-mail nem KYC da GROM. On-ramps fiat e algumas regiões podem aplicar as próprias checagens. Sempre cumpra a lei local.' },
      { q: 'Onde ficam meus fundos?', a: 'Na sua carteira e nos venues em que você opera. O software da GROM ajuda a rotear e assinar; não retém depósitos de usuários.' },
      { q: 'Quais produtos posso abrir pela home?', a: 'Swap (/pt-BR/swap), Trade para spot e perpétuos (/pt-BR/futures), Predictions (/pt-BR/predict), Stocks (/pt-BR/stocks) e Markets (/pt-BR/markets).' },
    ],
  },
  dashboard: {
    h1: 'Swap cripto cross-chain pela sua carteira',
    lead: 'Troque tokens entre várias redes sem criar um saldo GROM. O Instant Swap consulta vários roteadores, mostra uma cotação e pede que sua wallet assine. A liquidação é on-chain no seu endereço.',
    appName: 'GROM Instant Swap',
    appDesc: 'Agregador de swap cripto cross-chain não custodial com assinaturas de wallet e liquidação on-chain.',
    sections: [
      {
        h2: 'O que o Instant Swap faz',
        html: `<p>Escolha token e rede de origem, token e rede de destino, e um valor. A GROM pede cotações a vários agregadores e bridges em paralelo e apresenta uma rota que você pode aceitar ou recusar. Você nunca envia o principal do swap para um hot wallet da GROM.</p>
<p>A cobertura inclui milhares de tokens em mais de vinte redes quando há liquidez e bridges. A disponibilidade exata depende dos roteadores no momento da cotação — pares ilíquidos podem não ter rota.</p>`,
      },
      {
        h2: 'Redes, carteiras e assinaturas',
        html: `<p>Use uma carteira de autocustódia capaz de assinar transações EVM (e outros ecossistemas que o desk suporte). Depois de confirmar, a wallet pode pedir aprovação de spend e depois enviar o swap ou bridge. Rotas cross-chain podem demorar mais que um swap na mesma rede; acompanhe o status no desk e na atividade da carteira.</p>
<p>Produtos relacionados a um clique: <a href="${p('pt-BR', '/futures')}">Trade</a> para spot e perpétuos, <a href="${p('pt-BR', '/markets')}">Markets</a> para preços, <a href="${p('pt-BR', '/predict')}">Predictions</a> e <a href="${p('pt-BR', '/stocks')}">Tokenized Stocks</a>.</p>`,
      },
      {
        h2: 'Fees, slippage e riscos',
        html: `<p>Cada cotação lista saída estimada, fee de rota e gas de rede. O slippage controla quanto movimento de preço você aceita. Bridges e DEXs podem falhar, atrasar ou devolver menos do que o estimado em mercados voláteis.</p>
<p>Sempre confira contratos, redes e valores no prompt da carteira. A GROM não inventa preços garantidos nem bridges sem risco.</p>`,
      },
    ],
    faq: [
      { q: 'O Instant Swap é custodial?', a: 'Não. Você assina na carteira e a liquidação vai para o seu endereço. A GROM não custodia o principal do swap.' },
      { q: 'Por que não há rota?', a: 'Agregadores podem faltar liquidez, pausar um bridge ou rejeitar o par ou o tamanho. Tente outro token, rede ou valor.' },
      { q: 'Quais fees eu pago?', a: 'Fees de roteamento mostrados na cotação mais gas na rede de origem (e às vezes destino). Fees de bridge de terceiros podem entrar na rota.' },
      { q: 'Posso ir do swap para perps ou stocks?', a: 'Sim. Quando os tokens chegarem na carteira, abra Trade (/pt-BR/futures), Stocks (/pt-BR/stocks) ou Predictions (/pt-BR/predict) com a mesma conexão.' },
    ],
  },
  futures: {
    h1: 'Spot e perpetual futures pela sua carteira',
    lead: 'O desk Trade permite comprar e vender mercados spot e perpetual futures assinando a partir de uma wallet de autocustódia. Margem e posições ficam no venue de trading — não numa conta de depósito GROM.',
    appName: 'GROM Trade',
    appDesc: 'Terminal de spot e perpetual futures com assinatura pela carteira.',
    sections: [
      {
        h2: 'Spot e perps num terminal',
        html: `<p>Alterne entre modos spot e perpetual na página Trade. Tickets spot compram ou vendem o ativo listado contra a moeda de cotação. Tickets perpetual abrem exposição long ou short com a alavancagem que você escolher dentro dos limites do venue.</p>
<p>Gráficos, saldos e ordens abertas atualizam a partir do venue após conectar. Listas de pares incluem cripto principal e listagens adicionais do venue — a disponibilidade pode mudar.</p>`,
      },
      {
        h2: 'Fluxo da carteira e funding',
        html: `<p>Conecte a carteira, fondeie o venue quando o produto exigir e envie ordens market ou limit. Toda ação sensível pede assinatura ou transação. Fechar ou reduzir posição segue o mesmo padrão wallet-first.</p>
<p>Use <a href="${p('pt-BR', '/swap')}">Swap</a> se precisar de ativos em outra rede antes. Veja preços em <a href="${p('pt-BR', '/markets')}">Markets</a>, ou vá a <a href="${p('pt-BR', '/predict')}">Predictions</a> e <a href="${p('pt-BR', '/stocks')}">Stocks</a> sem criar um login GROM separado.</p>`,
      },
      {
        h2: 'Fees e risco alavancado',
        html: `<p>Os tickets mostram fees estimados antes de confirmar. Maker e taker dependem do venue e do tipo de ordem. Fees de builder ou plataforma podem aparecer quando configurados; se estiverem pausados, o ticket deixa claro.</p>
<p>Alavancagem amplifica ganhos e perdas. Posições podem ser liquidadas quando a margem é insuficiente. Pagamentos de funding em perpétuos podem creditar ou debitar sua conta ao longo do tempo. Não trate trading de perpétuos como sem risco nem adequado a todos.</p>`,
      },
    ],
    faq: [
      { q: 'O Trade exige depósito GROM?', a: 'Não há saldo custodial GROM. Você conecta uma carteira, fondeia o venue como o produto indicar e assina as ordens você mesmo.' },
      { q: 'Qual a diferença entre spot e perpétuos?', a: 'Spot troca o ativo. Perpétuos acompanham um mercado com alavancagem e funding, sem entregar o subjacente a cada trade.' },
      { q: 'Posso perder mais do que depositei?', a: 'A liquidação fecha posições quando a margem acaba, mas gaps e fees ainda podem causar perdas. Entenda as regras do venue antes de usar alavancagem.' },
      { q: 'Onde vejo preços antes de operar?', a: 'Abra Markets (/pt-BR/markets) ou o gráfico do Trade do par selecionado.' },
    ],
  },
  predict: {
    h1: 'Prediction markets financiados pela sua carteira',
    lead: 'GROM Predictions permite posições em resultados de eventos com fundos da wallet conectada. Mercados cobrem temas como cripto, esportes e política quando listados. A resolução segue as regras do mercado — não um pagamento discricionário da GROM.',
    appName: 'GROM Predictions',
    appDesc: 'Prediction markets não custodiais com funding pela carteira e liquidação no venue.',
    sections: [
      {
        h2: 'Como prediction markets funcionam aqui',
        html: `<p>Navegue eventos abertos, leia a pergunta e as regras, e compre ou venda shares do outcome aos preços exibidos. Os preços refletem probabilidades implícitas do mercado e podem mudar. Fechar antes da resolução vende suas shares de volta ao mercado.</p>
<p>Stake e claim usam assinaturas da carteira e a chain do produto. Não há um “saldo de predição” custodiado pela GROM.</p>`,
      },
      {
        h2: 'Começar e produtos relacionados',
        html: `<p>Conecte uma carteira, garanta o colateral que o mercado pede, informe o tamanho e confirme. Se precisar de bridge ou swap do colateral antes, use <a href="${p('pt-BR', '/swap')}">Instant Swap</a>. Preços macro em <a href="${p('pt-BR', '/markets')}">Markets</a>; exposição cripto alavancada em <a href="${p('pt-BR', '/futures')}">Trade</a>; tokens estilo equity em <a href="${p('pt-BR', '/stocks')}">Stocks</a>.</p>`,
      },
      {
        h2: 'Fees e riscos',
        html: `<p>Os tickets revelam trading fees antes de confirmar. Spreads e liquidez variam — livros finos podem escorregar. Se o evento resolver contra você, pode perder o stake. Atrasos de disputa ou resolução são possíveis.</p>
<p>Prediction markets não são cash-out de casa de apostas e não servem para quem busca renda garantida. Respeite restrições regionais aplicáveis a contratos de eventos.</p>`,
      },
    ],
    faq: [
      { q: 'Ganhos de predição vão para a GROM?', a: 'Não. Colateral e payouts liquidam na sua carteira pelo venue do mercado.' },
      { q: 'Quais temas existem?', a: 'As listagens mudam. Você pode ver cripto, esportes, política e outras categorias quando os mercados estiverem abertos.' },
      { q: 'Quais fees se aplicam?', a: 'Fees de trading do venue no ticket, mais gas de rede nos passos on-chain.' },
      { q: 'Mercados podem resolver devagar?', a: 'Sim. A resolução depende de oráculos e regras do mercado. Leia os termos de cada mercado antes de operar.' },
    ],
  },
  xstocks: {
    h1: 'Tokenized Stocks (RWA) pela sua carteira',
    lead: 'GROM Stocks oferece exposição tokenizada a ações — tokens cripto que acompanham empresas listadas — para negociar tamanhos fracionários fora do horário da bolsa tradicional quando o venue estiver aberto. A liquidação vai para a sua carteira, não para uma conta de corretora GROM.',
    appName: 'GROM Stocks',
    appDesc: 'Tokenized stocks e tokens RWA de equity negociados pela carteira.',
    sections: [
      {
        h2: 'O que são Tokenized Stocks',
        html: `<p>Tokenized Stocks são representações on-chain de exposição a equity. Podem negociar em tamanhos menores que uma ação inteira e ficar disponíveis quando os mercados tradicionais estão fechados, conforme horário e liquidez do venue. Não são idênticos a ações de corretora: custódia, eventos corporativos e regulação diferem.</p>
<p>Nomes populares de grandes techs podem aparecer quando emissor e venue os listarem. Sempre leia as divulgações do token e do mercado na UI.</p>`,
      },
      {
        h2: 'Como comprar e vender',
        html: `<p>Conecte uma carteira, escolha um Tokenized Stock, informe o tamanho e confirme. Pode ser necessário o ativo de cotação do venue (muitas vezes um stablecoin) na rede correta — use <a href="${p('pt-BR', '/swap')}">Swap</a> se precisar de bridge antes. Monitore posições no desk Stocks e na lista de tokens da carteira.</p>
<p>Combine com <a href="${p('pt-BR', '/futures')}">Trade</a> para spot e perps cripto, <a href="${p('pt-BR', '/predict')}">Predictions</a> para eventos e <a href="${p('pt-BR', '/markets')}">Markets</a> para descobrir preços.</p>`,
      },
      {
        h2: 'Fees e riscos',
        html: `<p>Espere fees de trading do venue e gas de rede. Spreads podem alargar fora do pico. Equities tokenizadas podem se descolar do preço de referência, pausar mint/redeem ou enfrentar limites do emissor e da regulação.</p>
<p>Isto não é aconselhamento de investimento. Tokenized Stocks podem perder valor e estar indisponíveis em algumas jurisdições.</p>`,
      },
    ],
    faq: [
      { q: 'São certificados de ações tradicionais?', a: 'Não. São tokens cripto que acompanham exposição a equity. Direitos e custódia diferem de uma conta de corretora regulada.' },
      { q: 'Posso negociar no fim de semana?', a: 'Venues podem permitir trading cripto 24/7 dos tokens, mas liquidez e preço podem diferir do horário da bolsa em dias úteis.' },
      { q: 'Preciso de KYC de corretora com a GROM?', a: 'A GROM não abre conta de corretora para você. O acesso por wallet é não custodial; emissores ou on-ramps podem impor as próprias regras.' },
      { q: 'Como financio uma compra?', a: 'Tenha o ativo de cotação necessário na carteira na rede suportada e confirme o trade. Use Swap se precisar de bridge ou conversão antes.' },
    ],
  },
  markets: {
    h1: 'Markets e preços ao vivo na GROM',
    lead: 'Markets é a camada de descoberta da GROM: preços ao vivo, movers e atalhos para Swap, Trade, Predictions e Stocks. Não custodia fundos — ajuda você a escolher um mercado e ir ao desk correspondente.',
    appName: 'GROM Markets',
    appDesc: 'Descoberta de mercados cripto e relacionados para o terminal DeFi GROM.',
    sections: [
      {
        h2: 'O que você vê em Markets',
        html: `<p>Navegue pares e ativos listados com contexto de preço recente. Abra uma linha para continuar no produto que pode negociá-lo — por exemplo Instant Swap para tokens cross-chain, Trade para spot e perpétuos, ou Stocks para equities tokenizadas quando disponíveis.</p>
<p>Os números atualizam a partir de fontes públicas de mercado. Podem ocorrer lacunas ou atrasos breves; sempre confirme o ticket ao vivo antes de assinar.</p>`,
      },
      {
        h2: 'Do preço ao trade',
        html: `<p>Use Markets para comparar nomes depressa e navegue com links normais: <a href="${p('pt-BR', '/swap')}">Swap</a>, <a href="${p('pt-BR', '/futures')}">Trade</a>, <a href="${p('pt-BR', '/predict')}">Predictions</a>, <a href="${p('pt-BR', '/stocks')}">Stocks</a> e <a href="${p('pt-BR', '/')}">Início</a>. A mesma conexão de carteira vale entre produtos.</p>`,
      },
      {
        h2: 'Precisão e notas de risco',
        html: `<p>A GROM não reivindica dados exclusivos nem uptime garantido de cada feed. Gráficos e tabelas são informativos. Decisões de trading são suas; fees e riscos são revelados no ticket de cada produto.</p>`,
      },
    ],
    faq: [
      { q: 'Markets executa trades?', a: 'Markets é para descoberta. A execução acontece em Swap, Trade, Predictions ou Stocks depois que você confirma na carteira.' },
      { q: 'Os preços são em tempo real?', a: 'Visam ser quase em tempo real a partir dos feeds conectados, mas podem atrasar. Verifique no ticket de ordem.' },
      { q: 'Quais produtos posso abrir daqui?', a: 'Conforme o ativo: Swap, Trade spot/perps, Predictions ou Tokenized Stocks.' },
      { q: 'Dados de mercado são custodiais?', a: 'Não. Ver preços não move fundos. Só assinaturas da carteira movem ativos.' },
    ],
  },
};

export const SEO_COPY_BY_LOCALE = {
  es: ES,
  'pt-BR': PT,
  tr: SEO_COPY_TR,
  ru: SEO_COPY_RU,
  vi: SEO_COPY_VI,
  id: SEO_COPY_ID,
};

export function getSeoCopy(localeCode, routeKey) {
  if (!localeCode || localeCode === 'en') return null;
  const pack = SEO_COPY_BY_LOCALE[localeCode];
  return (pack && pack[routeKey]) || null;
}

export function getSeoMeta(localeCode, routeKey) {
  const pack = SEO_META_BY_LOCALE[localeCode] || SEO_META_BY_LOCALE.en;
  return pack[routeKey] || SEO_META_BY_LOCALE.en[routeKey] || { title: 'GROM Exchange', description: '' };
}
