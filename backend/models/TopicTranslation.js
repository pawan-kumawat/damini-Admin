const mongoose = require('mongoose');

const topicTranslationSchema = new mongoose.Schema({
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic', required: true },
  languageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
  name: { type: String, required: true },
  description: { type: String },
}, { timestamps: true });

topicTranslationSchema.index({ topicId: 1, languageId: 1 }, { unique: true });

module.exports = mongoose.model('TopicTranslation', topicTranslationSchema);
