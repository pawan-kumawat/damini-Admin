const mongoose = require('mongoose');

const questionTranslationSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  languageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
  question: { type: String, required: true },
  answer: { type: String, required: true },
  steps: [{ type: String }],
}, { timestamps: true });

questionTranslationSchema.index({ questionId: 1, languageId: 1 }, { unique: true });

module.exports = mongoose.model('QuestionTranslation', questionTranslationSchema);
