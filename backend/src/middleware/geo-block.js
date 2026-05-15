import config from '../config/index.js';
import logger from '../utils/logger.js';

let geoReaderPromise = null;

async function getReader() {
  if (!config.geo.maxmindDbPath) return null;
  if (!geoReaderPromise) {
    geoReaderPromise = import('@maxmind/geoip2-node')
      .then((mod) => mod.Reader.open(config.geo.maxmindDbPath))
      .catch((err) => {
        logger.warn({ err: err.message }, 'maxmind reader disabled');
        return null;
      });
  }
  return geoReaderPromise;
}

function headerCountry(req) {
  return String(req.headers['cf-ipcountry'] || req.headers['x-country-code'] || '').toUpperCase();
}

export function geoBlockMiddleware() {
  const blocked = new Set(config.geoblock.map((code) => String(code).toUpperCase()));
  return async (req, res, next) => {
    if (!blocked.size) return next();
    let country = headerCountry(req);
    if (!country) {
      const reader = await getReader();
      if (reader) {
        try {
          country = reader.country(req.ip)?.country?.isoCode?.toUpperCase() || '';
        } catch {
          country = '';
        }
      }
    }
    if (country && blocked.has(country)) {
      return res.status(451).json({ error: 'unavailable_for_legal_reasons', country });
    }
    return next();
  };
}

export default geoBlockMiddleware;
