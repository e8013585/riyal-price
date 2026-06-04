/**
 * popup.js
 * Controls the extension popup UI.
 * All user-visible strings from chrome.i18n.getMessage().
 */

(function () {
  'use strict';

  function t(key, subs) {
    return chrome.i18n.getMessage(key, subs) || key;
  }

  const uiLang = chrome.i18n.getUILanguage().toLowerCase();
  const isRTL  = ['ar','he','fa','ur'].some((l) => uiLang.startsWith(l));
  if (isRTL) {
    document.documentElement.setAttribute('dir', 'rtl');
    document.body.setAttribute('dir', 'rtl');
  }

  const $ = (id) => document.getElementById(id);

  const elExtName        = $('rp-ext-name');
  const elMasterToggle   = $('rp-master-toggle');
  const elStatusDot      = $('rp-status-dot');
  const elDetectedLabel  = $('rp-detected-label');
  const elDetectedVal    = $('rp-detected-currency');
  const elRatesLabel     = $('rp-rates-label');
  const elRatesValue     = $('rp-rates-value');
  const elRefreshBtn     = $('rp-refresh-rates');
  const elShowPricesIn   = $('rp-show-prices-in-label');
  const elEstLabel       = $('rp-estimation-label');
  const elVatLabel       = $('rp-vat-label');
  const elVatToggle      = $('rp-vat-toggle');
  const elDutyLabel      = $('rp-duty-label');
  const elDutyToggle     = $('rp-duty-toggle');
  const elCategoryRow    = $('rp-duty-category-row');
  const elCategoryLabel  = $('rp-category-label');
  const elCategorySelect = $('rp-duty-category');
  const elDisclaimer     = $('rp-disclaimer');
  const elDisplayToggle  = $('rp-display-toggle');
  const elDisplayOptions = $('rp-display-options');
  const elDisplayLabel   = $('rp-display-options-label');
  const elBadgePosLabel  = $('rp-badge-pos-label');
  const elPosAfter       = $('rp-pos-after');
  const elPosBefore      = $('rp-pos-before');
  const elAfterLabel     = $('rp-after-label');
  const elBeforeLabel    = $('rp-before-label');
  const elFlagLabel      = $('rp-flag-label');
  const elFlagToggle     = $('rp-flag-toggle');
  const elCompactLabel   = $('rp-compact-label');
  const elCompactToggle  = $('rp-compact-toggle');
  const elPriceCount     = $('rp-price-count');
  const elMaxWarn        = $('rp-max-warn');
  const elStatsDetail    = $('rp-stats-detail');
  const elRescanBtn      = $('rp-rescan');
  const elSARBtn         = $('rp-toggle-sar');
  const elAEDBtn         = $('rp-toggle-aed');

  let settings = {
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
  let fetchedAt    = null;
  let pageStats    = { priceCount: 0, detectedCurrency: null, rateForCurrency: null, sarRate: null, aedRate: null };

  function applyI18n() {
    document.title               = t('extensionName');
    elExtName.textContent        = t('extensionName');
    elDetectedLabel.textContent  = t('statusDetected') + ':';
    elRatesLabel.textContent     = t('statusRates') + ':';
    elRefreshBtn.setAttribute('aria-label', t('refreshRates'));
    elRefreshBtn.setAttribute('title', t('refreshRates'));
    elShowPricesIn.textContent   = t('showPricesIn');
    elEstLabel.textContent       = t('estimationSection');
    elVatLabel.textContent       = t('showVAT');
    elDutyLabel.textContent      = t('showDuty');
    elCategoryLabel.textContent  = t('productCategory');
    elDisclaimer.textContent     = t('disclaimerText');
    elDisplayLabel.textContent   = t('displayOptions');
    elBadgePosLabel.textContent  = t('badgePosition');
    elAfterLabel.textContent     = t('badgeAfterPrice');
    elBeforeLabel.textContent    = t('badgeBeforePrice');
    elFlagLabel.textContent      = t('showFlag');
    elCompactLabel.textContent   = t('compactMode');
    elRescanBtn.textContent      = t('rescanPage');
    elMaxWarn.textContent        = t('maxPricesWarning');
    $('rp-status-section-label').setAttribute('aria-label', t('statusSection'));
    elMasterToggle.setAttribute('aria-label', t('masterToggle'));
    populateCategoryDropdown();
  }

  function populateCategoryDropdown() {
    const categories = [
      'electronics','clothing','footwear','furniture','toys',
      'cosmetics','jewelry','food','books','supplements',
      'auto_parts','other'
    ];
    elCategorySelect.innerHTML = '';
    for (const key of categories) {
      const opt = document.createElement('option');
      opt.value       = key;
      opt.textContent = t(getCategoryI18nKey(key));
      elCategorySelect.appendChild(opt);
    }
  }

  function getCategoryI18nKey(key) {
    const map = {
      electronics:  'categoryElectronics',
      clothing:     'categoryClothing',
      footwear:     'categoryFootwear',
      furniture:    'categoryFurniture',
      toys:         'categoryToys',
      cosmetics:    'categoryCosmetics',
      jewelry:      'categoryJewelry',
      food:         'categoryFood',
      books:        'categoryBooks',
      supplements:  'categorySupplements',
      auto_parts:   'categoryAutoParts',
      other:        'categoryOther'
    };
    return map[key] || 'categoryOther';
  }

  function loadSettings(callback) {
    chrome.storage.local.get([
      'enabled','showSAR','showAED','showVAT','showDuty',
      'dutyCategory','badgeAfter','showFlag','compactMode',
      'rp_rates_cache'
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

      if (result.rp_rates_cache && result.rp_rates_cache.fetchedAt) {
        fetchedAt = result.rp_rates_cache.fetchedAt;
      }

      if (callback) callback();
    });
  }

  function saveSetting(key, value) {
    const obj = {};
    obj[key]  = value;
    chrome.storage.local.set(obj);
  }

  function renderUI() {
    elMasterToggle.checked = settings.enabled;

    elSARBtn.setAttribute('aria-pressed', settings.showSAR ? 'true' : 'false');
    elAEDBtn.setAttribute('aria-pressed', settings.showAED ? 'true' : 'false');

    elVatToggle.checked     = settings.showVAT;
    elDutyToggle.checked    = settings.showDuty;
    elFlagToggle.checked    = settings.showFlag;
    elCompactToggle.checked = settings.compactMode;

    elCategoryRow.style.display = settings.showDuty ? 'flex' : 'none';
    elCategorySelect.value      = settings.dutyCategory;

    if (settings.badgeAfter) {
      elPosAfter.checked  = true;
      elPosBefore.checked = false;
    } else {
      elPosAfter.checked  = false;
      elPosBefore.checked = true;
    }

    updateRatesDisplay();
  }

  function updateRatesDisplay() {
    if (!fetchedAt) {
      elRatesValue.textContent = t('ratesUsingFallback');
    } else {
      const ageMs   = Date.now() - new Date(fetchedAt).getTime();
      const ageHrs  = Math.floor(ageMs / 3600000);
      const ageMins = Math.floor((ageMs % 3600000) / 60000);
      if (ageHrs === 0 && ageMins < 2) {
        elRatesValue.textContent = t('ratesJustNow');
      } else if (ageHrs === 0) {
        elRatesValue.textContent = t('ratesMinutesAgo', [String(ageMins)]);
      } else {
        elRatesValue.textContent = t('ratesHoursAgo', [String(ageHrs)]);
      }
    }
  }

  function requestPageStats() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      const tabId = tabs[0].id;
      chrome.tabs.sendMessage(tabId, { action: 'getStats' }, (response) => {
        if (chrome.runtime.lastError) {
          renderStats(null);
          return;
        }
        if (response) {
          pageStats = response;
          renderStats(response);
        }
      });
    });
  }

  function renderStats(stats) {
    if (!stats || stats.priceCount === 0) {
      elPriceCount.textContent = t('noPricesDetected');
      elStatsDetail.textContent = '';
      elStatusDot.classList.remove('active');
      elDetectedVal.textContent = t('noPricesDetected');
      return;
    }

    elStatusDot.classList.add('active');
    elDetectedVal.textContent = stats.detectedCurrency || '\u2014';

    const count = stats.priceCount;
    elPriceCount.textContent = t('pricesConverted', [String(count)]);

    if (count >= 500) {
      elMaxWarn.style.display = 'inline';
    } else {
      elMaxWarn.style.display = 'none';
    }

    let detail = '';
    if (stats.detectedCurrency) {
      detail += t('sourceCurrency') + ': ' + stats.detectedCurrency;
    }
    if (stats.sarRate && settings.showSAR) {
      detail += ' | 1 USD = ' + stats.sarRate.toFixed(4) + ' SAR';
    }
    if (stats.aedRate && settings.showAED) {
      detail += ' | 1 USD = ' + stats.aedRate.toFixed(4) + ' AED';
    }
    elStatsDetail.textContent = detail;
  }

  elMasterToggle.addEventListener('change', () => {
    settings.enabled = elMasterToggle.checked;
    saveSetting('enabled', settings.enabled);
    sendToActiveTab(settings.enabled ? { action: 'enable' } : { action: 'disable' });
  });

  function handleCurrencyBtn(btn, currencyKey) {
    const isCurrentlyOn = btn.getAttribute('aria-pressed') === 'true';
    const otherKey      = currencyKey === 'showSAR' ? 'showAED' : 'showSAR';
    const isOtherOn     = settings[otherKey];

    if (isCurrentlyOn && !isOtherOn) {
      btn.classList.remove('rp-shake');
      void btn.offsetWidth;
      btn.classList.add('rp-shake');
      btn.addEventListener('animationend', () => btn.classList.remove('rp-shake'), { once: true });
      return;
    }

    settings[currencyKey] = !isCurrentlyOn;
    saveSetting(currencyKey, settings[currencyKey]);
    btn.setAttribute('aria-pressed', settings[currencyKey] ? 'true' : 'false');
    triggerRescan();
  }

  elSARBtn.addEventListener('click', () => handleCurrencyBtn(elSARBtn, 'showSAR'));
  elAEDBtn.addEventListener('click', () => handleCurrencyBtn(elAEDBtn, 'showAED'));

  elVatToggle.addEventListener('change', () => {
    settings.showVAT = elVatToggle.checked;
    saveSetting('showVAT', settings.showVAT);
    triggerRescan();
  });

  elDutyToggle.addEventListener('change', () => {
    settings.showDuty = elDutyToggle.checked;
    saveSetting('showDuty', settings.showDuty);
    elCategoryRow.style.display = settings.showDuty ? 'flex' : 'none';
    triggerRescan();
  });

  elCategorySelect.addEventListener('change', () => {
    settings.dutyCategory = elCategorySelect.value;
    saveSetting('dutyCategory', settings.dutyCategory);
    triggerRescan();
  });

  elDisplayToggle.addEventListener('click', () => {
    const expanded = elDisplayToggle.getAttribute('aria-expanded') === 'true';
    elDisplayToggle.setAttribute('aria-expanded', !expanded ? 'true' : 'false');
    elDisplayOptions.setAttribute('aria-hidden', !expanded ? 'false' : 'true');
    elDisplayOptions.classList.toggle('open', !expanded);
  });

  elPosAfter.addEventListener('change', () => {
    if (elPosAfter.checked) {
      settings.badgeAfter = true;
      saveSetting('badgeAfter', true);
      triggerRescan();
    }
  });
  elPosBefore.addEventListener('change', () => {
    if (elPosBefore.checked) {
      settings.badgeAfter = false;
      saveSetting('badgeAfter', false);
      triggerRescan();
    }
  });

  elFlagToggle.addEventListener('change', () => {
    settings.showFlag = elFlagToggle.checked;
    saveSetting('showFlag', settings.showFlag);
    triggerRescan();
  });

  elCompactToggle.addEventListener('change', () => {
    settings.compactMode = elCompactToggle.checked;
    saveSetting('compactMode', settings.compactMode);
    triggerRescan();
  });

  elRefreshBtn.addEventListener('click', () => {
    elRefreshBtn.classList.add('spinning');
    chrome.runtime.sendMessage({ action: 'refreshRates' }, (response) => {
      elRefreshBtn.classList.remove('spinning');
      if (response && response.fetchedAt) {
        fetchedAt = response.fetchedAt;
        updateRatesDisplay();
      }
      triggerRescan();
    });
  });

  elRescanBtn.addEventListener('click', () => {
    triggerRescan();
  });

  function sendToActiveTab(msg, callback) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
        if (chrome.runtime.lastError) return;
        if (callback) callback(response);
      });
    });
  }

  function triggerRescan() {
    sendToActiveTab({ action: 'rescan' }, (response) => {
      if (response) {
        renderStats({
          priceCount:       response.priceCount || 0,
          detectedCurrency: pageStats.detectedCurrency,
          sarRate:          pageStats.sarRate,
          aedRate:          pageStats.aedRate
        });
      }
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.action === 'ratesUpdated') {
      loadSettings(() => {
        updateRatesDisplay();
      });
    }
  });

  function init() {
    applyI18n();
    loadSettings(() => {
      renderUI();
      requestPageStats();
    });
  }

  init();

})();
