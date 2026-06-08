const mongoose = require('mongoose');

const studentProgressSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
  completedQuestions: { type: Number, default: 0 },
  totalQuestions: { type: Number, default: 0 },
  completedTopics: { type: Number, default: 0 },
  totalTopics: { type: Number, default: 0 },
  completedSubjects: { type: Number, default: 0 },
  totalSubjects: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  lastActivityAt: { type: Date, default: Date.now },
}, { timestamps: true });

studentProgressSchema.index({ studentId: 1, subjectId: 1, topicId: 1 });

module.exports = mongoose.model('StudentProgress', studentProgressSchema);
