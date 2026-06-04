/**
 * rates.js
 * ES module providing fetchAndCacheRates() and getCachedRates().
 *
 * All approximate rates are mid-2025 estimates relative to 1 USD.
 * They are used ONLY as a last-resort fallback when the network is
 * unavailable and no cached rates exist.
 */

/* ─── Fallback rates (approximate, mid-2025) ──────────────────────── */
const FALLBACK_RATES = {
  SAR:  3.7500,   // Saudi Riyal (pegged to USD)
  AED:  3.6725,   // UAE Dirham  (pegged to USD)
  EUR:  0.9200,   // Euro
  GBP:  0.7900,   // British Pound
  JPY: 149.50,    // Japanese Yen
  CNY:  7.2500,   // Chinese Yuan
  KRW: 1320.00,   // South Korean Won
  INR: 83.50,     // Indian Rupee
  TRY: 32.00,     // Turkish Lira
  CAD:  1.3600,   // Canadian Dollar
  AUD:  1.5300,   // Australian Dollar
  CHF:  0.8950,   // Swiss Franc
  SEK: 10.50,     // Swedish Krona
  NOK: 10.60,     // Norwegian Krone
  DKK:  6.8800,   // Danish Krone
  PLN:  4.0200,   // Polish Zloty
  CZK: 23.00,     // Czech Koruna
  HUF: 360.00,    // Hungarian Forint
  MXN: 17.20,     // Mexican Peso
  BRL:  5.0500,   // Brazilian Real
  SGD:  1.3500,   // Singapore Dollar
  HKD:  7.8200,   // Hong Kong Dollar
  MYR:  4.7000,   // Malaysian Ringgit
  THB: 35.50,     // Thai Baht
  IDR: 15800.00,  // Indonesian Rupiah
  PHP: 56.50,     // Philippine Peso
  EGP: 30.90,     // Egyptian Pound
  PKR: 278.00,    // Pakistani Rupee
  BDT: 110.00,    // Bangladeshi Taka
  NGN: 1400.00    // Nigerian Naira
};

const RATES_API_URL = 'https://open.er-api.com/v6/latest/USD';
const CACHE_KEY     = 'rp_rates_cache';
const CACHE_TTL_MS  = 6 * 60 * 60 * 1000; // 6 hours

/**
 * Returns cached rates object { rates, fetchedAt } or null.
 */
export async function getCachedRates() {
  return new Promise((resolve) => {
    chrome.storage.local.get([CACHE_KEY], (result) => {
      if (chrome.runtime.lastError || !result[CACHE_KEY]) {
        resolve(null);
      } else {
        resolve(result[CACHE_KEY]);
      }
    });
  });
}

/**
 * Stores rates in chrome.storage.local and notifies content scripts.
 */
async function storeRates(rates) {
  const payload = {
    rates:     rates,
    fetchedAt: new Date().toISOString()
  };
  return new Promise((resolve) => {
    chrome.storage.local.set({ [CACHE_KEY]: payload }, () => {
      chrome.runtime.sendMessage({ action: 'ratesUpdated' }).catch(() => {});
      resolve(payload);
    });
  });
}

/**
 * Attempts to fetch fresh rates from the API.
 * Returns the rates object on success, null on failure.
 */
async function fetchRatesFromAPI() {
  try {
    const response = await fetch(RATES_API_URL, { cache: 'no-store' });
    if (!response.ok) {
      console.warn('[RiyalPrice] Rate API returned', response.status);
      return null;
    }
    const data = await response.json();
    if (data && data.result === 'success' && data.rates) {
      const needed = [
        'SAR','AED','EUR','GBP','JPY','CNY','KRW','INR','TRY',
        'CAD','AUD','CHF','SEK','NOK','DKK','PLN','CZK','HUF',
        'MXN','BRL','SGD','HKD','MYR','THB','IDR','PHP','EGP',
        'PKR','BDT','NGN'
      ];
      const filtered = {};
      for (const code of needed) {
        if (data.rates[code] !== undefined) {
          filtered[code] = data.rates[code];
        } else {
          filtered[code] = FALLBACK_RATES[code];
        }
      }
      filtered['USD'] = 1;
      return filtered;
    }
    return null;
  } catch (err) {
    console.warn('[RiyalPrice] Fetch error:', err.message);
    return null;
  }
}

/**
 * Main entry point.
 * Checks cache age; fetches if stale or missing; falls back to FALLBACK_RATES.
 * @param {boolean} force - If true, bypass TTL check and always fetch.
 * @returns {{ rates, fetchedAt, source: 'api'|'cache'|'fallback' }}
 */
export async function fetchAndCacheRates(force = false) {
  const cached = await getCachedRates();

  if (!force && cached) {
    const age = Date.now() - new Date(cached.fetchedAt).getTime();
    if (age < CACHE_TTL_MS) {
      return { ...cached, source: 'cache' };
    }
  }

  const freshRates = await fetchRatesFromAPI();

  if (freshRates) {
    const stored = await storeRates(freshRates);
    return { ...stored, source: 'api' };
  }

  if (cached) {
    console.warn('[RiyalPrice] Using stale cache after fetch failure.');
    return { ...cached, source: 'cache' };
  }

  console.warn('[RiyalPrice] Using hardcoded fallback rates.');
  const fallbackPayload = {
    rates:     { ...FALLBACK_RATES, USD: 1 },
    fetchedAt: null
  };
  return { ...fallbackPayload, source: 'fallback' };
}
