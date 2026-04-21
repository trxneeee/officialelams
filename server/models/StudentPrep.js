const mongoose = require('mongoose');

const groupMemberSchema = new mongoose.Schema({
  name: { type: String, default: "" },
  id: { type: String, default: "" }
}, { _id: false });

const studentPrepSchema = new mongoose.Schema({
  reservation_ref: { type: mongoose.Schema.Types.ObjectId, ref: 'Reservation', index: true, required: false },
  reservation_code: { type: String, index: true, required: true },
  group_barcode: { type: String, index: true, required: true, unique: true },
  user_type: { type: String, enum: ['Individual', 'Group'], required: true },
  borrower_name: { type: String, default: "" },       // for Individual
  group_number: { type: String, default: "" },        // for Group
  group_leader: { type: String, default: "" },
  group_leader_id: { type: String, default: "" },
  group_members: [groupMemberSchema],
  notes: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

studentPrepSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('StudentPrep', studentPrepSchema);
