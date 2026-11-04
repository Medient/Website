# Medient website

Static HTML site. No build step and no dependencies. Hosted on Netlify, deployed automatically from this repo.

| Path | Page |
|---|---|
| `/` | Simple chooser linking to both landing pages |
| `/medicine/` | Medicine landing page (`medicine/index.html`) |
| `/medicine/thank-you` | Shown after the medicine form is submitted |
| `/dentistry/` | Dentistry landing page (`dentistry/index.html`) |
| `/dentistry/thank-you` | Shown after the dentistry form is submitted |

Each page keeps its CSS and JS inline. `netlify.toml` publishes the repo root with no build command.

## Forms
Both forms use Netlify Forms (`data-netlify="true"`), so they only work on Netlify. Enquiries arrive in Netlify under Site → Forms as `medicine-enquiry` and `dentistry-enquiry`.

## Google Ads conversion tracking
In each `thank-you.html`, replace `AW-XXXXXXXXXX/YYYYYYYYYY` with your conversion ID and label, then uncomment the script block. Lead value by tier: Hot £100, Warm £40, Nurture £10.
