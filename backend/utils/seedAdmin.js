const Admin = require('../models/Admin');

const seedAdmin = async () => {
  try {
    const existing = await Admin.findOne({ email: process.env.ADMIN_EMAIL || 'admin@daminiplus.com' });
    if (!existing) {
      await Admin.create({
        name: 'Super Admin',
        email: process.env.ADMIN_EMAIL || 'admin@daminiplus.com',
        password: process.env.ADMIN_PASSWORD || 'Admin@123',
      });
      console.log('✅ Admin seeded: admin@daminiplus.com / Admin@123');
    }
  } catch (err) {
    console.error('Seed error:', err.message);
  }
};

module.exports = seedAdmin;
