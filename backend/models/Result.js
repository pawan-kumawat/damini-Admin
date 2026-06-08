const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
  marksObtained: { type: Number, default: 0 },
  totalMarks: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  grade: { type: String },
  generatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

resultSchema.index({ studentId: 1, subjectId: 1, topicId: 1 });

module.exports = mongoose.model('Result', resultSchema);
