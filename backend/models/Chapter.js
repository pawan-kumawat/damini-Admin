const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject', required: true },
  name: { type: String, required: true },
  iconUrl: { type: String },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

chapterSchema.index({ boardId: 1, classId: 1, subjectId: 1, isActive: 1 });

module.exports = mongoose.model('Chapter', chapterSchema);
