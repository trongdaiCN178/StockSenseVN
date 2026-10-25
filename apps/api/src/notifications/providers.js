import nodemailer from 'nodemailer';
import { ApiError } from '../errors.js';

export function emailProviderConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendVerificationEmail(to, code) {
  if (!emailProviderConfigured()) throw new ApiError(503, 'EMAIL_PROVIDER_NOT_CONFIGURED', 'Email verification is unavailable because SMTP is not configured.');
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, requireTLS: process.env.SMTP_SECURE !== 'true' });
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject: 'Mã xác minh StockSense VN',
    text: `Mã xác minh email StockSense VN của bạn là ${code}. Mã hết hạn sau 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.` });
}

export async function sendPasswordResetEmail(to, resetUrl) {
  if (!emailProviderConfigured()) throw new ApiError(503, 'EMAIL_PROVIDER_NOT_CONFIGURED', 'Password reset email is unavailable because SMTP is not configured.');
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, requireTLS: process.env.SMTP_SECURE !== 'true' });
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject: 'Đặt lại mật khẩu StockSense VN',
    text: `Bạn đã yêu cầu đặt lại mật khẩu StockSense VN. Mở liên kết dùng một lần trong vòng 30 phút: ${resetUrl}\nNếu bạn không yêu cầu, hãy bỏ qua email này.` });
}

export function telegramProviderConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME && process.env.TELEGRAM_WEBHOOK_SECRET);
}

export async function sendTelegramMessage(chatId, text) {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new ApiError(503, 'TELEGRAM_PROVIDER_NOT_CONFIGURED', 'Telegram delivery is not configured.');
  const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }), signal: AbortSignal.timeout(8000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || result?.ok !== true) throw new ApiError(502, 'TELEGRAM_DELIVERY_FAILED', 'Telegram could not deliver the message.');
}

export async function sendTestEmail(to) {
  if (!emailProviderConfigured()) throw new ApiError(503, 'EMAIL_PROVIDER_NOT_CONFIGURED', 'Email delivery is not configured.');
  const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, requireTLS: process.env.SMTP_SECURE !== 'true' });
  await transport.sendMail({ from: process.env.SMTP_FROM, to, subject: 'StockSense VN · gửi thử', text: 'Kênh email StockSense VN đã kết nối thành công.' });
}
