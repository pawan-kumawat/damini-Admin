const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  steps: [{ type: String }],
  sortOrder: { type: Number, default: 0 },
  marks: { type: Number, default: 1 },
  difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

questionSchema.index({ boardId: 1, classId: 1, topicId: 1, isActive: 1 });

module.exports = mongoose.model('Question', questionSchema);
