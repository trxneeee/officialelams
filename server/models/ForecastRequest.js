const mongoose = require('mongoose');

const forecastItemSchema = new mongoose.Schema({
  item_name: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  notes: { type: String, default: '' }
});

const forecastRequestSchema = new mongoose.Schema({
  requester_email: { type: String, required: true },
  requester_name: { type: String, required: true },
  school: { type: String, default: '' },
  school_year: { type: String, default: '' },
  semester: { type: String, enum: ['1st', '2nd'], default: '1st' },
  subject: { type: String, default: '' }, // Subject ID or name
  items: [forecastItemSchema],
  status: { 
    type: String, 
    enum: ['Pending', 'Approved', 'Rejected'], 
    default: 'Pending' 
  },
  custodian_email: { type: String, default: '' },
  custodian_name: { type: String, default: '' },
  date_approved: { type: Date },
  date_rejected: { type: Date },
  rejection_reason: { type: String, default: '' },
  date_requested: { type: Date, default: Date.now }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('ForecastRequest', forecastRequestSchema);