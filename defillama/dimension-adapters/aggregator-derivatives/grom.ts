/**
 * DefiLlama aggregator-derivatives stub — GROM perps (Hyperliquid builder).
 *
 * DO NOT submit until a GROM-attributed HL builder fill indexer exists.
 * Returning verified zeros without an indexer would falsely imply "no trades".
 *
 * Intended path when ready:
 *   GET https://grom.exchange/api/public/dimensions?product=perps&...
 * Today that endpoint returns HTTP 503 NO_DATA.
 *
 * Classification (aggregator-derivatives vs derivatives) is subject to
 * DefiLlama maintainer review.
 */
import { FetchOptions, SimpleAdapter } from "../adapters/types";
import { CHAIN } from "../helpers/chains";

const START = "2026-08-22";

const fetch = async (_options: FetchOptions) => {
  throw new Error(
    "grom aggregator-derivatives: GROM-attributed Hyperliquid builder fills are not indexed yet. " +
      "Refusing silent zero. Contact support.grom@gmail.com / see GROM METHODOLOGY.md."
  );
};

const adapter: SimpleAdapter = {
  version: 2,
  adapter: {
    [CHAIN.HYPERLIQUID]: {
      fetch,
      start: START,
    },
  },
  methodology: {
    Volume:
      "NOT LIVE. When enabled: only GROM builder-fee attributed Hyperliquid taker fills. Never HL global volume.",
  },
};

export default adapter;
