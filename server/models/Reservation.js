const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: String, required: true },
  sender_name: { type: String },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  seen_by: { type: [String], default: [] }
});

const requestedItemSchema = new mongoose.Schema({
  item_name: { type: String, required: true },
  quantity: { type: Number, required: true },
  item_type: { 
    type: String, 
    required: true, 
    enum: ['consumable', 'non-consumable'] 
  }
});

const assignedItemSchema = new mongoose.Schema({
  requested_item_index: { type: Number, required: true },
  item_id: { type: String, required: true },
  item_name: { type: String, required: true },
  item_type: { 
    type: String, 
    required: true, 
    enum: ['consumable', 'non-consumable'] 
  },
  identifier: { type: String },
  quantity: { type: Number, required: true },
  assigned_by: { type: String, required: true },
  date_assigned: { type: Date, default: Date.now }
});

const reservationSchema = new mongoose.Schema({
  reservation_id: { type: Number, required: true, unique: true },
  reservation_code: { type: String, required: true, unique: true },
  subject: { type: String, required: true },
  instructor: { type: String, required: true },
  instructor_email: { type: String, required: true },
  schedule: { type: String, required: true },
  startTime: { type: String },
  endTime: { type: String },
  course: { type: String, required: true },
  room: { type: String, required: true },
  user_type: { type: String, enum: ['Individual', 'Group', 'Faculty'], default: 'Group' },
  group_count: { type: Number, required: true, min: 1 },
  group_members: [{
    name: { type: String, default: "" },
    id: { type: String, default: "" }
  }],
  needsItems: { type: Boolean, default: true },
  requested_items: [requestedItemSchema],
  assigned_items: [assignedItemSchema],
  messages: [messageSchema],
  status: { 
    type: String, 
    default: 'Pending',
    enum: ['Pending', 'Approved', 'Assigned', 'Rejected', 'Completed', 'Cancelled']
  },
  date_created: { type: Date, default: Date.now },
  date_approved: { type: Date },
  date_assigned: { type: Date },
  date_completed: { type: Date },
  notes: String,
  edits: [{
    editedBy: { type: String },
    editedName: { type: String },
    editedAt: { type: Date, default: Date.now },
    reason: { type: String },
    previous: { type: mongoose.Schema.Types.Mixed } // store previous reservation snapshot
  }]
});
 
module.exports = mongoose.model('Reservation', reservationSchema);