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
  'Submitted at', 'course', 'lead_tier', 'lead_score', 'name', 'email', 'phone',
  'country', 'passport', 'start', 'budget', 'funding',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
  'gclid', 'gbraid', 'wbraid', 'gad_source', 'landing_page'
];

// -----------------------------------------------------------------------------

function doPost(e) {
  var data = (e && e.parameter) || {};

  // Spam trap: real visitors never see or fill the "company" field.
  if (data.company) return json_({ ok: true });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sheet = getSheet_();
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

function esc_(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
