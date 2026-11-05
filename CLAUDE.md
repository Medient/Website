# Medient website: project notes

Read this before changing anything. It records how the site is set up and the decisions already made with the owner (Mo, Medient).

## What this is
Static landing pages for Medient (helps UK students study medicine and dentistry in English-taught universities in Europe). Hosted on GitHub Pages from `main`, served at **https://apply.medient.co.uk**. The long-term plan is to move the whole Medient website (currently WordPress on SiteGround at medient.co.uk) here, page by page.

| Path | What |
|---|---|
| `/` (`index.html`) | Redirects to medient.co.uk. No page of its own. |
| `/medicine/` | Medicine landing page (Google Ads destination) |
| `/dentistry/` | Dentistry landing page (Google Ads destination) |
| `/<course>/thank-you` | Shown after the form; holds the (still commented-out) Google Ads conversion tag |
| `assets/flags/` | SVG flags (pl, sk, ro, bg, ge) |
| `assets/brand/` | Favicons and link-preview images (`og-medicine.jpg`, `og-dentistry.jpg`) |
| `assets/tracking.js` | Shared tracking: GTM + Clarity IDs, Consent Mode v2 cookie banner, `medientTrack()` helper. Loaded in every page head |
| `google-apps-script/Code.gs` | Copy of the form handler that runs in Google Apps Script |
| `CNAME` | `apply.medient.co.uk`. Don't delete it, or the custom domain disconnects |

Each page is one self-contained HTML file (CSS and JS inline, no build step, no frameworks). Keep it that way: speed matters for ad landing pages.

## Hosting and domain
- GitHub repo `Medient/Website`, Pages source = `main` / root. `.nojekyll` is present.
- DNS for medient.co.uk is on **Cloudflare** (not SiteGround). `apply` is a CNAME to `medient.github.io`, **DNS only (grey cloud)**. Enforce HTTPS is on.
- Lesson learned: never add a custom domain in GitHub before DNS resolves, or GitHub redirects all traffic to a dead domain.
- Pages deploys can queue for minutes when GitHub Actions is degraded (githubstatus.com).
- Browsers cache pages ~10 minutes; tell the owner to use Cmd+Shift+R or a private window.

## Lead forms (both pages)
- Form posts (fetch, `no-cors`) to a Google Apps Script web app: `action` on `#leadForm`. The `/exec` URL is in both pages.
- The script is bound to the owner's Google Sheet (tab `Leads`), runs as **apply@medient.co.uk**, emails each lead to apply@ **from `submissions@medient.co.uk`** (a Gmail "Send mail as" alias), with reply-to set to the student.
- Columns are matched by header name, so the sheet can be reordered. Values are stored as plain text (phone numbers keep the leading 0 / +44).
- After editing `Code.gs`: paste it into Apps Script, then **Deploy → Manage deployments → edit → New version** (keeps the same URL). Workspace settings needed: "Execute as: Me", "Who has access: Anyone".
- Hidden fields: course, lead_tier, lead_score, gclid, gbraid, wbraid, gad_source, utm_* and landing_page. Honeypot field: `company`.
- **Scoring** (max 9): start (ASAP / Sep 2027 = 3, 2028+ = 1, exploring = 0) + budget (£8k+ = 3, lowest paid band = 2) + funding (parents = 3, self = 2, not sure = 1). Hot ≥7, Warm 4–6, Nurture ≤3. Thank-you conversion values: Hot £100, Warm £40, Nurture £10.
- **Disqualifiers** (no contact step, never a lead): budget under the minimum (medicine £5k, dentistry £4k) or "I'd need a loan".
- Before publishing any form change, test end to end at desktop and mobile widths and with reduced motion: answers, scoring, UTMs/gclid, the disqualify exit, and the redirect to thank-you.

