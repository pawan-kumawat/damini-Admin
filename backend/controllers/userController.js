const User = require('../models/User');
const SubscriptionPurchase = require('../models/SubscriptionPurchase');
const { success, error } = require('../utils/response');

exports.getAll = async (req, res) => {
  try {
    const { search, boardId, classId, languageId, subscriptionId, page = 1, limit = 20 } = req.query;
    const filter = {};
    if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    if (boardId) filter.boardId = boardId;
    if (classId) filter.classId = classId;
    if (languageId) filter.languageId = languageId;
    if (subscriptionId) filter.subscriptionId = subscriptionId;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .populate('boardId', 'name')
        .populate('classId', 'name')
        .populate('languageId', 'name')
        .populate('subscriptionId', 'name price durationDays boardId classId')
        .sort({ createdAt: -1 })
        .skip(skip).limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    const [totalUsers, activeUsers, paidUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ subscriptionId: { $ne: null } }),
    ]);
    const revenue = await SubscriptionPurchase.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    return success(res, 'Users fetched', {
      users, total,
      page: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      stats: { totalUsers, activeUsers, paidUsers, revenue: revenue[0]?.total || 0 }
    });
  } catch (err) { return error(res, err.message, 500); }
};

exports.getOne = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate('boardId', 'name')
      .populate('classId', 'name')
      .populate('languageId', 'name')
      .populate('subscriptionId', 'name price durationDays boardId classId');
    if (!user) return error(res, 'User not found', 404);
    const purchases = await SubscriptionPurchase.find({ userId: user._id })
      .populate('subscriptionId', 'name price durationDays')
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup')
      .sort({ createdAt: -1 });
    return success(res, 'User fetched', { user, purchases });
  } catch (err) { return error(res, err.message, 500); }
};

exports.toggleStatus = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return error(res, 'User not found', 404);
    user.isActive = !user.isActive;
    await user.save();
    return success(res, `User ${user.isActive ? 'activated' : 'deactivated'}`, user);
  } catch (err) { return error(res, err.message, 500); }
};
