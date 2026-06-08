const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { sendOTPEmail } = require('../utils/mailer');
const { success, error } = require('../utils/response');

const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN });

// In-memory OTP store: { email: { otp, expiresAt } }
const otpStore = {};

// Step 1: Admin enters email → send OTP
exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return error(res, 'Email is required');

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin || !admin.isActive) return error(res, 'No active admin found with this email', 401);

    // Throttle: resend after 60s
    const existing = otpStore[email.toLowerCase()];
    if (existing) {
      const secondsLeft = Math.ceil((existing.expiresAt - Date.now()) / 1000);
      const resendAfter = parseInt(process.env.OTP_RESEND_AFTER) || 60;
      const sentAgo = (parseInt(process.env.OTP_EXPIRY) || 300) - secondsLeft;
      if (sentAgo < resendAfter) {
        return error(res, `Please wait ${resendAfter - sentAgo} seconds before requesting a new OTP`);
      }
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiryMs = (parseInt(process.env.OTP_EXPIRY) || 300) * 1000;
    otpStore[email.toLowerCase()] = { otp, expiresAt: Date.now() + expiryMs };

    await sendOTPEmail(email.toLowerCase(), otp);

    return success(res, 'OTP sent to your email');
  } catch (err) {
    console.error('sendOTP error:', err.message);
    return error(res, 'Failed to send OTP. Check email config.', 500);
  }
};

// Step 2: Admin enters OTP → verify and login
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return error(res, 'Email and OTP are required');

    const record = otpStore[email.toLowerCase()];
    if (!record) return error(res, 'OTP not found. Please request a new one.', 401);
    if (Date.now() > record.expiresAt) {
      delete otpStore[email.toLowerCase()];
      return error(res, 'OTP has expired. Please request a new one.', 401);
    }
    if (record.otp !== otp.trim()) return error(res, 'Invalid OTP', 401);

    delete otpStore[email.toLowerCase()];

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin || !admin.isActive) return error(res, 'Admin not found', 401);

    const token = generateToken(admin._id);
    return success(res, 'Login successful', {
      token,
      admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role }
    });
  } catch (err) {
    return error(res, err.message, 500);
  }
};

exports.getProfile = async (req, res) => {
  return success(res, 'Profile fetched', req.admin);
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const admin = await Admin.findById(req.admin._id);
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) return error(res, 'Current password is incorrect');
    admin.password = newPassword;
    await admin.save();
    return success(res, 'Password changed successfully');
  } catch (err) {
    return error(res, err.message, 500);
  }
};
