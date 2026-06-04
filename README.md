# Riyal Price — سعر الريال

> See international prices converted to **Saudi Riyal (SAR)** and **UAE Dirham (AED)** with VAT and import duty estimates, directly on any shopping site.

## Permissions & Justification

| Permission | Why it's needed |
|---|---|
| `storage` | Caches exchange rates locally (6-hour TTL) and persists user preferences (enabled state, target currencies, VAT/duty toggles, display options). No data is synced or transmitted. |
| `alarms` | Triggers periodic background rate refreshes every 6 hours so the user always sees reasonably current conversions without manual intervention. |
| `activeTab` | Lets the popup query the current tab for detected price counts and sends re-scan/init messages. |
| `scripting` | Used only for potential future `chrome.scripting.executeScript` calls; currently unused but declared for forward compatibility with dynamic script injection if needed. |
| `<all_urls>` content_scripts | E-commerce sites span thousands of domains (Amazon.*, eBay.*, Etsy, AliExpress, etc.). The content script runs on all URLs because there is no exhaustive allowlist. The script **only reads text nodes** to detect prices and **injects non-interactive badge spans**. No cookies, no forms, no user data is collected or transmitted. |
| `https://open.er-api.com/*` host permission | The sole API call made by the extension — fetches live USD exchange rates from a free, public API. No authentication, no user-identifying headers. |

**No analytics, no tracking, no external requests** other than the single rate-fetch call to `open.er-api.com`.

---

## Features

- **Automatic currency detection** — scans the page's locale and symbol frequency to determine the source currency.
- **Real-time conversion** — live exchange rates cached for 6 hours with hardcoded offline fallback.
- **VAT estimation** — 15% for KSA (Royal Decree M/113, 2020) and 5% for UAE (Federal Law No. 8, 2017).
- **Import duty estimation** — 12 product categories with configurable duty rates (0%–5%).
- **Rich tooltips** — hover any badge to see original price, rate, VAT, duty, and total with legal references.
- **Site-specific optimizations** — Amazon, eBay, Etsy, and AliExpress get tailored price selectors.
- **RTL & Arabic support** — Arabic numerals, Arabic-Indic digits, RTL layout, and a full professional Arabic translation.
- **MutationObserver** — dynamically handles single-page apps and infinite-scroll product grids.

## Chrome Web Store Description

**Riyal Price** instantly converts international prices to Saudi Riyal (SAR) and UAE Dirham (AED) while you shop. No more mental math — just accurate, always-visible conversions with built-in VAT and customs estimates.

**How it works:**
1. Visit any shopping site (Amazon, eBay, Etsy, AliExpress, etc.)
2. Riyal Price automatically detects the page's currency
3. A green badge appears next to every price showing the SAR/AED equivalent
4. Hover any badge for a detailed breakdown: original price, exchange rate, VAT, estimated duty, and total

**Key features:**
- Automatic currency detection for 30+ global currencies
- Live exchange rates via open.er-api.com (auto-refresh every 6 hours)
- Saudi VAT (15%) and UAE VAT (5%) included per local law
- 12 product categories for customs duty estimation
- Site-specific support for Amazon, eBay, Etsy, and AliExpress
- Fully translatable — currently in English and Arabic
- Works on dynamically-loaded content (SPAs, infinite scroll)
- No user accounts, no tracking, no data collection

**Use it for:**
- Shopping on international Amazon stores
- Comparing prices across eBay sellers worldwide
- Etsy handmade goods from global artisans
- AliExpress direct-from-China purchases
- Any site displaying prices in USD, EUR, GBP, JPY, CNY, and 25+ more currencies

## Development

```
git clone <repo>
cd riyal-price-extension
# Load unpacked extension in Chrome via chrome://extensions
```

To regenerate locale translations:

```bash
python scripts/translate_locales.py
```

## License

MIT
