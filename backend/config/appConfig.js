module.exports = {
  OTP_EXPIRY: parseInt(process.env.OTP_EXPIRY) || 300,
  OTP_RESEND_AFTER: parseInt(process.env.OTP_RESEND_AFTER) || 60,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
};
