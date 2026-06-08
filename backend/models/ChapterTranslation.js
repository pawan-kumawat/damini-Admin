const mongoose = require('mongoose');

const chapterTranslationSchema = new mongoose.Schema({
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  languageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Language', required: true },
  name: { type: String, required: true },
}, { timestamps: true });

chapterTranslationSchema.index({ chapterId: 1, languageId: 1 }, { unique: true });

module.exports = mongoose.model('ChapterTranslation', chapterTranslationSchema);
