const Subscription = require('../models/Subscription');
const SubscriptionPurchase = require('../models/SubscriptionPurchase');
const { success, error } = require('../utils/response');

exports.getAll = async (req, res) => {
  try {
    const filter = {};
    if (req.query.boardId) filter.boardId = req.query.boardId;
    if (req.query.classId) filter.classId = req.query.classId;
    const subs = await Subscription.find(filter)
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup')
      .sort({ createdAt: -1 });
    return success(res, 'Subscriptions fetched', subs);
  } catch (err) { return error(res, err.message, 500); }
};

exports.create = async (req, res) => {
  try {
    if (!req.body.boardId || !req.body.classId) return error(res, 'Board and Class are required');
    const sub = await Subscription.create(req.body);
    return success(res, 'Subscription created', sub, 201);
  } catch (err) { return error(res, err.message, 500); }
};

exports.update = async (req, res) => {
  try {
    if (!req.body.boardId || !req.body.classId) return error(res, 'Board and Class are required');
    const sub = await Subscription.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!sub) return error(res, 'Subscription not found', 404);
    return success(res, 'Subscription updated', sub);
  } catch (err) { return error(res, err.message, 500); }
};

exports.remove = async (req, res) => {
  try {
    await Subscription.findByIdAndDelete(req.params.id);
    return success(res, 'Subscription deleted');
  } catch (err) { return error(res, err.message, 500); }
};

exports.getPurchases = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [purchases, total] = await Promise.all([
      SubscriptionPurchase.find({ status: 'success' })
        .populate('userId', 'name email')
        .populate('subscriptionId', 'name price durationDays')
        .populate('boardId', 'name fullName')
        .populate('classId', 'name gradeGroup')
        .sort({ createdAt: -1 })
        .skip(skip).limit(parseInt(limit)),
      SubscriptionPurchase.countDocuments({ status: 'success' })
    ]);
    return success(res, 'Purchases fetched', { purchases, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) { return error(res, err.message, 500); }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const User = require('../models/User');
    const [totalUsers, activeUsers, paidUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ subscriptionId: { $ne: null } }),
    ]);
    const revenue = await SubscriptionPurchase.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const recentPurchases = await SubscriptionPurchase.find({ status: 'success' })
      .populate('userId', 'name email')
      .populate('subscriptionId', 'name price durationDays')
      .populate('boardId', 'name fullName')
      .populate('classId', 'name gradeGroup')
      .sort({ createdAt: -1 }).limit(5);

    const Board = require('../models/Board');
    const Subject = require('../models/Subject');
    const Question = require('../models/Question');
    const [totalBoards, totalSubjects, totalQuestions] = await Promise.all([
      Board.countDocuments(),
      Subject.countDocuments(),
      Question.countDocuments(),
    ]);

    return success(res, 'Stats fetched', {
      totalUsers, activeUsers, paidUsers,
      revenue: revenue[0]?.total || 0,
      recentPurchases,
      totalBoards, totalSubjects, totalQuestions
    });
  } catch (err) { return error(res, err.message, 500); }
};
