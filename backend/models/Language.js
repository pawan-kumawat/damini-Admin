const mongoose = require('mongoose');

const languageSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
  nativeName: { type: String },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Language', languageSchema);
