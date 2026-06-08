const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
  boardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true },
  classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  languageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Language' }],
  languageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Language' },
  name: { type: String, required: true },
  iconUrl: { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Subject', subjectSchema);
