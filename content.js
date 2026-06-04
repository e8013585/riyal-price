/**
 * content.js
 * Main content script. Depends on detector.js being loaded first.
 */

(function () {
  'use strict';

  /* ════════════════════════════════════════════════════════════════════
     CONSTANTS & STATE
  ════════════════════════════════════════════════════════════════════ */

  const MAX_PRICES      = 500;
  const DEBOUNCE_MS     = 300;
  const BADGE_ATTR      = 'data-rp-processed';
  const BADGE_CLASS     = 'rp-badge';
  const ORIG_CLASS      = 'rp-original-price';
  const SITE_BADGE_ATTR = 'data-rp-site-processed';

  const VAT = { SAR: 0.15, AED: 0.05 };

  const CURRENCY_DISPLAY = {
    SAR: { symbol: '\uFDFC', flag: '\uD83C\uDDF8\uD83C\uDDE6', color: '#1A7A4A' },
    AED: { symbol: '\u062F.\u0625', flag: '\uD83C\uDDE6\uD83C\uDDEA', color: '#005F3E' }
  };

  let rates          = null;
  let fetchedAt      = null;
  let rateSource     = 'unknown';
  let settings       = {
    enabled:      true,
    showSAR:      true,
    showAED:      false,
    showVAT:      true,
    showDuty:     false,
    dutyCategory: 'electronics',
    badgeAfter:   true,
    showFlag:     true,
    compactMode:  false
  };
  let detectedCurrency = 'USD';
  let priceCount       = 0;
  let isRTLPage        = false;
  let isArabicUI       = false;
  let observer         = null;
  let debounceTimer    = null;
  let initialized      = false;

  /* ════════════════════════════════════════════════════════════════════
     UTILITIES
  ════════════════════════════════════════════════════════════════════ */

  function i18n(key, subs) {
    try {
      return chrome.i18n.getMessage(key, subs) || key;
    } catch (_) {
      return key;
    }
  }

  function toArabicNumerals(str) {
    if (!isArabicUI) return str;
    return str.replace(/[0-9]/g, (d) => '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'[parseInt(d)]);
  }

  function formatNumber(num, decimals = 2) {
    const fixed = num.toFixed(decimals);
    if (isArabicUI) {
      const [intPart, decPart] = fixed.split('.');
      const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '\u060C');
      const result = decPart !== undefined ? intFormatted + '.' + decPart : intFormatted;
      return toArabicNumerals(result);
    } else {
      const [intPart, decPart] = fixed.split('.');
      const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return decPart !== undefined ? intFormatted + '.' + decPart : intFormatted;
    }
  }

  function parsePrice(rawStr, pattern) {
    if (!rawStr) return NaN;
    let s = rawStr.trim();

    if (pattern.decimalSep === ',') {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
      s = s.replace(/'/g, '');
      s = s.replace(/\s/g, '');
    }
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  function convertToTarget(amountUSD, targetCurrency) {
    if (!rates || !rates[targetCurrency]) return null;
    return amountUSD * rates[targetCurrency];
  }

  function toUSD(amount, sourceCurrency) {
    if (!rates) return null;
    if (sourceCurrency === 'USD') return amount;
    const rate = rates[sourceCurrency];
    if (!rate) return null;
    return amount / rate;
  }

  function rateAgeLabel() {
    if (!fetchedAt) return i18n('ratesUsingFallback');
    const ageMs   = Date.now() - new Date(fetchedAt).getTime();
    const ageHrs  = Math.floor(ageMs / 3600000);
    const ageMins = Math.floor((ageMs % 3600000) / 60000);
    if (ageHrs === 0 && ageMins < 2) return i18n('ratesJustNow');
    if (ageHrs === 0) return i18n('ratesMinutesAgo', [String(ageMins)]);
    return i18n('ratesHoursAgo', [String(ageHrs)]);
  }

  /* ════════════════════════════════════════════════════════════════════
     PAGE ANALYSIS
  ════════════════════════════════════════════════════════════════════ */

  function detectRTL() {
    const lang = document.documentElement.lang || '';
    const rtlCodes = ['ar', 'he', 'fa', 'ur'];
    return rtlCodes.some((c) => lang.toLowerCase().startsWith(c));
  }

  function detectSourceCurrency() {
    const lang = (document.documentElement.lang || 'en').toLowerCase();
    let langHint = window.LANG_CURRENCY_MAP[lang] || null;
    if (!langHint) {
      const prefix = lang.split('-')[0];
      langHint = window.LANG_CURRENCY_MAP[prefix] || 'USD';
    }

    const bodyText = (document.body && document.body.innerText)
      ? document.body.innerText.slice(0, 5000)
      : '';

    const counts = {};
    for (const [code, pattern] of Object.entries(window.CURRENCY_PATTERNS)) {
      const re = new RegExp(pattern.regex.source, pattern.regex.flags);
      let count = 0;
      let m;
      while ((m = re.exec(bodyText)) !== null) {
        count++;
        if (count > 50) break;
      }
      counts[code] = count;
    }

    let maxCount = 0;
    let winner   = null;
    for (const [code, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        winner   = code;
      }
    }

    if (!winner || maxCount < 3) {
      return langHint;
    }
    return winner;
  }

  /* ════════════════════════════════════════════════════════════════════
     BADGE CONSTRUCTION
  ════════════════════════════════════════════════════════════════════ */

  function buildBadge(sourceAmount, sourceCurrency, overrideConversions) {
    if (!rates) return null;

    const amountUSD = toUSD(sourceAmount, sourceCurrency);
    if (amountUSD === null || isNaN(amountUSD)) return null;

    const pattern    = window.CURRENCY_PATTERNS[sourceCurrency];
    const dutyInfo   = window.DUTY_RATES[settings.dutyCategory] || window.DUTY_RATES['other'];
    const dutyRate   = dutyInfo.rate;

    const badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.setAttribute('role', 'note');
    badge.setAttribute('aria-label', i18n('badgeAriaLabel'));

    const lines = document.createElement('span');
    lines.className = 'rp-badge-inner';

    const targets = [];
    if (settings.showSAR) targets.push('SAR');
    if (settings.showAED) targets.push('AED');

    if (targets.length === 0) return null;

    const computed = {};
    for (const tgt of targets) {
      const converted = convertToTarget(amountUSD, tgt);
      if (converted === null) continue;
      const duty    = converted * dutyRate;
      const vatBase = converted + (settings.showDuty ? duty : 0);
      const vat     = vatBase * VAT[tgt];
      computed[tgt] = { converted, duty, vat, total: converted + duty + vat };
    }

    const line1 = document.createElement('span');
    line1.className = 'rp-line rp-line-price';

    const parts = [];
    for (const tgt of targets) {
      if (!computed[tgt]) continue;
      const d    = CURRENCY_DISPLAY[tgt];
      const val  = formatNumber(computed[tgt].converted, 2);
      let text   = '';
      if (settings.showFlag) text += d.flag + ' ';
      text += d.symbol + '\u00A0' + val;
      if (targets.length === 1) text += ' ' + tgt;
      parts.push(text);
    }
    line1.textContent = parts.join(' | ');
    lines.appendChild(line1);

    if (settings.showVAT && !settings.compactMode) {
      for (const tgt of targets) {
        if (!computed[tgt]) continue;
        const d    = CURRENCY_DISPLAY[tgt];
        const vat  = computed[tgt].vat;
        const pct  = (VAT[tgt] * 100).toFixed(0);
        const line = document.createElement('span');
        line.className = 'rp-line rp-line-vat';
        line.textContent = '+ ' + d.symbol + '\u00A0' + formatNumber(vat, 2) + ' VAT (' + pct + '%)';
        lines.appendChild(line);
      }
    }

    if (settings.showDuty && settings.dutyCategory && !settings.compactMode) {
      for (const tgt of targets) {
        if (!computed[tgt]) continue;
        const d    = CURRENCY_DISPLAY[tgt];
        const duty = computed[tgt].duty;
        const pct  = (dutyRate * 100).toFixed(0);
        const line = document.createElement('span');
        line.className = 'rp-line rp-line-duty';
        line.textContent = '~' + d.symbol + '\u00A0' + formatNumber(duty, 2) + ' ' + i18n('dutyLabel') + ' (' + pct + '%)';
        lines.appendChild(line);
      }
    }

    badge.appendChild(lines);

    const tooltip = buildTooltip(sourceAmount, sourceCurrency, computed, dutyRate, amountUSD);
    badge.appendChild(tooltip);

    badge.addEventListener('mouseenter', (e) => {
      tooltip.style.display = 'block';
      positionTooltip(tooltip, badge);
    });
    badge.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });

    return badge;
  }

  function buildTooltip(sourceAmount, sourceCurrency, computed, dutyRate, amountUSD) {
    const tooltip = document.createElement('div');
    tooltip.className = 'rp-tooltip';

    function addRow(label, value) {
      const row = document.createElement('div');
      row.className = 'rp-tooltip-row';
      const lbl = document.createElement('span');
      lbl.className = 'rp-tooltip-label';
      lbl.textContent = label;
      const val = document.createElement('span');
      val.className = 'rp-tooltip-value';
      val.textContent = value;
      row.appendChild(lbl);
      row.appendChild(val);
      tooltip.appendChild(row);
    }

    function addSep() {
      const hr = document.createElement('div');
      hr.className = 'rp-tooltip-sep';
      tooltip.appendChild(hr);
    }

    function addText(text, cls) {
      const p = document.createElement('div');
      p.className = cls || 'rp-tooltip-note';
      p.textContent = text;
      tooltip.appendChild(p);
    }

    const srcPattern = window.CURRENCY_PATTERNS[sourceCurrency];
    const srcSymbols = srcPattern ? srcPattern.symbols[0] : sourceCurrency;

    addRow(i18n('tooltipOriginal'), srcSymbols + formatNumber(sourceAmount, 2) + ' ' + sourceCurrency);

    addSep();

    for (const tgt of Object.keys(computed)) {
      const d   = CURRENCY_DISPLAY[tgt];
      const c   = computed[tgt];
      const rate = rates && rates[tgt] ? rates[tgt] : '?';
      const rateStr = typeof rate === 'number' ? rate.toFixed(4) : rate;
      addRow(i18n('tooltipRate'), '1 USD = ' + rateStr + ' ' + tgt);
      addRow(i18n('tooltipConverted'), d.symbol + '\u00A0' + formatNumber(c.converted, 2) + ' ' + tgt);
      if (settings.showVAT) {
        const pct = (VAT[tgt] * 100).toFixed(0);
        addRow(i18n('tooltipVAT', [pct]), d.symbol + '\u00A0' + formatNumber(c.vat, 2));
        addText(i18n('vatLawNote'), 'rp-tooltip-law');
      }
      if (settings.showDuty && settings.dutyCategory) {
        const pct = (dutyRate * 100).toFixed(0);
        addRow(i18n('tooltipDuty', [pct]), d.symbol + '\u00A0' + formatNumber(c.duty, 2));
      }
      addRow(i18n('tooltipTotal'), d.symbol + '\u00A0' + formatNumber(c.total, 2) + ' ' + tgt);
      addSep();
    }

    addRow(i18n('tooltipRateTime'), rateAgeLabel());

    addText(i18n('disclaimerShort'), 'rp-tooltip-disclaimer');

    return tooltip;
  }

  function positionTooltip(tooltip, badge) {
    requestAnimationFrame(() => {
      const badgeRect   = badge.getBoundingClientRect();
      const ttRect      = tooltip.getBoundingClientRect();
      const vw          = window.innerWidth;
      const vh          = window.innerHeight;

      let left = 0;
      if (badgeRect.left + ttRect.width > vw) {
        left = vw - badgeRect.right - ttRect.width - 8;
        tooltip.style.left = left + 'px';
        tooltip.style.right = 'auto';
      } else {
        tooltip.style.left = '0';
        tooltip.style.right = 'auto';
      }

      if (badgeRect.bottom + ttRect.height + 8 > vh) {
        tooltip.style.top  = 'auto';
        tooltip.style.bottom = '100%';
      } else {
        tooltip.style.top  = '100%';
        tooltip.style.bottom = 'auto';
      }
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     TEXT NODE INJECTION
  ════════════════════════════════════════════════════════════════════ */

  const SKIP_TAGS = new Set([
    'SCRIPT','STYLE','NOSCRIPT','TEXTAREA','INPUT','SELECT','BUTTON',
    'CODE','PRE','SVG','MATH','HEAD','IFRAME','OBJECT','EMBED'
  ]);

  function shouldSkipNode(node) {
    let n = node.parentElement;
    while (n) {
      if (SKIP_TAGS.has(n.tagName)) return true;
      if (n.classList && (n.classList.contains(BADGE_CLASS) || n.classList.contains(ORIG_CLASS))) return true;
      if (n.getAttribute('aria-hidden') === 'true') return true;
      n = n.parentElement;
    }
    return false;
  }

  function processTextNode(textNode, pattern) {
    if (textNode[BADGE_ATTR]) return 0;
    if (shouldSkipNode(textNode)) return 0;

    const text = textNode.nodeValue;
    if (!text || text.trim().length < 1) return 0;

    const re     = new RegExp(pattern.regex.source, 'g');
    const parent = textNode.parentNode;
    if (!parent) return 0;

    let lastIndex = 0;
    let match;
    const fragments = [];
    let matchCount  = 0;

    while ((match = re.exec(text)) !== null) {
      if (priceCount >= MAX_PRICES) break;

      const rawNum = match[1] || match[2];
      if (!rawNum) continue;

      const numVal = parsePrice(rawNum, pattern);
      if (isNaN(numVal) || numVal <= 0) continue;

      if (match.index > lastIndex) {
        fragments.push(document.createTextNode(text.slice(lastIndex, match.index)));
      }

      const origSpan = document.createElement('span');
      origSpan.className = ORIG_CLASS;
      origSpan.textContent = match[0];

      const badge = buildBadge(numVal, pattern.code);

      fragments.push(origSpan);

      if (badge) {
        if (isRTLPage && !settings.badgeAfter) {
          fragments.pop();
          fragments.push(badge);
          fragments.push(origSpan);
        } else {
          fragments.push(badge);
        }
        priceCount++;
        matchCount++;
      }

      lastIndex = match.index + match[0].length;
    }

    if (matchCount === 0) return 0;

    if (lastIndex < text.length) {
      fragments.push(document.createTextNode(text.slice(lastIndex)));
    }

    const frag = document.createDocumentFragment();
    for (const f of fragments) frag.appendChild(f);

    parent.replaceChild(frag, textNode);

    return matchCount;
  }

  function walkAndProcess(root, patternCode) {
    if (!root) return;
    const pattern = window.CURRENCY_PATTERNS[patternCode];
    if (!pattern) return;

    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node[BADGE_ATTR]) return NodeFilter.FILTER_REJECT;
          if (!node.nodeValue || node.nodeValue.trim().length === 0)
            return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    let node;
    while ((node = walker.nextNode()) !== null) {
      nodes.push(node);
    }

    for (const n of nodes) {
      if (priceCount >= MAX_PRICES) break;
      processTextNode(n, pattern);
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     SITE-SPECIFIC HANDLERS
  ════════════════════════════════════════════════════════════════════ */

  function isAmazon() {
    return /amazon\.(com|co\.uk|de|co\.jp|fr|it|es|ca|com\.au|in|nl|se|pl|sg|ae|sa)/.test(location.hostname);
  }

  function isEbay() {
    return /ebay\.(com|co\.uk|de|com\.au|fr|it|es|ca)/.test(location.hostname);
  }

  function isEtsy() {
    return /etsy\.com/.test(location.hostname);
  }

  function isAliExpress() {
    return /aliexpress\.com/.test(location.hostname);
  }

  function handleAmazon() {
    const priceContainers = document.querySelectorAll('.a-price:not([' + SITE_BADGE_ATTR + '])');
    for (const container of priceContainers) {
      if (priceCount >= MAX_PRICES) break;

      const offscreen = container.querySelector('.a-offscreen');
      let rawPriceStr = null;
      if (offscreen && !offscreen.getAttribute('aria-hidden')) {
        rawPriceStr = offscreen.textContent.trim();
      }

      if (!rawPriceStr) {
        const whole    = container.querySelector('.a-price-whole');
        const fraction = container.querySelector('.a-price-fraction');
        if (whole) {
          const wholeText = whole.textContent.replace(/[^0-9]/g, '');
          const fracText  = fraction ? fraction.textContent.replace(/[^0-9]/g, '') : '00';
          rawPriceStr = wholeText + '.' + fracText;
        }
      }

      if (!rawPriceStr) continue;

      const containerText = container.textContent;
      const srcCode = detectCurrencyFromText(containerText) || detectedCurrency;
      const pattern  = window.CURRENCY_PATTERNS[srcCode];
      if (!pattern) continue;

      const numVal = parsePriceString(rawPriceStr, pattern);
      if (isNaN(numVal) || numVal <= 0) continue;

      const badge = buildBadge(numVal, srcCode);
      if (!badge) continue;

      container.setAttribute(SITE_BADGE_ATTR, '1');
      container.style.position = 'relative';
      container.appendChild(badge);
      priceCount++;
    }
  }

  function handleEbay() {
    const selectors = ['.x-price-primary', '.s-item__price', '.display-price'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel + ':not([' + SITE_BADGE_ATTR + '])');
      for (const el of els) {
        if (priceCount >= MAX_PRICES) break;
        const text    = el.textContent.trim();
        const srcCode = detectCurrencyFromText(text) || detectedCurrency;
        const pattern = window.CURRENCY_PATTERNS[srcCode];
        if (!pattern) continue;

        const re = new RegExp(pattern.regex.source, 'g');
        const m  = re.exec(text);
        if (!m) continue;

        const numVal = parsePrice(m[1] || m[2], pattern);
        if (isNaN(numVal) || numVal <= 0) continue;

        const badge = buildBadge(numVal, srcCode);
        if (!badge) continue;

        el.setAttribute(SITE_BADGE_ATTR, '1');
        el.appendChild(badge);
        priceCount++;
      }
    }
  }

  function handleEtsy() {
    const selectors = ['.currency-value', '[data-buy-box-region] .currency-value', '.listing-page-price-amount'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel + ':not([' + SITE_BADGE_ATTR + '])');
      for (const el of els) {
        if (priceCount >= MAX_PRICES) break;

        const rawText = el.textContent.trim();
        const numVal  = parseFloat(rawText.replace(/,/g, ''));
        if (isNaN(numVal) || numVal <= 0) continue;

        const srcCode = detectedCurrency;
        const badge   = buildBadge(numVal, srcCode);
        if (!badge) continue;

        el.setAttribute(SITE_BADGE_ATTR, '1');
        el.appendChild(badge);
        priceCount++;
      }
    }
  }

  function handleAliExpress() {
    const selectors = ['.product-price-value', '.uniform-banner-box-price', '.price--currentPriceText--V8_y88p'];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel + ':not([' + SITE_BADGE_ATTR + '])');
      for (const el of els) {
        if (priceCount >= MAX_PRICES) break;

        const text    = el.textContent.trim();
        const srcCode = detectCurrencyFromText(text) || 'USD';
        const pattern = window.CURRENCY_PATTERNS[srcCode];
        if (!pattern) continue;

        const re = new RegExp(pattern.regex.source, 'g');
        const m  = re.exec(text);
        if (!m) continue;

        const numVal = parsePrice(m[1] || m[2], pattern);
        if (isNaN(numVal) || numVal <= 0) continue;

        const badge = buildBadge(numVal, srcCode);
        if (!badge) continue;

        el.setAttribute(SITE_BADGE_ATTR, '1');
        el.appendChild(badge);
        priceCount++;
      }
    }
  }

  function detectCurrencyFromText(text) {
    for (const [code, pattern] of Object.entries(window.CURRENCY_PATTERNS)) {
      for (const sym of pattern.symbols) {
        if (text.includes(sym)) return code;
      }
    }
    return null;
  }

  function parsePriceString(str, pattern) {
    const cleaned = str.replace(/[^0-9.,]/g, '');
    return parsePrice(cleaned, pattern);
  }

  /* ════════════════════════════════════════════════════════════════════
     MAIN SCAN
  ════════════════════════════════════════════════════════════════════ */

  function scan(root) {
    if (!settings.enabled) return;
    if (!rates)             return;

    if (isAmazon())     handleAmazon();
    else if (isEbay())  handleEbay();
    else if (isEtsy())  handleEtsy();
    else if (isAliExpress()) handleAliExpress();

    if (priceCount < MAX_PRICES) {
      walkAndProcess(root || document.body, detectedCurrency);
    }

    notifyPopup();

    if (priceCount >= MAX_PRICES) {
      console.info('[RiyalPrice] ' + i18n('maxPricesWarning'));
    }
  }

  function notifyPopup() {
    try {
      chrome.runtime.sendMessage({
        action:            'pageStats',
        priceCount:        priceCount,
        detectedCurrency:  detectedCurrency,
        rateForCurrency:   rates ? rates[detectedCurrency] : null,
        fetchedAt:         fetchedAt
      }).catch(() => {});
    } catch (_) {}
  }

  /* ════════════════════════════════════════════════════════════════════
     CLEANUP
  ════════════════════════════════════════════════════════════════════ */

  function removeAllBadges() {
    document.querySelectorAll('.' + BADGE_CLASS).forEach((el) => el.remove());

    document.querySelectorAll('.' + ORIG_CLASS).forEach((span) => {
      const parent = span.parentNode;
      if (parent) {
        const text = document.createTextNode(span.textContent);
        parent.replaceChild(text, span);
      }
    });

    document.querySelectorAll('[' + SITE_BADGE_ATTR + ']').forEach((el) => {
      el.removeAttribute(SITE_BADGE_ATTR);
    });

    priceCount = 0;
  }

  function rescan() {
    removeAllBadges();
    priceCount = 0;
    scan(document.body);
  }

  /* ════════════════════════════════════════════════════════════════════
     MUTATION OBSERVER
  ════════════════════════════════════════════════════════════════════ */

  function startObserver() {
    if (observer) return;

    observer = new MutationObserver((mutations) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (!settings.enabled || !rates) return;

        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if (node.classList && (node.classList.contains(BADGE_CLASS) || node.classList.contains(ORIG_CLASS))) continue;
              if (priceCount < MAX_PRICES) {
                if (isAmazon())          handleAmazon();
                else if (isEbay())       handleEbay();
                else if (isEtsy())       handleEtsy();
                else if (isAliExpress()) handleAliExpress();
                walkAndProcess(node, detectedCurrency);
              }
            }
          }
        }
        notifyPopup();
      }, DEBOUNCE_MS);
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  function stopObserver() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    clearTimeout(debounceTimer);
  }

  /* ════════════════════════════════════════════════════════════════════
     INITIALIZATION
  ════════════════════════════════════════════════════════════════════ */

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get([
        'enabled','showSAR','showAED','showVAT','showDuty',
        'dutyCategory','badgeAfter','showFlag','compactMode'
      ], (result) => {
        if (result.enabled      !== undefined) settings.enabled      = result.enabled;
        if (result.showSAR      !== undefined) settings.showSAR      = result.showSAR;
        if (result.showAED      !== undefined) settings.showAED      = result.showAED;
        if (result.showVAT      !== undefined) settings.showVAT      = result.showVAT;
        if (result.showDuty     !== undefined) settings.showDuty     = result.showDuty;
        if (result.dutyCategory !== undefined) settings.dutyCategory = result.dutyCategory;
        if (result.badgeAfter   !== undefined) settings.badgeAfter   = result.badgeAfter;
        if (result.showFlag     !== undefined) settings.showFlag     = result.showFlag;
        if (result.compactMode  !== undefined) settings.compactMode  = result.compactMode;
        resolve();
      });
    });
  }

  async function loadRates() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'getRates' }, (response) => {
        if (chrome.runtime.lastError) { resolve(); return; }
        if (response && response.rates) {
          rates      = response.rates;
          fetchedAt  = response.fetchedAt || null;
          rateSource = response.source    || 'cache';
        }
        resolve();
      });
    });
  }

  async function init() {
    if (initialized) {
      rescan();
      return;
    }
    initialized = true;

    isArabicUI = chrome.i18n.getUILanguage().startsWith('ar');
    isRTLPage  = detectRTL();

    await loadSettings();
    await loadRates();

    detectedCurrency = detectSourceCurrency();

    if (settings.enabled) {
      scan(document.body);
      startObserver();
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     MESSAGE LISTENER
  ════════════════════════════════════════════════════════════════════ */

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'init') {
      loadSettings().then(() => {
        loadRates().then(() => {
          if (settings.enabled) {
            rescan();
            startObserver();
          } else {
            removeAllBadges();
            stopObserver();
          }
        });
      });
      sendResponse({ ok: true });
      return true;
    }

    if (message.action === 'rescan') {
      loadSettings().then(() => {
        rescan();
        sendResponse({ priceCount });
      });
      return true;
    }

    if (message.action === 'disable') {
      settings.enabled = false;
      stopObserver();
      removeAllBadges();
      sendResponse({ ok: true });
      return true;
    }

    if (message.action === 'enable') {
      settings.enabled = true;
      loadSettings().then(() => {
        loadRates().then(() => {
          rescan();
          startObserver();
          sendResponse({ priceCount });
        });
      });
      return true;
    }

    if (message.action === 'ratesUpdated') {
      loadRates().then(() => {
        if (settings.enabled) rescan();
      });
      sendResponse({ ok: true });
      return true;

    }

    if (message.action === 'getStats') {
      sendResponse({
        priceCount:       priceCount,
        detectedCurrency: detectedCurrency,
        fetchedAt:        fetchedAt,
        rateForCurrency:  rates ? rates[detectedCurrency] : null,
        sarRate:          rates ? rates['SAR'] : null,
        aedRate:          rates ? rates['AED'] : null
      });
      return true;
    }
  });

  /* ════════════════════════════════════════════════════════════════════
     BOOT
  ════════════════════════════════════════════════════════════════════ */

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const settingKeys = ['enabled','showSAR','showAED','showVAT','showDuty','dutyCategory','badgeAfter','showFlag','compactMode'];
    const relevant    = Object.keys(changes).some((k) => settingKeys.includes(k));
    if (!relevant) return;

    loadSettings().then(() => {
      if (settings.enabled) {
        rescan();
        startObserver();
      } else {
        removeAllBadges();
        stopObserver();
      }
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
