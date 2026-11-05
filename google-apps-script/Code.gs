/**
 * Medient lead form handler.
 *
 * Receives enquiries from the medicine and dentistry landing pages,
 * adds each one as a row in this spreadsheet, and emails a notification.
 *
 * Setup: open your Google Sheet → Extensions → Apps Script, paste this file
 * in place of the default code, save, then Deploy → New deployment → Web app
 * (Execute as: Me, Who has access: Anyone). Copy the /exec URL into the
 * landing pages' form action.
 */

// ---- Settings you can change ------------------------------------------------

// Tab the leads go into. It is created if it doesn't exist.
var SHEET_NAME = 'Leads';

// Who gets the email. Leave empty to send it to the Google account that owns
// this script. Add more addresses separated by commas, e.g. 'a@x.com,b@x.com'.
var NOTIFY_EMAILS = '';

// Address the notification appears to come from. It must be set up as a
// "Send mail as" alias in the Gmail account that owns this script (Gmail →
// Settings → Accounts → Send mail as). If it isn't, the email is still sent,
// from the owner's own address, so no lead notification is ever lost.
var FROM_EMAIL = 'submissions@medient.co.uk';
var FROM_NAME = 'Medient website';

// Columns, in order, for a brand-new tab. If the tab already has a header row,
// the script matches fields to your existing headers by name instead, so you
// can reorder, rename to these names, or add your own columns freely.
var COLUMNS = [
  'Submitted at', 'course', 'lead_tier', 'lead_score', 'name', 'first_name', 'last_name', 'email', 'phone',
  'country', 'passport', 'start', 'budget', 'funding',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'gbraid', 'wbraid', 'gad_source', 'landing_page'
];

// Marketing sheets that each lead is also copied into (shared with Bobo).
// The Google account that owns this script needs edit access to both.
// Leave an id empty to switch that copy off.
var LEAD_TRACKER = { id: '1bJCfKKZZ8sO7P6kGpiBbQ-7g84EVIynm1rhT-vgEQ5Q', gid: 0 };
var OFFLINE_TRACKER = { id: '1EbrgEUE3_ExdrDm8gsjb6tA9kYmmKGb6uMA1fGssXk0', gid: 1055576812 };

// -----------------------------------------------------------------------------

function doPost(e) {
  var data = (e && e.parameter) || {};

  // Spam trap: real visitors never see or fill the "company" field.
  if (data.company) return json_({ ok: true });

  // Full name for the sheet, email and trackers. Older page versions sent only "name".
  data.first_name = clean_(data.first_name || data.name);
  data.last_name = clean_(data.last_name);
  data.name = [data.first_name, data.last_name].filter(String).join(' ');

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
    ensureColumns_(sheet);
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var now = new Date();

    var row = headers.map(function (h) {
      var key = String(h).trim();
      if (key === 'Submitted at') return now;
      var v = data[key];
      return v == null ? '' : String(v).slice(0, 1000);
    });

    var r = sheet.getLastRow() + 1;
    var range = sheet.getRange(r, 1, 1, row.length);
    // Store answers as plain text so phone numbers like +44... or 07... are
    // kept exactly and nothing a visitor types can run as a formula.
    range.setNumberFormats([row.map(function (v) {
      return v instanceof Date ? 'dd/mm/yyyy hh:mm' : '@';
    })]);
    range.setValues([row]);

    // Copies for the marketing team, inside the lock so two leads arriving at
    // once can't land on the same row. Each is separate, so one failing never
    // affects the lead itself or the other copy.
    try { addToLeadTracker_(data, now); } catch (err) { console.error('Lead tracker failed: ' + err); }
    try { addToOfflineTracker_(data, now); } catch (err) { console.error('Offline tracker failed: ' + err); }
  } finally {
    lock.releaseLock();
  }

  try {
    sendEmail_(data, now);
  } catch (err) {
    console.error('Email failed: ' + err);
  }


  return json_({ ok: true });
}

