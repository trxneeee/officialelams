const mongoose = require('mongoose');

const requiredItemSchema = new mongoose.Schema({
  item_name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  item_type: { type: String, enum: ['consumable', 'non-consumable'], required: true },
  item_id: { type: String } // Optional reference to inventory item number
});

const subjectSchema = new mongoose.Schema({
  code: { type: String, default: '' },
  name: { type: String, required: true, unique: true },
  courses: [{ type: String }], // Array of course IDs (programs)
  required_items: [requiredItemSchema], // Array of required items for this subject
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Subject', subjectSchema);