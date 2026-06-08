const mongoose = require('mongoose');

const topicSchema = new mongoose.Schema({
  chapterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chapter', required: true },
  name: { type: String, required: true },
  description: { type: String },
  notes: { type: String },
  pdfUrls: [{ type: String }],
  videoUrls: [{ type: String }],
  content: { type: String },
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Topic', topicSchema);
