const mongoose = require('mongoose');

const boardSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  fullName: { type: String },
  languageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Language' }],
  defaultLanguageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Language' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Board', boardSchema);
