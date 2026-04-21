const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  code: { type: String, default: '' },
  name: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Course', courseSchema);
