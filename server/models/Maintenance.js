// server/models/Maintenance.js
const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  maintenance_num: { type: Number, required: true, unique: true },
  equipment_num: { type: mongoose.Schema.Types.Mixed }, // may be number or string
  equipment_name: { type: String, default: '' },
  brand_model: { type: String, default: '' },
  identifier_type: { type: String, default: '' },
  identifier_number: { type: String, default: '' },
  month: { type: String, default: '' },

  // scheduled year for the maintenance occurrence (so maintenance can recur yearly)
  scheduledYear: { type: Number, default: (new Date()).getFullYear() },

  // mark-as-done / details
  date_accomplished: { type: Date },
  accomplished_by: { type: String, default: '' },

  // richer fields captured when marking done
  problemDescription: { type: String, default: '' },
  actionTaken: { type: String, default: '' },
  result: { type: String, enum: ['FIXED', 'Defective', 'Repair Pending', 'Requires External Service', ''], default: '' },
  conclusions: { type: String, default: '' },

  // checklist
  routineCleaning: { type: Boolean, default: false },
  partsAssessment: { type: Boolean, default: false },
  visualInspection: { type: Boolean, default: false },

  calibrationLink: { type: String, default: '' },

  // raw notes field for compatibility / extra metadata
  notes: { type: String, default: '' },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// update updatedAt on save
maintenanceSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Maintenance', maintenanceSchema);