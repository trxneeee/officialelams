// server/models/ConsumableInventory.js
const mongoose = require('mongoose');

const consumableInventorySchema = new mongoose.Schema({
  item_num: { type: Number, required: true, unique: true },
  location: { type: String, required: true },
  description: { type: String, required: true },
  quantity_opened: { type: Number, default: 0 },
  quantity_unopened: { type: Number, default: 0 },
  quantity_on_order: { type: Number, default: 0 },
  remarks: { type: String },
  experiment: { type: String },
  subject: { type: String },
  date_issued: { type: Date },
  issuance_no: { type: String },
  stock_alert: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ConsumableInventory', consumableInventorySchema);