const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

const adminAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ status: false, message: 'No token provided', data: null });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await Admin.findById(decoded.id).select('-password');
    if (!admin || !admin.isActive) {
      return res.status(401).json({ status: false, message: 'Unauthorized', data: null });
    }
    req.admin = admin;
    next();
  } catch (err) {
    return res.status(401).json({ status: false, message: 'Invalid token', data: null });
  }
};

module.exports = adminAuth;
