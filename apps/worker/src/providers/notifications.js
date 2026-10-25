import nodemailer from 'nodemailer';

export function emailProviderConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendNotificationEmail(to, subject, text) {
  if (!emailProviderConfigured()) throw Object.assign(new Error('SMTP is not configured.'), { code: 'EMAIL_NOT_CONFIGURED' });
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, requireTLS: process.env.SMTP_SECURE !== 'true' });
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
}

export async function sendTelegramMessage(chatId, text) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw Object.assign(new Error('Telegram is not configured.'), { code: 'TELEGRAM_NOT_CONFIGURED' });
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(8000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) throw Object.assign(new Error('Telegram delivery failed.'), { code: 'TELEGRAM_DELIVERY_FAILED' });
}