## Tracking
- One file, `assets/tracking.js`, holds `GTM_ID` and `CLARITY_ID`. GA4, Google Ads conversions/remarketing and Meta are configured **inside GTM** by the agency (Bobo, Evan), not hard-coded in pages.
- Consent Mode v2: everything denied by default (UK GDPR/PECR); banner with equal-weight Accept all / Reject all; choice in localStorage `medient_consent_v1`; footer "Cookie settings" reopens it. Clarity only loads after consent.
- dataLayer events: `form_start`, `form_step`, `form_disqualified`, `generate_lead` (course, country, lead_tier, lead_score, value GBP, lead_id, `user_data` for enhanced conversions), `lead_thank_you` (thank-you page; then user_data is wiped from sessionStorage), `cta_click`, `whatsapp_click`, `cookie_consent_update`.
- Use absolute asset paths (`/assets/...`) so pages work at any depth, including `/preview/`.
- Offline conversions: every lead is also written to Bobo's **Offline Conversion Tracker** (Conversion Time, name, email, phone as 44…, GCLID, Course, Country; "Qualified?" filled by the team; column I is a formula, never written) and the **Lead Tracker** (Date, Full Name, Looking for, notes). Sheet ids are at the top of `Code.gs`; apply@ needs Editor access.
- Form captures first_name + last_name (the script also builds `name` = full name).

## Design system (approved by the owner; don't drift from it)
- **Font:** Rubik only (Google Fonts), matching the Medient Student Agreement.
- **Colours:** petrol `#11587B` (headings), deep `#0A3F5A` / `#072F44`, teal `#54BDB4` (accent), teal text `#157A73`, red `#EC3050` (buttons/CTAs), gold `#F6BB32` (offers), text `#333333`, muted `#6A6A6A`, background `#FAFAFA`.
- **Signature motifs:** teal/navy corner waves (from the agreement), and the **animated ECG heartbeat line**, which the owner loves and wants as a recurring theme (hero, Why-Medient section, 3-steps connector, fees offer card, final CTA, and pulse icons on section labels).
- **Hero:** ECG-paper grid, live heartbeat trace, drifting medical crosses, cursor light, word-by-word headline. The owner rejected underline-style highlights as "AI-looking".
- **Section order:** hero + stats → destinations ("Our students' top picks") → why Medient (dark) → reviews (white) → how it works (tint) → why Europe → course guide → consultation → what's included → fees → FAQ → final CTA (dark). Backgrounds alternate.
- **Destinations:** photo route cards with flight times, flip-board country names, Slovakia featured as "Most popular", swipeable on mobile.
- **Reviews:** all shown in Trustpilot style (green stars, Trustpilot mark) but **not linked** to the Trustpilot profile. Review wording is kept exactly as the students wrote it.
- All motion is disabled under `prefers-reduced-motion`.
- On mobile the form sits directly under the headline.
- The header logo scrolls to the top. Don't link visitors away from the landing pages; external links open in new tabs.

## Working rules agreed with the owner
- **Keep the page text exactly as it is** unless the owner asks for copy changes; redesigns change layout only. Verify by diffing the visible text against the previous version.
- **Preview first:** build big changes at `/preview/<page>/` (noindex), let the owner review, then copy over the live page and delete the preview.
- Photos: Unsplash free-licence images only (no Unsplash+). No fake "student" photos presented as real Medient students. Real Medient photos are preferred whenever the owner supplies them.
- Students are mostly British Pakistani/Indian, British African and British Arab; the pages should feel trustworthy for parents and relevant to students.
- Medicine and dentistry pages share the same design. A design change to one should be mirrored to the other, using the dentistry wording (GDC, £4k, Sep/Oct intakes, 5–6 yrs, DMD).

## Open items
- GTM container ID and Clarity ID to be added in `assets/tracking.js` (from Bobo / Medient).
- Google Ads final URLs should point at apply.medient.co.uk (the github.io URLs redirect).
- Pages are `noindex` (ad landing pages). Revisit when moving the main site here.
- Future: migrate the rest of medient.co.uk from WordPress into this repo.
