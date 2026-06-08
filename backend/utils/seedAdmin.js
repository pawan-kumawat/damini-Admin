const Admin = require('../models/Admin');

function parseAdminEmails() {
  const raw = process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || 'admin@daminiplus.com';
  return String(raw)
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map(email => email.trim().toLowerCase())
    .filter(Boolean);
}

const seedAdmin = async () => {
  try {
    const emails = parseAdminEmails();
    for (const email of emails) {
      const existing = await Admin.findOne({ email });
      if (existing) continue;

      await Admin.create({
        name: email === emails[0] ? 'Super Admin' : 'Admin',
        email,
        password: process.env.ADMIN_PASSWORD || 'Admin@123',
      });
      console.log(`Admin seeded: ${email}`);
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
};

module.exports = seedAdmin;
