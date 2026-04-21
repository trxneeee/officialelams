// server/models/NonConsumableInventory.js
const mongoose = require('mongoose');

const nonConsumableInventorySchema = new mongoose.Schema({
  equipment_num: { type: Number, required: true, unique: true },
  equipment_name: { type: String, required: true },
  facility: { type: String, required: true },
  brand_model: { type: String, required: true },
  total_qty: { type: Number, required: true },
  borrowed: { type: Number, default: 0 },
  identifier_type: { type: String },
  identifiers: [{ type: String }], // FIXED: Change to array of strings
  statuses: [{ type: String }],
  // Split location into room and shelf_no for more structured data
  room: { type: String, default: "" },
  shelf_no: { type: String, default: "" },
  soft_hard: { type: String },
  e_location: { type: String },
  bat_type: { type: String },
  bat_qty: { type: Number },
  bat_total: { type: Number },
  yes_or_no: { type: String },
  preventive_or_calibration: { type: String },
  inhouse_outsourced: { type: String },
  month: { type: String },

  // New utilization fields
  total_usage_minutes: { type: Number, default: 0 }, // accumulated minutes of use
  usage_logs: [{
    borrow_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Borrow', required: false },
    borrow_record_ref: { type: String, required: false }, // fallback string id or code
    item_id: { type: String }, // item identifier / num used
    identifier: { type: String }, // <-- NEW: specific identifier (serial/control) this log is for
    minutes: { type: Number, default: 0 },
    borrowed_at: { type: Date },
    returned_at: { type: Date },
    managed_by: { type: String } // who processed return / borrow
  }],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NonConsumableInventory', nonConsumableInventorySchema);