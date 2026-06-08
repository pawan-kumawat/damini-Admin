const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true',
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

function otpHtml(otp, isStudent) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#0f172a;color:#fff;border-radius:12px">
      <h2 style="color:#a78bfa;margin-bottom:8px">DAMINI+ ${isStudent ? 'Student App' : 'Admin Panel'}</h2>
      <p style="color:#94a3b8;margin-bottom:24px">Your One-Time Password for login:</p>
      <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px">
        <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#a78bfa">${otp}</span>
      </div>
      <p style="color:#64748b;font-size:13px">This OTP is valid for <strong style="color:#fff">5 minutes</strong>. Do not share it with anyone.</p>
    </div>
  `;
}

async function sendViaResend({ toEmail, subject, html }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || process.env.EMAIL_FROM || 'DAMINI+ <onboarding@resend.dev>',
      to: [toEmail],
      subject,
      html,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || `Resend email failed with ${response.status}`);
  }
  return data;
}

exports.sendOTPEmail = async (toEmail, otp, audience = 'admin') => {
  const isStudent = audience === 'student';
  const subject = `DAMINI+ ${isStudent ? 'Student' : 'Admin'} Login OTP`;
  const html = otpHtml(otp, isStudent);

  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ toEmail, subject, html });
  }

  return transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject,
    html,
  });
};
