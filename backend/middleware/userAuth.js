const jwt = require('jsonwebtoken');
const User = require('../models/User');

const userAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ status: false, message: 'Unauthorized: No token provided', data: null });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type && decoded.type !== 'user') {
      return res.status(401).json({ status: false, message: 'Unauthorized: Invalid user token', data: null });
    }

    const user = await User.findById(decoded.id)
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup')
      .populate('languageId', 'name nativeName code')
      .populate('subscriptionId', 'name price durationDays boardId classId');

    if (!user || !user.isActive) {
      return res.status(401).json({ status: false, message: 'Unauthorized: User not active', data: null });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ status: false, message: 'Unauthorized: Invalid token', data: null });
  }
};

module.exports = userAuth;
