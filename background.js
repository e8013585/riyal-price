/**
 * background.js — Manifest V3 Service Worker
 * Handles rate fetching, caching, alarms, and message routing.
 */

import { fetchAndCacheRates, getCachedRates } from './rates.js';

/* ─── Constants ────────────────────────────────────────────────────── */
const ALARM_NAME        = 'refreshRates';
const ALARM_PERIOD_MIN  = 360;

/* ─── Install / startup ─────────────────────────────────────────────── */
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[RiyalPrice] onInstalled:', details.reason);
  await setupAlarm();
  await fetchAndCacheRates(false);
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[RiyalPrice] onStartup');
  await setupAlarm();
  await fetchAndCacheRates(false);
});

async function setupAlarm() {
  const existing = await chrome.alarms.get(ALARM_NAME);
  if (!existing) {
    chrome.alarms.create(ALARM_NAME, {
      delayInMinutes:  ALARM_PERIOD_MIN,
      periodInMinutes: ALARM_PERIOD_MIN
    });
  }
}

/* ─── Alarm handler ─────────────────────────────────────────────────── */
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ALARM_NAME) {
    console.log('[RiyalPrice] Alarm fired — refreshing rates');
    await fetchAndCacheRates(false);
  }
});

/* ─── Message handler ───────────────────────────────────────────────── */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getRates') {
    getCachedRates().then((cached) => {
      if (cached) {
        sendResponse({ success: true, ...cached });
      } else {
        fetchAndCacheRates(false).then((result) => {
          sendResponse({ success: true, ...result });
        });
      }
    });
    return true;
  }

  if (message.action === 'refreshRates') {
    fetchAndCacheRates(true).then((result) => {
      sendResponse({ success: true, source: result.source, fetchedAt: result.fetchedAt });
    }).catch((err) => {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }
});

/* ─── Tab updated handler ───────────────────────────────────────────── */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    chrome.tabs.sendMessage(tabId, { action: 'init' }).catch(() => {});
  }
});
