const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 20000,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

exports.sendOTPEmail = async (toEmail, otp, audience = 'admin') => {
  const isStudent = audience === 'student';
  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: toEmail,
    subject: `DAMINI+ ${isStudent ? 'Student' : 'Admin'} Login OTP`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:32px;background:#0f172a;color:#fff;border-radius:12px">
        <h2 style="color:#a78bfa;margin-bottom:8px">DAMINI+ ${isStudent ? 'Student App' : 'Admin Panel'}</h2>
        <p style="color:#94a3b8;margin-bottom:24px">Your One-Time Password for login:</p>
        <div style="background:#1e293b;border:1px solid #334155;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:40px;font-weight:700;letter-spacing:12px;color:#a78bfa">${otp}</span>
        </div>
        <p style="color:#64748b;font-size:13px">This OTP is valid for <strong style="color:#fff">5 minutes</strong>. Do not share it with anyone.</p>
      </div>
    `,
  });
};
