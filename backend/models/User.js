const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, required: true, unique: true, lowercase: true },
  otp: { type: String },
  otpExpiry: { type: Date },
  otpLastSent: { type: Date },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board' },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
  languageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Language' },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription' },
  subscriptionExpiry: { type: Date },
  lastVisitedSubjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  lastVisitedTopicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
  lastVisitedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
