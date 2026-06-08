const mongoose = require('mongoose');

const evaluationSchema = new mongoose.Schema({
  submissionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnswerSubmission', required: true, unique: true },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  marks: { type: Number, required: true },
  maxMarks: { type: Number, required: true },
  feedback: { type: String },
  evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', required: true },
  evaluatedAt: { type: Date, default: Date.now },
}, { timestamps: true });

evaluationSchema.index({ studentId: 1, subjectId: 1, topicId: 1 });

module.exports = mongoose.model('Evaluation', evaluationSchema);