// Visiting the web app URL in a browser shows this, which confirms it's live.
function doGet() {
  return ContentService.createTextOutput('Medient form handler is running.');
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, COLUMNS.length).setValues([COLUMNS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function sendEmail_(d, when) {
  var to = NOTIFY_EMAILS || Session.getEffectiveUser().getEmail();
  var subject = 'New ' + (d.lead_tier || '') + ' lead: ' + (d.name || 'Unknown') +
    ' (' + (d.course || 'Enquiry') + ')';

  var rows = [
    ['Course', d.course], ['Lead tier', d.lead_tier + ' (score ' + (d.lead_score || 0) + '/9)'],
    ['Name', d.name], ['Email', d.email], ['Mobile', d.phone],
    ['Country', d.country], ['Passport', d.passport], ['Start', d.start],
    ['Budget', d.budget], ['Funding', d.funding],
    ['Source', [d.utm_source, d.utm_medium, d.utm_campaign].filter(String).join(' / ')],
    ['Keyword', d.utm_term], ['Google click ID', d.gclid || d.gbraid || d.wbraid],
    ['Page', d.landing_page],
    ['Submitted', Utilities.formatDate(when, Session.getScriptTimeZone(), 'dd MMM yyyy, HH:mm')]
  ].filter(function (r) { return r[1]; });

  var html = '<table style="border-collapse:collapse;font:14px Arial,sans-serif">' +
    rows.map(function (r) {
      return '<tr><td style="padding:6px 14px 6px 0;color:#5E6677;vertical-align:top">' + esc_(r[0]) +
        '</td><td style="padding:6px 0;font-weight:bold">' + esc_(r[1]) + '</td></tr>';
    }).join('') + '</table>';
  var text = rows.map(function (r) { return r[0] + ': ' + r[1]; }).join('\n');

  var opts = { htmlBody: html, name: FROM_NAME };
  if (d.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) opts.replyTo = d.email;
  var aliases = GmailApp.getAliases().map(function (a) { return a.toLowerCase(); });
  if (FROM_EMAIL && aliases.indexOf(FROM_EMAIL.toLowerCase()) !== -1) opts.from = FROM_EMAIL;
  else console.warn(FROM_EMAIL + ' is not a Send-mail-as alias yet; sending from the owner address.');
  GmailApp.sendEmail(to, subject, text, opts);
}

function clean_(s) {
  return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, 100);
}

// Adds any columns from COLUMNS that an existing Leads tab is missing (e.g.
// first_name / last_name), at the end, so older sheets keep working.
function ensureColumns_(sheet) {
  var last = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, last).getValues()[0].map(function (h) { return String(h).trim(); });
  var missing = COLUMNS.filter(function (c) { return headers.indexOf(c) === -1; });
  if (missing.length) sheet.getRange(1, last + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
}

function tab_(cfg) {
  var ss = SpreadsheetApp.openById(cfg.id);
  var tabs = ss.getSheets();
  for (var i = 0; i < tabs.length; i++) if (tabs[i].getSheetId() === cfg.gid) return tabs[i];
  return tabs[0];
}

// First empty row judged by column A only, so formula columns further right
// (like the offline sheet's auto ECL rank) don't push new rows down.
function nextRow_(sheet) {
  var n = Math.max(sheet.getLastRow(), 1);
  var col = sheet.getRange(1, 1, n, 1).getValues();
  for (var r = col.length; r >= 1; r--) if (String(col[r - 1][0]).trim() !== '') return r + 1;
  return 2;
}

// UK mobile → 44XXXXXXXXXX (the format already used in the offline sheet).
function ukPhone_(p) {
  var d = String(p || '').replace(/\D/g, '');
  if (d.indexOf('00') === 0) d = d.slice(2);
  if (d.indexOf('44') === 0) return d;
  if (d.indexOf('0') === 0) return '44' + d.slice(1);
  if (d.length === 10 && d.charAt(0) === '7') return '44' + d;
  return d;
}

// Lead Tracker: Date | Full Name | Relevence | Qualified | Looking for | Intent | Lead Status | Further notes
// The team fills in the judgement columns; the form fills Date, Full Name and Looking for.
function addToLeadTracker_(d, when) {
  if (!LEAD_TRACKER.id) return;
  var sh = tab_(LEAD_TRACKER), r = nextRow_(sh);
  var looking = 'Study ' + (d.course || 'Medicine') + (d.country && d.country !== 'Not sure yet' ? ' in ' + d.country : '');
  sh.getRange(r, 1).setValue(when);
  sh.getRange(r, 2).setNumberFormat('@').setValue(d.name);
  sh.getRange(r, 5).setNumberFormat('@').setValue(looking);
  sh.getRange(r, 8).setNumberFormat('@').setValue('Website form (' + (d.lead_tier || '') + ' lead' + (d.utm_campaign ? ', ' + d.utm_campaign : '') + ')');
}

// Offline Conversion Tracker: Conversion Time | First Name | Email | Phone (+44) | GCLID | Course | Country | Qualified?
// "Qualified?" is left for the team; column I is a formula and is never touched.
function addToOfflineTracker_(d, when) {
  if (!OFFLINE_TRACKER.id) return;
  var sh = tab_(OFFLINE_TRACKER), r = nextRow_(sh);
  sh.getRange(r, 1).setValue(when);
  sh.getRange(r, 2, 1, 6).setNumberFormat('@').setValues([[
    d.name, String(d.email || '').trim().toLowerCase(), ukPhone_(d.phone), d.gclid || '', d.course || '', d.country || ''
  ]]);
}

function esc_(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Run this once from the editor (select "authorize" next to Run) to grant the
// Gmail permission the notification email needs. It also lists the
// Send-mail-as aliases Gmail sees, so you can check submissions@ is there.
function authorize() {
  console.log('Aliases: ' + JSON.stringify(GmailApp.getAliases()));
  [['Lead tracker', LEAD_TRACKER], ['Offline tracker', OFFLINE_TRACKER]].forEach(function (t) {
    if (!t[1].id) return;
    try {
      var sh = tab_(t[1]);
      console.log(t[0] + ': OK, tab "' + sh.getName() + '", next row ' + nextRow_(sh) + ', headers ' + JSON.stringify(sh.getRange(1, 1, 1, 8).getValues()[0]));
    } catch (err) { console.error(t[0] + ': NO ACCESS. Share the sheet with this account as Editor. ' + err); }
  });
}
