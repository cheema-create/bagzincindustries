const nodemailer = require('nodemailer');
let tx = null;
if (process.env.SMTP_HOST) {
  const port = Number(process.env.SMTP_PORT || 465);
  tx = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined });
}
async function notify({ subject, text, replyTo, attachments }) {
  const to = process.env.MAIL_TO || process.env.SMTP_USER;
  if (!tx || !to) { console.log('[mail skipped – SMTP not configured]', subject); return false; }
  try { await tx.sendMail({ from: `"Bagzinic Website" <${process.env.SMTP_USER}>`, to, replyTo, subject, text, attachments }); return true; }
  catch (e) { console.error('[mail error]', e.message); return false; }
}
module.exports = { notify };
