const mongoose = require('mongoose');

const answerSubmissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  imageUrl: { type: String, required: true },
  status: {
    type: String,
    enum: ['submitted', 'under_review', 'evaluated', 'rejected'],
    default: 'submitted',
  },
  submittedAt: { type: Date, default: Date.now },
}, { timestamps: true });

answerSubmissionSchema.index({ studentId: 1, questionId: 1 }, { unique: true });
answerSubmissionSchema.index({ studentId: 1, subjectId: 1, topicId: 1 });

module.exports = mongoose.model('AnswerSubmission', answerSubmissionSchema);
