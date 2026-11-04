# Medient website

Static HTML site. No build step and no dependencies. Hosted on GitHub Pages from the `main` branch.

| Path | Page |
|---|---|
| `/` | Simple chooser linking to both landing pages |
| `/medicine/` | Medicine landing page (`medicine/index.html`) |
| `/medicine/thank-you` | Shown after the medicine form is submitted |
| `/dentistry/` | Dentistry landing page (`dentistry/index.html`) |
| `/dentistry/thank-you` | Shown after the dentistry form is submitted |

Each page keeps its CSS and JS inline.

## Forms
Both forms post to a Google Apps Script web app (`google-apps-script/Code.gs`), which is attached to the Medient leads Google Sheet. Each enquiry is added as a row in the `Leads` tab and emailed to the script owner.

The script's `/exec` URL goes in the `action` attribute of `<form id="leadForm">` in `medicine/index.html` and `dentistry/index.html`. After changing `Code.gs`, paste it into the Apps Script editor and use Deploy → Manage deployments → Edit → New version, so the URL stays the same.

## Google Ads conversion tracking
In each `thank-you.html`, replace `AW-XXXXXXXXXX/YYYYYYYYYY` with your conversion ID and label, then uncomment the script block. Lead value by tier: Hot £100, Warm £40, Nurture £10.
