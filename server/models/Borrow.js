// server/models/Borrow.js
const mongoose = require('mongoose');

const identifierSchema = new mongoose.Schema({
  identifier: { type: String },
  status: { type: String, default: 'Borrowed' }, // Borrowed, Returned, Damaged, etc.
  condition_notes: { type: String },
  date_returned: { type: Date }
}, { _id: false });

const borrowItemSchema = new mongoose.Schema({
  item_id: { type: String }, // can be numeric string or object id depending on inventory
  item_name: { type: String, required: true },
  item_type: { type: String, enum: ['consumable', 'non-consumable'], required: true },
  quantity: { type: Number, required: true, default: 1 },
  status: { type: String, default: 'Borrowed' }, // Borrowed, Returned, Partially Returned, etc.
  identifiers: [identifierSchema],
  date_borrowed: { type: Date },
  date_returned: { type: Date },
  return_condition: { type: String },
  damage_report: { type: String },
  lacking_items: { type: String },
  notes: { type: String }
});

const groupMemberSchema = new mongoose.Schema({
  name: String,
  id: String
}, { _id: false });

const borrowSchema = new mongoose.Schema({
  borrow_id: { type: Number, required: true, unique: true },
  borrow_type: { type: String, enum: ['Walk-In', 'Reservation'], required: true },
  user_type: { type: String, enum: ['Individual', 'Group', 'Faculty'], required: true },
  borrow_user: { type: String }, // display name
  course: String,
  group_number: String,
  group_leader: String,
  group_leader_id: String,
  instructor: String,
  subject: String,
  schedule: String,
  items: [borrowItemSchema],
  status: { type: String, default: 'Borrowed' },
  reservation_code: String,
  date_borrowed: { type: Date, default: Date.now },
  date_returned: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  managed_by: { type: String }, // email of Student Assistant
  managed_name: { type: String }, // display name
  group_members: [groupMemberSchema] // <-- FIX: Add group_members array
});

// update timestamps on save
borrowSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Borrow', borrowSchema);