/**
 * detector.js
 * Defines CURRENCY_PATTERNS and DUTY_RATES.
 * Loaded as a content script before content.js.
 * Exposes globals: window.CURRENCY_PATTERNS, window.DUTY_RATES
 */

(function () {
  'use strict';

  const CP = {};

  // ── USD ──────────────────────────────────────────────────────────────
  CP['USD'] = {
    symbols:      ['$'],
    code:         'USD',
    regex:        /(?<![A-Z])(?<!\d)\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     10
  };

  // ── EUR ──────────────────────────────────────────────────────────────
  CP['EUR'] = {
    symbols:      ['€'],
    code:         'EUR',
    regex:        /€\s?(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)|(\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?€/g,
    decimalSep:   ',',
    thousandsSep: '.',
    symbolAfter:  false,
    priority:     10
  };

  // ── GBP ──────────────────────────────────────────────────────────────
  CP['GBP'] = {
    symbols:      ['£'],
    code:         'GBP',
    regex:        /£\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     10
  };

  // ── JPY ──────────────────────────────────────────────────────────────
  CP['JPY'] = {
    symbols:      ['¥', '￥'],
    code:         'JPY',
    regex:        /(?<![A-Z])¥\s?(\d{1,3}(?:[,，]\d{3})*|\d+)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     20
  };

  // ── CNY ──────────────────────────────────────────────────────────────
  CP['CNY'] = {
    symbols:      ['CN¥', 'RMB', '元'],
    code:         'CNY',
    regex:        /CN¥\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     15
  };

  // ── KRW ──────────────────────────────────────────────────────────────
  CP['KRW'] = {
    symbols:      ['₩'],
    code:         'KRW',
    regex:        /₩\s?(\d{1,3}(?:,\d{3})*|\d+)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     10
  };

  // ── INR ──────────────────────────────────────────────────────────────
  CP['INR'] = {
    symbols:      ['₹'],
    code:         'INR',
    regex:        /₹\s?(\d{1,2}(?:,\d{2})*(?:,\d{3})?(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     10
  };

  // ── TRY ──────────────────────────────────────────────────────────────
  CP['TRY'] = {
    symbols:      ['₺'],
    code:         'TRY',
    regex:        /₺\s?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)|(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s?₺/g,
    decimalSep:   ',',
    thousandsSep: '.',
    symbolAfter:  false,
    priority:     10
  };

  // ── CAD ──────────────────────────────────────────────────────────────
  CP['CAD'] = {
    symbols:      ['CA$', 'C$'],
    code:         'CAD',
    regex:        /C(?:A)?\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     5
  };

  // ── AUD ──────────────────────────────────────────────────────────────
  CP['AUD'] = {
    symbols:      ['A$', 'AU$'],
    code:         'AUD',
    regex:        /A(?:U)?\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     5
  };

  // ── CHF ──────────────────────────────────────────────────────────────
  CP['CHF'] = {
    symbols:      ['CHF', 'Fr.', 'Fr'],
    code:         'CHF',
    regex:        /(?:CHF|Fr\.?)\s?(\d{1,3}(?:[.']\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: "'",
    symbolAfter:  false,
    priority:     10
  };

  // ── SEK ──────────────────────────────────────────────────────────────
  CP['SEK'] = {
    symbols:      ['SEK', 'kr'],
    code:         'SEK',
    regex:        /(\d{1,3}(?:[\s.]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?(?:SEK|kr)(?=\b)/g,
    decimalSep:   ',',
    thousandsSep: ' ',
    symbolAfter:  true,
    priority:     30
  };

  // ── NOK ──────────────────────────────────────────────────────────────
  CP['NOK'] = {
    symbols:      ['NOK', 'kr'],
    code:         'NOK',
    regex:        /(\d{1,3}(?:[\s.]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?NOK(?=\b)/g,
    decimalSep:   ',',
    thousandsSep: ' ',
    symbolAfter:  true,
    priority:     25
  };

  // ── DKK ──────────────────────────────────────────────────────────────
  CP['DKK'] = {
    symbols:      ['DKK', 'kr.'],
    code:         'DKK',
    regex:        /(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s?(?:DKK|kr\.)(?=\b)/g,
    decimalSep:   ',',
    thousandsSep: '.',
    symbolAfter:  true,
    priority:     25
  };

  // ── PLN ──────────────────────────────────────────────────────────────
  CP['PLN'] = {
    symbols:      ['zł', 'PLN'],
    code:         'PLN',
    regex:        /(\d{1,3}(?:[,\s]\d{3})*(?:[,.]\d{1,2})?|\d+(?:[,.]\d{1,2})?)\s?(?:zł|PLN)(?=\b)/g,
    decimalSep:   ',',
    thousandsSep: ' ',
    symbolAfter:  true,
    priority:     20
  };

  // ── CZK ──────────────────────────────────────────────────────────────
  CP['CZK'] = {
    symbols:      ['Kč'],
    code:         'CZK',
    regex:        /(\d{1,3}(?:[\s.]\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s?Kč/g,
    decimalSep:   ',',
    thousandsSep: ' ',
    symbolAfter:  true,
    priority:     10
  };

  // ── HUF ──────────────────────────────────────────────────────────────
  CP['HUF'] = {
    symbols:      ['Ft'],
    code:         'HUF',
    regex:        /(\d{1,3}(?:[\s.]\d{3})*|\d+)\s?Ft(?=\b)/g,
    decimalSep:   ',',
    thousandsSep: ' ',
    symbolAfter:  true,
    priority:     10
  };

  // ── MXN ──────────────────────────────────────────────────────────────
  CP['MXN'] = {
    symbols:      ['MX$', 'MXN'],
    code:         'MXN',
    regex:        /(?:MX\$|MXN)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     5
  };

  // ── BRL ──────────────────────────────────────────────────────────────
  CP['BRL'] = {
    symbols:      ['R$'],
    code:         'BRL',
    regex:        /R\$\s?(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/g,
    decimalSep:   ',',
    thousandsSep: '.',
    symbolAfter:  false,
    priority:     10
  };

  // ── SGD ──────────────────────────────────────────────────────────────
  CP['SGD'] = {
    symbols:      ['S$', 'SGD'],
    code:         'SGD',
    regex:        /S\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     5
  };

  // ── HKD ──────────────────────────────────────────────────────────────
  CP['HKD'] = {
    symbols:      ['HK$'],
    code:         'HKD',
    regex:        /HK\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     5
  };

  // ── MYR ──────────────────────────────────────────────────────────────
  CP['MYR'] = {
    symbols:      ['RM'],
    code:         'MYR',
    regex:        /RM\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     10
  };

  // ── THB ──────────────────────────────────────────────────────────────
  CP['THB'] = {
    symbols:      ['฿'],
    code:         'THB',
    regex:        /฿\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     10
  };

  // ── IDR ──────────────────────────────────────────────────────────────
  CP['IDR'] = {
    symbols:      ['Rp'],
    code:         'IDR',
    regex:        /Rp\.?\s?(\d{1,3}(?:[.,]\d{3})*|\d+)/g,
    decimalSep:   ',',
    thousandsSep: '.',
    symbolAfter:  false,
    priority:     10
  };

  // ── PHP ──────────────────────────────────────────────────────────────
  CP['PHP'] = {
    symbols:      ['₱'],
    code:         'PHP',
    regex:        /₱\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     10
  };

  // ── EGP ──────────────────────────────────────────────────────────────
  CP['EGP'] = {
    symbols:      ['E£', 'ج.م'],
    code:         'EGP',
    regex:        /E£\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     10
  };

  // ── PKR ──────────────────────────────────────────────────────────────
  CP['PKR'] = {
    symbols:      ['₨', 'PKR', 'Rs'],
    code:         'PKR',
    regex:        /(?:PKR|Rs\.?|₨)\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     20
  };

  // ── BDT ──────────────────────────────────────────────────────────────
  CP['BDT'] = {
    symbols:      ['৳', 'BDT'],
    code:         'BDT',
    regex:        /৳\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     10
  };

  // ── NGN ──────────────────────────────────────────────────────────────
  CP['NGN'] = {
    symbols:      ['₦'],
    code:         'NGN',
    regex:        /₦\s?(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g,
    decimalSep:   '.',
    thousandsSep: ',',
    symbolAfter:  false,
    priority:     10
  };

  window.CURRENCY_PATTERNS = CP;

  /* ─── Duty rates ────────────────────────────────────────────────── */
  window.DUTY_RATES = {
    electronics:  { rate: 0.05, label_key: 'categoryElectronics' },
    clothing:     { rate: 0.05, label_key: 'categoryClothing'    },
    footwear:     { rate: 0.05, label_key: 'categoryFootwear'    },
    furniture:    { rate: 0.05, label_key: 'categoryFurniture'   },
    toys:         { rate: 0.05, label_key: 'categoryToys'        },
    cosmetics:    { rate: 0.05, label_key: 'categoryCosmetics'   },
    jewelry:      { rate: 0.05, label_key: 'categoryJewelry'     },
    food:         { rate: 0.05, label_key: 'categoryFood'        },
    books:        { rate: 0.00, label_key: 'categoryBooks'       },
    supplements:  { rate: 0.05, label_key: 'categorySupplements' },
    auto_parts:   { rate: 0.05, label_key: 'categoryAutoParts'   },
    other:        { rate: 0.05, label_key: 'categoryOther'       }
  };

  /* ─── Language → likely source currency map ─────────────────────── */
  window.LANG_CURRENCY_MAP = {
    ja:    'JPY',
    ko:    'KRW',
    zh:    'CNY',
    'zh-CN': 'CNY',
    'zh-TW': 'TWD',
    de:    'EUR',
    fr:    'EUR',
    it:    'EUR',
    es:    'EUR',
    pt:    'EUR',
    nl:    'EUR',
    pl:    'PLN',
    cs:    'CZK',
    sk:    'CZK',
    hu:    'HUF',
    ro:    'EUR',
    sv:    'SEK',
    da:    'DKK',
    nb:    'NOK',
    no:    'NOK',
    fi:    'EUR',
    tr:    'TRY',
    ru:    'EUR',
    uk:    'EUR',
    th:    'THB',
    id:    'IDR',
    ms:    'MYR',
    vi:    'IDR',
    hi:    'INR',
    bn:    'BDT',
    ta:    'INR',
    te:    'INR',
    ml:    'INR',
    ur:    'PKR',
    ar:    'EGP',
    he:    'EUR',
    en:    'USD',
    'en-US': 'USD',
    'en-GB': 'GBP',
    'en-AU': 'AUD',
    'en-CA': 'CAD',
    'pt-BR': 'BRL',
    'es-MX': 'MXN'
  };

})();
