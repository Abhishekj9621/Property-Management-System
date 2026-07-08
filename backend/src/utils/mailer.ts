import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  if (env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
  } else {
    // No SMTP configured (e.g. local dev) — use the JSON transport so the
    // app keeps working end-to-end; emails are logged instead of sent.
    transporter = nodemailer.createTransport({ jsonTransport: true });
  }
  return transporter;
}

export async function sendMail(opts: { to: string; subject: string; html: string; text?: string }) {
  try {
    const t = getTransporter();
    const info = await t.sendMail({
      from: env.EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]+>/g, ""),
    });
    if (!env.SMTP_HOST) {
      logger.info(`📧 [dev-mail] to=${opts.to} subject="${opts.subject}" (SMTP not configured, not actually sent)`);
    }
    return info;
  } catch (err) {
    logger.error(`Failed to send email to ${opts.to}`, err);
    return null;
  }
}

export const emailTemplates = {
  bookingConfirmed: (params: { guestName: string; hotelName: string; bookingRef: string; checkIn: string; checkOut: string; total: string }) => ({
    subject: `Booking Confirmed — ${params.bookingRef} at ${params.hotelName}`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2>Booking Confirmed 🎉</h2>
      <p>Hi ${params.guestName},</p>
      <p>Your reservation at <strong>${params.hotelName}</strong> is confirmed.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#666">Booking Ref</td><td style="text-align:right"><strong>${params.bookingRef}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666">Check-in</td><td style="text-align:right">${params.checkIn}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Check-out</td><td style="text-align:right">${params.checkOut}</td></tr>
        <tr><td style="padding:6px 0;color:#666">Total</td><td style="text-align:right"><strong>${params.total}</strong></td></tr>
      </table>
      <p>We look forward to welcoming you!</p>
    </div>`,
  }),
  bookingCancelled: (params: { guestName: string; hotelName: string; bookingRef: string; reason?: string }) => ({
    subject: `Booking Cancelled — ${params.bookingRef}`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2>Booking Cancelled</h2>
      <p>Hi ${params.guestName},</p>
      <p>Your reservation <strong>${params.bookingRef}</strong> at ${params.hotelName} has been cancelled.</p>
      ${params.reason ? `<p>Reason: ${params.reason}</p>` : ""}
    </div>`,
  }),
  checkedOut: (params: { guestName: string; hotelName: string; bookingRef: string; total: string; loyaltyPoints: number }) => ({
    subject: `Thank you for staying with ${params.hotelName}`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2>We hope you enjoyed your stay!</h2>
      <p>Hi ${params.guestName},</p>
      <p>Your checkout for booking <strong>${params.bookingRef}</strong> is complete. Total billed: <strong>${params.total}</strong>.</p>
      <p>You earned <strong>${params.loyaltyPoints} loyalty points</strong> from this stay.</p>
      <p>We'd love your feedback — please leave a review!</p>
    </div>`,
  }),
  paymentReceipt: (params: { guestName: string; hotelName: string; bookingRef: string; amount: string; method: string }) => ({
    subject: `Payment Receipt — ${params.bookingRef}`,
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2>Payment Received</h2>
      <p>Hi ${params.guestName},</p>
      <p>We've received a payment of <strong>${params.amount}</strong> (${params.method}) for booking <strong>${params.bookingRef}</strong>.</p>
    </div>`,
  }),
  passwordReset: (params: { resetUrl: string }) => ({
    subject: "Reset your NovaStay password",
    html: `<div style="font-family:sans-serif;max-width:520px;margin:auto">
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password. This link expires in 30 minutes.</p>
      <p><a href="${params.resetUrl}">${params.resetUrl}</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    </div>`,
  }),
};
