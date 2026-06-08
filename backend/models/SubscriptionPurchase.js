const mongoose = require('mongoose');

const subscriptionPurchaseSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', required: true },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  amount: { type: Number, required: true },
  paymentId: { type: String },
  status: { type: String, enum: ['pending', 'success', 'failed'], default: 'success' },
  expiryDate: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('SubscriptionPurchase', subscriptionPurchaseSchema);
