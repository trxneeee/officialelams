// server/index.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const http = require('http');

// Import models
const User = require('./models/User');
const NonConsumableInventory = require('./models/NonConsumableInventory');
const ConsumableInventory = require('./models/ConsumableInventory');
const Reservation = require('./models/Reservation');
const Borrow = require('./models/Borrow');
const Maintenance = require('./models/Maintenance');
const ForecastRequest = require('./models/ForecastRequest');

// Ensure Inventory points to NonConsumableInventory for non-consumable updates
const Inventory = require('./models/NonConsumableInventory'); // already present earlier in file

// Add StudentPrep model
const StudentPrep = require('./models/StudentPrep');

// Add Subject and Course models
const Subject = require('./models/Subject');
const Course = require('./models/Course');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB Connected Successfully');
  } catch (error) {
    console.error('MongoDB Connection Error:', error);
    process.exit(1);
  }
};

connectDB();

// Helper function for responses
const jsonResponse = (success, data) => {
  return { success, data };
};

// Generate unique IDs
const getNextSequence = async (model, field) => {
  const lastDoc = await model.findOne().sort({ [field]: -1 });
  return lastDoc ? lastDoc[field] + 1 : 1;
};

const generateRandomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Routes
const reportRoutes = require('./routes/Report');
app.use('/api', reportRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json(jsonResponse(true, 'Server is running!'));
});

// USERS CRUD
// server/index.js - Fix the users route
app.post('/api/users', async (req, res) => {
  try {
    const { action, ...data } = req.body;

    switch (action) {
      case 'create':
        // Check if user already exists
        const existingUser = await User.findOne({ email: data.email });
        if (existingUser) {
          return res.status(400).json(jsonResponse(false, "User already exists"));
        }

        const newUser = new User({
          email: data.email,
          lastname: data.lastname,
          firstname: data.firstname,
          role: data.role || 'Student' // Default role
        });
        await newUser.save();
        return res.json(jsonResponse(true, "User created"));

      case 'read':
        // If email is provided, find specific user, otherwise get all users
        if (data.email) {
          const user = await User.findOne({ email: data.email });
          if (!user) {
            return res.json(jsonResponse(true, [])); // Return empty array if not found
          }
          return res.json(jsonResponse(true, [user])); // Return as array for consistency
        } else {
          const users = await User.find().sort({ createdAt: -1 });
          return res.json(jsonResponse(true, users));
        }

      case 'update':
        const updatedUser = await User.findOneAndUpdate(
          { email: data.email },
          {
            lastname: data.lastname,
            firstname: data.firstname,
            role: data.role
          },
          { new: true }
        );
        if (!updatedUser) {
          return res.status(404).json(jsonResponse(false, "User not found"));
        }
        return res.json(jsonResponse(true, "User updated"));

      case 'delete':
        const deletedUser = await User.findOneAndDelete({ email: data.email });
        if (!deletedUser) {
          return res.status(404).json(jsonResponse(false, "User not found"));
        }
        return res.json(jsonResponse(true, "User deleted"));

      default:
        return res.status(400).json(jsonResponse(false, "Invalid action for users"));
    }
  } catch (error) {
    console.error('Users API Error:', error);
    res.status(500).json(jsonResponse(false, error.message));
  }
});

// RESERVATION CRUD
app.get('/api/reservations', async (req, res) => {
  try {
    const reservations = await Reservation.find().sort({ date_created: -1 });
    res.json(reservations);
  } catch (error) {
    console.error('Get reservations error:', error);
    res.status(500).json({ error: error.message });
  }
});

// In server/index.js - the POST /api/reservations route
app.post('/api/reservations', async (req, res) => {
  try {
    const newReservationId = await getNextSequence(Reservation, 'reservation_id');
    const reservationCode = generateRandomCode();

    // basic reservation object
    const reservationData = {
      reservation_id: newReservationId,
      reservation_code: reservationCode,
      subject: req.body.subject,
      instructor: req.body.instructor,
      instructor_email: req.body.instructor_email,
      schedule: req.body.schedule,
      course: req.body.course,
      room: req.body.room,
      user_type: req.body.user_type || 'Group',
      group_count: req.body.group_count || 1,
      group_members: Array.isArray(req.body.group_members) ? req.body.group_members : [],
      startTime: req.body.startTime,
      endTime: req.body.endTime,
      needsItems: req.body.needsItems !== undefined ? req.body.needsItems : true,
      requested_items: req.body.requested_items || [],
      status: 'Pending', // keep Pending by default
      notes: req.body.notes
    };

    // If assigned_items were supplied (faculty pre-selected inventory), persist them
    // but DO NOT change the reservation status here. Staff should follow approval/assignment workflow.
    if (Array.isArray(req.body.assigned_items) && req.body.assigned_items.length > 0) {
      reservationData.assigned_items = req.body.assigned_items.map(ai => ({
        requested_item_index: ai.requested_item_index,
        item_id: ai.item_id,
        item_name: ai.item_name,
        item_type: ai.item_type,
        identifier: ai.identifier || undefined,
        quantity: ai.quantity || 1,
        assigned_by: ai.assigned_by || req.body.instructor_email || 'Unknown',
        date_assigned: ai.date_assigned ? new Date(ai.date_assigned) : new Date()
      }));
      // Intentionally do NOT set reservationData.status = 'Assigned' or reservationData.date_assigned
      // so that the reservation remains Pending and follows normal approval/assignment steps.
    }

    const newReservation = new Reservation(reservationData);
    await newReservation.save();
    res.json(newReservation);
  } catch (error) {
    console.error('Create reservation error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reservations/code/:code', async (req, res) => {
  try {
    const code = String(req.params.code || "").trim();
    if (!code) return res.status(400).json({ error: 'Code is required' });

    // Helper to merge student_prep fields into reservation payload (without overwriting existing reservation values)
    const mergeStudentPrepIntoPayload = (payload, sp) => {
      if (!sp) return payload;
      // attach raw student_prep
      payload.student_prep = sp;
      // merge useful fields for BorrowPage compatibility (do not overwrite existing reservation values)
      if (!payload.group_number && sp.group_number) payload.group_number = sp.group_number;
      if (!payload.group_leader && sp.group_leader) payload.group_leader = sp.group_leader;
      if (!payload.group_leader_id && sp.group_leader_id) payload.group_leader_id = sp.group_leader_id;
      if ((!payload.group_members || payload.group_members.length === 0) && Array.isArray(sp.group_members) && sp.group_members.length > 0) {
        payload.group_members = sp.group_members;
      }
      if (!payload.group_barcode && sp.group_barcode) payload.group_barcode = sp.group_barcode;
      return payload;
    };

    // 1) Try exact reservation_code (case-insensitive)
    let reservation = await Reservation.findOne({
      reservation_code: { $regex: new RegExp(`^${code}$`, 'i') }
    });

    // If found by reservation_code, attach latest StudentPrep if any and return merged object
    if (reservation) {
      const studentPrepForReservation = await StudentPrep.findOne({ reservation_code: reservation.reservation_code })
        .sort({ createdAt: -1 });
      const payload = reservation.toObject();
      if (studentPrepForReservation) mergeStudentPrepIntoPayload(payload, studentPrepForReservation);
      return res.json(payload);
    }

    // 2) If not found, try StudentPrep by group_barcode (case-insensitive)
    const studentPrep = await StudentPrep.findOne({
      group_barcode: { $regex: new RegExp(`^${code}$`, 'i') }
    });

    if (studentPrep) {
      // load the referenced reservation by reservation_code (if exists)
      const resv = await Reservation.findOne({ reservation_code: studentPrep.reservation_code });
      if (resv) {
        const payload = resv.toObject();
        mergeStudentPrepIntoPayload(payload, studentPrep);
        return res.json(payload);
      }
      // student-prep exists but referenced reservation missing
      return res.status(404).json({ error: 'Reservation referenced by student-prep not found', student_prep: studentPrep });
    }

    // 3) Fallback: try to find StudentPrep by reservation_code or notes containing the code
    const spByRes = await StudentPrep.findOne({ reservation_code: { $regex: new RegExp(`^${code}$`, 'i') } });
    if (spByRes) {
      const resv2 = await Reservation.findOne({ reservation_code: spByRes.reservation_code });
      if (resv2) {
        const payload = resv2.toObject();
        mergeStudentPrepIntoPayload(payload, spByRes);
        return res.json(payload);
      }
    }

    const spByNotes = await StudentPrep.findOne({ notes: { $regex: new RegExp(code, 'i') } });
    if (spByNotes) {
      const resv3 = await Reservation.findOne({ reservation_code: spByNotes.reservation_code });
      if (resv3) {
        const payload = resv3.toObject();
        mergeStudentPrepIntoPayload(payload, spByNotes);
        return res.json(payload);
      }
    }

    // nothing matched
    return res.status(404).json({ error: 'Reservation not found' });
  } catch (error) {
    console.error('Get reservation by code error:', error);
    res.status(500).json({ error: error.message });
  }
});

// In server/index.js - the POST /api/reservations/:id/assign route
app.post('/api/reservations/:id/assign', async (req, res) => {
  try {
    const { assigned_items, assigned_by } = req.body;
    
    // Only allow assignment if status is 'Approved'
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation || reservation.status !== 'Approved') {
      return res.status(400).json({ error: 'Reservation must be Approved before assigning items' });
    }
    
    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      {
        assigned_items: assigned_items,
        status: 'Assigned',
        date_assigned: new Date()
      },
      { new: true }
    );
    
    if (!updatedReservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    res.json(updatedReservation);
  } catch (error) {
    console.error('Assign reservation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Approve reservation endpoint (Pending -> Approved)
app.post('/api/reservations/:id/approve', async (req, res) => {
  try {
    const { approved_by } = req.body;
    
    const reservation = await Reservation.findById(req.params.id);
    if (!reservation || reservation.status !== 'Pending') {
      return res.status(400).json({ error: 'Only Pending reservations can be approved' });
    }
    
    const updatedReservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      {
        status: 'Approved',
        date_approved: new Date()
      },
      { new: true }
    );
    
    if (!updatedReservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    res.json(updatedReservation);
  } catch (error) {
    console.error('Approve reservation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Add message to reservation
app.post('/api/reservations/:id/message', async (req, res) => {
  try {
    const { sender, sender_name, message } = req.body;
    
    if (!sender || !message) {
      return res.status(400).json({ error: 'Sender and message are required' });
    }
    
    const reservation = await Reservation.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          messages: {
            sender,
            sender_name,
            message,
            timestamp: new Date(),
            seen_by: []
          }
        }
      },
      { new: true }
    );
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    // emit to room for real-time clients
    io.to(req.params.id).emit('messageAdded', { reservation });

    res.json(reservation);
  } catch (error) {
    console.error('Add message error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark messages as seen
app.post('/api/reservations/:id/messages-seen', async (req, res) => {
  try {
    const { user_email } = req.body;
    if (!user_email) {
      return res.status(400).json({ error: 'User email is required' });
    }

    // Load plain object to avoid modifying a Mongoose document and triggering validation
    const reservationObj = await Reservation.findById(req.params.id).lean();
    if (!reservationObj) {
      return res.status(404).json({ error: 'Reservation not found' });
    }

    const messages = Array.isArray(reservationObj.messages) ? reservationObj.messages : [];

    // Build updated messages array (do not call save() on the full doc)
    const updatedMessages = messages.map((msg) => {
      const seenArr = Array.isArray(msg.seen_by) ? [...msg.seen_by] : [];
      if (!seenArr.includes(user_email)) {
        seenArr.push(user_email);
      }
      return { ...msg, seen_by: seenArr };
    });

    // Persist only the messages array using updateOne (avoids document-level validation on other fields)
    await Reservation.updateOne(
      { _id: reservationObj._id },
      { $set: { messages: updatedMessages } }
    );

    // Fetch updated reservation to return / emit
    const updatedReservation = await Reservation.findById(req.params.id);

    // emit seen update to room with updated reservation
    if (typeof io !== 'undefined' && io.to) {
      io.to(req.params.id).emit('messagesSeen', { reservation: updatedReservation });
    }

    res.json(updatedReservation);
  } catch (error) {
    console.error('Mark messages seen error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update reservation with edit logging (allow faculty edits)
app.put('/api/reservations/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const editor = req.body.editedBy || (req.body.editor_email) || 'Unknown';
    const editorName = req.body.editedName || req.body.editor_name || 'Unknown';

    // fetch previous snapshot
    const previous = await Reservation.findById(id).lean();
    if (!previous) return res.status(404).json({ error: 'Reservation not found' });

    // build update object (keep existing behavior) and include user_type/group_members when provided
    const updateData = {
      subject: req.body.subject,
      instructor: req.body.instructor,
      schedule: req.body.schedule,
      course: req.body.course,
      room: req.body.room,
      group_count: req.body.group_count,
      requested_items: req.body.requested_items || previous.requested_items,
      notes: req.body.notes
    };

    // accept user_type and group_members updates (if provided)
    if (req.body.user_type) updateData.user_type = req.body.user_type;
    if (Array.isArray(req.body.group_members)) updateData.group_members = req.body.group_members;

    // Enforce reservation completion only after scheduled end datetime when schedule is a parseable date
    if (req.body.status === 'Completed') {
      // Try to parse schedule as a date
      const schedText = String(req.body.schedule || previous.schedule || '').trim();
      let allowComplete = true;
      if (schedText) {
        const dateCandidate = new Date(schedText);
        if (!isNaN(dateCandidate.getTime())) {
          // We have a date; combine with endTime if available
          const endTimeStr = String(req.body.endTime || previous.endTime || '').trim();
          let endDateTime = new Date(dateCandidate);
          if (endTimeStr) {
            const parts = endTimeStr.split(':').map(Number);
            if (!isNaN(parts[0])) {
              endDateTime.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
            } else {
              endDateTime.setHours(23, 59, 59, 0);
            }
          } else {
            // default to end of day
            endDateTime.setHours(23, 59, 59, 0);
          }

          if (new Date() < endDateTime) {
            return res.status(400).json({ error: 'Cannot mark as Completed before reservation end time' });
          }
        } else {
          // schedule not parseable (likely recurring text). We do not block in that case.
          // allowComplete remains true
        }
      }
      updateData.date_completed = new Date();
      updateData.status = 'Completed';
    } else if (req.body.status === 'Approved') {
      updateData.date_approved = new Date();
      updateData.status = 'Approved';
    } else if (req.body.status === 'Prepared') {
      updateData.date_prepared = new Date();
      updateData.status = 'Prepared';
      updateData.prepared_items = req.body.prepared_items;
    } else if (req.body.status) {
      updateData.status = req.body.status;
    }

    // push edit log (previous snapshot)
    const editRecord = {
      editedBy: editor,
      editedName: editorName,
      editedAt: new Date(),
      reason: req.body.editReason || null,
      previous
    };

    const updatedReservation = await Reservation.findByIdAndUpdate(
      id,
      { $set: updateData, $push: { edits: editRecord } },
      { new: true }
    );

    if (!updatedReservation) return res.status(404).json({ error: 'Reservation not found' });

    // Optionally emit via socket.io if available
    if (typeof io !== 'undefined' && io.to) {
      io.to(id).emit('reservationUpdated', { reservation: updatedReservation });
    }

    res.json(updatedReservation);
  } catch (error) {
    console.error('Update reservation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reject reservation endpoint (set status -> Rejected + log reason)
app.post('/api/reservations/:id/reject', async (req, res) => {
  try {
    const id = req.params.id;
    const { reason, rejected_by, rejected_name } = req.body;

    const previous = await Reservation.findById(id).lean();
    if (!previous) return res.status(404).json({ error: 'Reservation not found' });

    const editRecord = {
      editedBy: rejected_by || 'Unknown',
      editedName: rejected_name || 'Unknown',
      editedAt: new Date(),
      reason: reason || 'Rejected',
      previous
    };

    const updated = await Reservation.findByIdAndUpdate(
      id,
      { $set: { status: 'Rejected', notes: (previous.notes ? previous.notes + '\n' : '') + `Rejected: ${reason || 'No reason'}` }, $push: { edits: editRecord } },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Reservation not found' });

    if (typeof io !== 'undefined' && io.to) {
      io.to(id).emit('reservationRejected', { reservation: updated });
    }

    res.json(updated);
  } catch (error) {
    console.error('Reject reservation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// StudentPrep CRUD: store student-generated barcode + borrower/group info
app.post('/api/student-prep', async (req, res) => {
  try {
    const { action, ...data } = req.body;

    switch ((action || 'create').toString()) {
      case 'create': {
        if (!data.reservation_code || !data.group_barcode || !data.user_type) {
          return res.status(400).json({ error: 'reservation_code, group_barcode and user_type are required' });
        }
        // allow linking to reservation by id if provided
        const doc = new StudentPrep({
          reservation_ref: data.reservation_ref || undefined,
          reservation_code: data.reservation_code,
          group_barcode: data.group_barcode,
          user_type: data.user_type,
          borrower_name: data.borrower_name || "",
          group_number: data.group_number || "",
          group_leader: data.group_leader || "",
          group_leader_id: data.group_leader_id || "",
          group_members: Array.isArray(data.group_members) ? data.group_members : [],
          notes: data.notes || ""
        });
        await doc.save();
        return res.json(doc);
      }

      case 'delete': {
        // delete by _id or group_barcode
        const query = data._id ? { _id: data._id } : (data.group_barcode ? { group_barcode: data.group_barcode } : null);
        if (!query) return res.status(400).json({ error: 'missing identifier to delete (_id or group_barcode)' });
        const deleted = await StudentPrep.findOneAndDelete(query);
        if (!deleted) return res.status(404).json({ error: 'StudentPrep record not found' });
        return res.json({ success: true, data: deleted });
      }

      case 'update': {
        // update by id or by group_barcode
        const query = data._id ? { _id: data._id } : (data.group_barcode ? { group_barcode: data.group_barcode } : null);
        if (!query) return res.status(400).json({ error: 'missing identifier to update (_id or group_barcode)' });

        const update = {
          reservation_ref: data.reservation_ref,
          reservation_code: data.reservation_code,
          group_barcode: data.group_barcode,
          user_type: data.user_type,
          borrower_name: data.borrower_name,
          group_number: data.group_number,
          group_leader: data.group_leader,
          group_leader_id: data.group_leader_id,
          group_members: Array.isArray(data.group_members) ? data.group_members : undefined,
          notes: data.notes,
          updatedAt: new Date()
        };
        // remove undefined fields
        Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);

        const updated = await StudentPrep.findOneAndUpdate(query, { $set: update }, { new: true, upsert: false });
        if (!updated) return res.status(404).json({ error: 'StudentPrep record not found' });
        return res.json(updated);
      }

      case 'read': {
        // read all or by reservation_code/group_barcode
        if (data.group_barcode) {
          const doc = await StudentPrep.findOne({ group_barcode: data.group_barcode });
          return res.json(doc || null);
        }
        if (data.reservation_code) {
          const docs = await StudentPrep.find({ reservation_code: data.reservation_code }).sort({ createdAt: -1 });
          return res.json(docs);
        }
        const all = await StudentPrep.find().sort({ createdAt: -1 });
        return res.json(all);
      }

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('StudentPrep API error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Convenience GET endpoints
app.get('/api/student-prep/barcode/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim();
    if (!code) return res.status(400).json({ error: 'barcode required' });
    const doc = await StudentPrep.findOne({ group_barcode: code });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc);
  } catch (err) {
    console.error('Get student-prep by barcode error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/student-prep/reservation/:code', async (req, res) => {
  try {
    const code = String(req.params.code || '').trim();
    if (!code) return res.status(400).json({ error: 'reservation code required' });
    const docs = await StudentPrep.find({ reservation_code: code }).sort({ createdAt: -1 });
    res.json(docs);
  } catch (err) {
    console.error('Get student-prep by reservation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// SUBJECTS CRUD
// SUBJECTS CRUD - UPDATED to support required_items
app.get('/api/subjects', async (req, res) => {
  try {
    const subjects = await Subject.find().sort({ name: 1 });
    res.json(subjects);
  } catch (err) {
    console.error('Get subjects error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/subjects', async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Subject name required' });
    const existing = await Subject.findOne({ name: name.trim() });
    if (existing) return res.status(409).json({ error: 'Subject already exists' });
    const s = new Subject({ name: name.trim(), code: code || '', courses: [], required_items: [] });
    await s.save();
    res.json(s);
  } catch (err) {
    console.error('Create subject error:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATED PATCH endpoint to support required_items, addCourse, and removeCourse
app.patch('/api/subjects/:id', async (req, res) => {
  try {
    const { addCourse, removeCourse, required_items } = req.body;
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    // Handle adding a course (program)
    if (addCourse) {
      if (!subject.courses) subject.courses = [];
      if (!subject.courses.includes(addCourse)) subject.courses.push(addCourse);
      await subject.save();
      return res.json(subject);
    }
    
    // Handle removing a course (program)
    if (removeCourse) {
      subject.courses = (subject.courses || []).filter(cid => cid !== removeCourse);
      await subject.save();
      return res.json(subject);
    }
    
    // Handle updating required_items
    if (required_items !== undefined) {
      subject.required_items = required_items;
      await subject.save();
      return res.json(subject);
    }
    
    return res.status(400).json({ error: 'No valid operation specified (addCourse, removeCourse, or required_items)' });
  } catch (err) {
    console.error('Patch subject error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/subjects/:id', async (req, res) => {
  try {
    const deleted = await Subject.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Subject not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete subject error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Optional: Add a PUT endpoint for full subject updates
app.put('/api/subjects/:id', async (req, res) => {
  try {
    const { code, name, courses, required_items } = req.body;
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.status(404).json({ error: 'Subject not found' });
    
    if (code !== undefined) subject.code = code;
    if (name !== undefined) subject.name = name;
    if (courses !== undefined) subject.courses = courses;
    if (required_items !== undefined) subject.required_items = required_items;
    
    await subject.save();
    res.json(subject);
  } catch (err) {
    console.error('Update subject error:', err);
    res.status(500).json({ error: err.message });
  }
});

// COURSES CRUD
app.get('/api/courses', async (req, res) => {
  try {
    const courses = await Course.find().sort({ name: 1 });
    res.json(courses);
  } catch (err) {
    console.error('Get courses error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/courses', async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Course name required' });
    const existing = await Course.findOne({ name: name.trim() });
    if (existing) return res.status(409).json({ error: 'Course already exists' });
    const c = new Course({ name: name.trim(), code: code || '' });
    await c.save();
    res.json(c);
  } catch (err) {
    console.error('Create course error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/courses/:id', async (req, res) => {
  try {
    const deleted = await Course.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Course not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete course error:', err);
    res.status(500).json({ error: err.message });
  }
});

// NON-CONSUMABLE INVENTORY CRUD
app.post('/api/nc-inventory', async (req, res) => {
  try {
    const { action, ...data } = req.body;

    switch (action) {
      case 'create':
        const newEquipmentNum = await getNextSequence(NonConsumableInventory, 'equipment_num');
        
        const newInventory = new NonConsumableInventory({
          equipment_num: newEquipmentNum,
          equipment_name: data.equipment_name,
          facility: data.facility,
          brand_model: data.brand_model,
          total_qty: data.total_qty,
          borrowed: data.borrowed || 0,
          identifier_type: data.identifier_type,
          identifiers: data.identifiers,
          statuses: data.statuses,
          location: data.location,
          room: data.room,
          shelf_no: data.shelf_no,
          soft_hard: data.soft_hard,
          e_location: data.e_location,
          bat_type: data.bat_type,
          bat_qty: data.bat_qty,
          bat_total: data.bat_total,
          yes_or_no: data.yes_or_no,
          preventive_or_calibration: data.preventive_or_calibration,
          inhouse_outsourced: data.inhouse_outsourced,
          month: data.month
        });
        
        await newInventory.save();
        return res.json(jsonResponse(true, { equipment_num: newEquipmentNum }));

      case 'read':
        const inventory = await NonConsumableInventory.find().sort({ equipment_num: 1 });
        return res.json(jsonResponse(true, inventory));

      case 'update':
        const updatedInventory = await NonConsumableInventory.findOneAndUpdate(
          { equipment_num: data.num },
          {
            equipment_name: data.equipment_name,
            facility: data.facility,
            brand_model: data.brand_model,
            total_qty: data.total_qty,
            borrowed: data.borrowed,
            identifier_type: data.identifier_type,
            identifiers: data.identifiers,
            statuses: data.statuses,
            location: data.location,
            room: data.room,
            shelf_no: data.shelf_no,
            soft_hard: data.soft_hard,
            e_location: data.e_location,
            bat_type: data.bat_type,
            bat_qty: data.bat_qty,
            bat_total: data.bat_total,
            yes_or_no: data.yes_or_no,
            preventive_or_calibration: data.preventive_or_calibration,
            inhouse_outsourced: data.inhouse_outsourced,
            month: data.month
          },
          { new: true }
        );
        
        if (!updatedInventory) {
          return res.status(404).json(jsonResponse(false, "Inventory item not found"));
        }
        return res.json(jsonResponse(true, "Inventory updated"));

      case 'delete':
        const deletedInventory = await NonConsumableInventory.findOneAndDelete({ equipment_num: data.num });
        if (!deletedInventory) {
          return res.status(404).json(jsonResponse(false, "Inventory item not found"));
        }
        return res.json(jsonResponse(true, "Inventory deleted"));

      // --- ADD THIS CASE ---
      case 'update_identifier_status_and_borrowed': {
        // Required: identifier (string), status (string)
        const { identifier, status } = data;
        if (!identifier || !status) {
          return res.status(400).json(jsonResponse(false, "identifier and status are required"));
        }

        // Find the inventory item containing this identifier
        const inv = await NonConsumableInventory.findOne({ identifiers: identifier });
        if (!inv) {
          return res.status(404).json(jsonResponse(false, "Inventory item with this identifier not found"));
        }

        // Update the status of the identifier in the statuses array
        const idx = Array.isArray(inv.identifiers) ? inv.identifiers.findIndex(id => id === identifier) : -1;
        if (idx === -1) {
          return res.status(404).json(jsonResponse(false, "Identifier not found in inventory item"));
        }

        // Update status (normalize to lowercase for consistency)
        if (Array.isArray(inv.statuses)) {
          inv.statuses[idx] = String(status).toLowerCase();
        } else {
          inv.statuses = [];
          inv.statuses[idx] = String(status).toLowerCase();
        }

        // Decrement borrowed count by 1 (min 0)
        inv.borrowed = Math.max(0, (inv.borrowed || 0) - 1);

        await inv.save();
        return res.json(jsonResponse(true, "Identifier status and borrowed count updated"));
      }

      default:
        return res.status(400).json(jsonResponse(false, "Invalid action for inventory"));
    }
  } catch (error) {
    res.status(500).json(jsonResponse(false, error.message));
  }
});

// CONSUMABLE INVENTORY CRUD
app.post('/api/c-inventory', async (req, res) => {
  try {
    const { action, ...data } = req.body;

    switch (action) {
      case 'create':
        const newItemNum = await getNextSequence(ConsumableInventory, 'item_num');
        
        const newCInventory = new ConsumableInventory({
          item_num: newItemNum,
          location: data.location,
          description: data.description,
          quantity_opened: data.quantity_opened,
          quantity_unopened: data.quantity_unopened,
          quantity_on_order: data.quantity_on_order,
          remarks: data.remarks,
          experiment: data.experiment,
          subject: data.subject,
          date_issued: data.date_issued,
          issuance_no: data.issuance_no,
          stock_alert: data.stock_alert
        });
        
        await newCInventory.save();
        return res.json(jsonResponse(true, "Inventory item created"));

      case 'read':
        const inventory = await ConsumableInventory.find().sort({ item_num: 1 });
        return res.json(jsonResponse(true, inventory));

      case 'update':
        const updatedInventory = await ConsumableInventory.findOneAndUpdate(
          { item_num: data.num },
          {
            location: data.location,
            description: data.description,
            quantity_opened: data.quantity_opened,
            quantity_unopened: data.quantity_unopened,
            quantity_on_order: data.quantity_on_order,
            remarks: data.remarks,
            experiment: data.experiment,
            subject: data.subject,
            date_issued: data.date_issued,
            issuance_no: data.issuance_no,
            stock_alert: data.stock_alert
          },
          { new: true }
        );
        
        if (!updatedInventory) {
          return res.status(404).json(jsonResponse(false, "Inventory item not found"));
        }
        return res.json(jsonResponse(true, "Inventory updated"));

      case 'delete':
        const deletedInventory = await ConsumableInventory.findOneAndDelete({ item_num: data.num });
        if (!deletedInventory) {
          return res.status(404).json(jsonResponse(false, "Inventory item not found"));
        }
        return res.json(jsonResponse(true, "Inventory deleted"));

      default:
        return res.status(400).json(jsonResponse(false, "Invalid action for inventory"));
    }
  } catch (error) {
    res.status(500).json(jsonResponse(false, error.message));
  }
});


// BORROW CRUD
app.post('/api/borrow', async (req, res) => {
  try {
    const { action, ...data } = req.body;

    switch (action) {
      case 'create':
        const newBorrowId = await getNextSequence(Borrow, 'borrow_id');
        
        const newBorrow = new Borrow({
          borrow_id: newBorrowId,
          course: data.course,
          group_number: data.group_number,
          group_leader: data.group_leader,
          group_leader_id: data.group_leader_id,
          instructor: data.instructor,
          subject: data.subject,
          schedule: data.schedule,
          item: data.item,
          quantity: data.quantity,
          status: data.status || 'Borrowed',
          // --- FIX: Add group_members if provided ---
          group_members: Array.isArray(data.group_members) ? data.group_members : [],
        });
        
        await newBorrow.save();

        // Update inventory for borrowed items (support single item or items array)
        try {
          const borrowedItems = data.items || (data.item ? [{ item_id: data.item, item_type: data.item_type, quantity: data.quantity || 1 }] : []);
          for (const bi of borrowedItems) {
            // bi expected shape: { item_id, item_type, quantity }
            await updateInventoryOnBorrow(bi);
          }
        } catch (invErr) {
          console.error('Inventory update on borrow error:', invErr);
          // non-fatal: continue returning success for borrow creation
        }
        
        return res.json(jsonResponse(true, "Borrow record created"));

      case 'read':
        const borrows = await Borrow.find().sort({ date_borrowed: -1 });
        return res.json(jsonResponse(true, borrows));

      case 'update':
        const updateData = { status: data.status };
        
        if (data.status === 'Returned') {
          updateData.date_returned = new Date();
        }
        
        const updatedBorrow = await Borrow.findOneAndUpdate(
          { borrow_id: data.borrow_id },
          updateData,
          { new: true }
        );
        
        if (!updatedBorrow) {
          return res.status(404).json(jsonResponse(false, "Borrow record not found"));
        }
        return res.json(jsonResponse(true, "Borrow record updated"));

      case 'delete':
        const deletedBorrow = await Borrow.findOneAndDelete({ borrow_id: data.borrow_id });
        if (!deletedBorrow) {
          return res.status(404).json(jsonResponse(false, "Borrow record not found"));
        }
        return res.json(jsonResponse(true, "Borrow record deleted"));

      default:
        return res.status(400).json(jsonResponse(false, "Invalid action for borrow"));
    }
  } catch (error) {
    res.status(500).json(jsonResponse(false, error.message));
  }
});

// BORROW RECORDS API (for the new MongoDB schema)
app.get('/api/borrow-records', async (req, res) => {
  try {
    const borrows = await Borrow.find().sort({ date_borrowed: -1 });
    res.json(borrows);
  } catch (error) {
    console.error('Get borrow records error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/borrow-records', async (req, res) => {
  try {
    const newBorrowId = await getNextSequence(Borrow, 'borrow_id');
    
    const newBorrow = new Borrow({
      borrow_id: newBorrowId,
      borrow_type: req.body.borrow_type,
      user_type: req.body.user_type,
      borrow_user: req.body.borrow_user,
      course: req.body.course,
      group_number: req.body.group_number,
      group_leader: req.body.group_leader,
      group_leader_id: req.body.group_leader_id,
      instructor: req.body.instructor,
      subject: req.body.subject,
      schedule: req.body.schedule,
      items: req.body.items,
      status: req.body.status || 'Borrowed',
      date_borrowed: req.body.date_borrowed || new Date(),
      reservation_code: req.body.reservation_code,
      group_members: req.body.group_members || [],
      managed_by: req.body.managed_by || '',      // <-- add this
      managed_name: req.body.managed_name || ''   // <-- add this
    });
    
    await newBorrow.save();

    // Update inventory for each borrowed item (items expected as array)
    try {
      // iterate items and update inventory counts / logs
      for (const bItem of newBorrow.items || []) {
        // call helper with borrow record id for logging
        await updateInventoryOnBorrow(bItem, newBorrow._id);
      }
    } catch (invErr) {
      console.error('Inventory update after borrow error:', invErr);
    }
    
    res.json(newBorrow);
  } catch (error) {
    console.error('Create borrow record error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/borrow-records/:id', async (req, res) => {
  try {
    const updatedBorrow = await Borrow.findByIdAndUpdate(
      req.params.id,
      {
        borrow_type: req.body.borrow_type,
        user_type: req.body.user_type,
        borrow_user: req.body.borrow_user,
        course: req.body.course,
        group_number: req.body.group_number,
        group_leader: req.body.group_leader,
        group_leader_id: req.body.group_leader_id,
        instructor: req.body.instructor,
        subject: req.body.subject,
        schedule: req.body.schedule,
        items: req.body.items,
        status: req.body.status,
        reservation_code: req.body.reservation_code,
        group_members: req.body.group_members || [],
        managed_by: req.body.managed_by || '',      // <-- add this
        managed_name: req.body.managed_name || ''   // <-- add this
      },
      { new: true }
    );
    
    if (!updatedBorrow) {
      return res.status(404).json({ error: 'Borrow record not found' });
    }
    
    res.json(updatedBorrow);
  } catch (error) {
    console.error('Update borrow record error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/borrow-records/:id', async (req, res) => {
  try {
    const deletedBorrow = await Borrow.findByIdAndDelete(req.params.id);
    
    if (!deletedBorrow) {
      return res.status(404).json({ error: 'Borrow record not found' });
    }
    
    res.json({ message: 'Borrow record deleted successfully' });
  } catch (error) {
    console.error('Delete borrow record error:', error);
    res.status(500).json({ error: error.message });
  }
});

// RETURN ITEMS API with status tracking and condition reporting
app.put('/api/borrow-records/:id/return', async (req, res) => {
  try {
    const { returnedItems } = req.body;
    const borrow = await Borrow.findById(req.params.id);
    
    if (!borrow) {
      return res.status(404).json({ error: 'Borrow record not found' });
    }

    let allItemsReturned = true;
    let someItemsReturned = false;

    // Process each returned item
    for (const returnedItem of returnedItems) {
      const borrowItem = borrow.items.id(returnedItem.itemId);
      if (borrowItem) {
        // Update item status based on returned quantity
        if (returnedItem.returnedQty === borrowItem.quantity) {
          borrowItem.status = 'Returned';
        } else if (returnedItem.returnedQty > 0) {
          borrowItem.status = 'Partially Returned';
          allItemsReturned = false;
          someItemsReturned = true;
        } else {
          allItemsReturned = false;
        }

        // Update identifiers for non-consumable items
        if (borrowItem.item_type === 'non-consumable' && borrowItem.identifiers) {
          borrowItem.identifiers.forEach(identifier => {
            if (returnedItem.returnedIdentifiers?.includes(identifier.identifier)) {
              identifier.status = returnedItem.condition;
              identifier.condition_notes = returnedItem.damageReport;
              identifier.date_returned = new Date();
            }
          });
        }

        // Update item return details
        borrowItem.return_condition = returnedItem.condition;
        borrowItem.damage_report = returnedItem.damageReport;
        borrowItem.lacking_items = returnedItem.lackingItems;
        borrowItem.notes = returnedItem.notes;
        
        if (!borrowItem.date_returned && returnedItem.returnedQty > 0) {
          borrowItem.date_returned = new Date();
        }

        // Update inventory (only affects non-consumables in helper)
        await updateInventoryOnReturn(borrowItem, returnedItem);
      }
    }

    // Update overall borrow status
    // Ignore consumable items when calculating overall return completion
    const returnableItems = borrow.items.filter(it => it.item_type !== 'consumable');
    const returnedCount = returnableItems.filter(it => it.status === 'Returned').length;
    const totalReturnable = returnableItems.length;

    if (totalReturnable === 0) {
      // No returnable items (all consumables) -> mark as Returned
      borrow.status = 'Returned';
      borrow.date_returned = new Date();
    } else if (returnedCount === totalReturnable) {
      borrow.status = 'Returned';
      borrow.date_returned = new Date();
    } else if (returnedCount > 0) {
      borrow.status = 'Partially Returned';
    } else {
      borrow.status = 'Borrowed';
    }

    await borrow.save();
    res.json(borrow);
  } catch (error) {
    console.error('Return items error:', error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATE INDIVIDUAL ITEM STATUS - FIXED VERSION
app.put('/api/borrow-records/:borrowId/items/:itemId', async (req, res) => {
  try {
    const { status, condition, damageReport, lackingItems, notes } = req.body;
    const borrow = await Borrow.findById(req.params.borrowId);
    
    if (!borrow) {
      return res.status(404).json({ error: 'Borrow record not found' });
    }

    // Find item by MongoDB _id (not item_id)
    const item = borrow.items.id(req.params.itemId);
    if (!item) {
      return res.status(404).json({ error: 'Item not found in borrow record' });
    }

    console.log('Updating item:', {
      itemId: req.params.itemId,
      status,
      condition,
      damageReport,
      lackingItems,
      notes
    });

    // Update item details
    item.status = status;
    item.return_condition = condition || '';
    item.damage_report = damageReport || '';
    item.lacking_items = lackingItems || '';
    item.notes = notes || '';

    // If marking as Returned now, set date_returned and update inventory utilization
    if (status === 'Returned' && !item.date_returned) {
      item.date_returned = new Date();
      // Ensure item.date_borrowed is present; fallback to borrow.date_borrowed
      if (!item.date_borrowed && borrow.date_borrowed) {
        item.date_borrowed = borrow.date_borrowed;
      }

      // Persist change to borrow document (we'll save after loop below)
      // Update inventory utilization / counts (only affects non-consumables)
      try {
        await updateInventoryOnReturn(item, borrow);
      } catch (invErr) {
        console.error('Error updating inventory on return:', invErr);
      }
    }

    // Check returnable items only (exclude consumables) when deciding overall borrow status
    const returnableItems = borrow.items.filter(it => it.item_type !== 'consumable');
    const returnedItemsCount = returnableItems.filter(it => it.status === 'Returned').length;
    const totalReturnableCount = returnableItems.length;

    console.log(`Returned items (non-consumable): ${returnedItemsCount}/${totalReturnableCount}`);

    if (totalReturnableCount === 0) {
      borrow.status = 'Returned';
      borrow.date_returned = new Date();
    } else if (returnedItemsCount === totalReturnableCount) {
      borrow.status = 'Returned';
      borrow.date_returned = new Date();
    } else if (returnedItemsCount > 0) {
      borrow.status = 'Partially Returned';
    } else {
      borrow.status = 'Borrowed';
    }

    const savedBorrow = await borrow.save();
    console.log('Saved borrow status:', savedBorrow.status);
    
    res.json(savedBorrow);
  } catch (error) {
    console.error('Update item status error:', error);
    res.status(500).json({ error: error.message });
  }
});
// GET BORROW RECORD BY ID (for viewing)
app.get('/api/borrow-records/:id', async (req, res) => {
  try {
    const borrow = await Borrow.findById(req.params.id);
    
    if (!borrow) {
      return res.status(404).json({ error: 'Borrow record not found' });
    }
    
    res.json(borrow);
  } catch (error) {
    console.error('Get borrow record error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to update inventory on return
async function updateInventoryOnReturn(borrowItem, borrowRecord) {
  try {
    if (!borrowItem || !borrowItem.item_id) return;

    const idNum = String(borrowItem.item_id);

    // Find inventory item
    const inv = await Inventory.findOne({ equipment_num: isNaN(Number(idNum)) ? idNum : Number(idNum) });
    if (!inv) {
      const alt = await Inventory.findOne({ equipment_num: idNum });
      if (!alt) return;
      // prefer alt if found
      // eslint-disable-next-line prefer-destructuring
      inv = alt;
    }

    // Only for non-consumables
    if (borrowItem.item_type === 'non-consumable') {
      // If identifiers exist on the borrow item, handle per-identifier logs
      const identifiers = Array.isArray(borrowItem.identifiers) ? borrowItem.identifiers : [];

      // If there are identifier-level entries submitted (e.g. returnedIdentifiers), update those
      if (identifiers.length > 0) {
        for (const idObj of identifiers) {
          const ident = (typeof idObj === 'string') ? idObj : idObj.identifier;
          const identifierReturnedAt = idObj.date_returned ? new Date(idObj.date_returned) : (borrowItem.date_returned ? new Date(borrowItem.date_returned) : null);

          // find existing open usage log for this identifier (borrowed_at present, returned_at null) and same borrow ref
          const existingLog = (inv.usage_logs || []).find(l => String(l.identifier) === String(ident) && (!l.returned_at) && (String(l.borrow_id || l.borrow_record_ref || '') === String(borrowRecord && (borrowRecord._id || borrowRecord.borrow_id) || '')));

          const borrowedAt = idObj.date_borrowed ? new Date(idObj.date_borrowed) : (borrowItem.date_borrowed ? new Date(borrowItem.date_borrowed) : (borrowRecord && borrowRecord.date_borrowed ? new Date(borrowRecord.date_borrowed) : null));
          const returnedAt = identifierReturnedAt || new Date();

          let minutesUsed = 0;
          if (borrowedAt && returnedAt) {
            minutesUsed = Math.round((returnedAt.getTime() - borrowededAt.getTime()) / 60000);
            if (minutesUsed < 0) minutesUsed = 0;
          }

          if (existingLog) {
            existingLog.returned_at = returnedAt;
            existingLog.minutes = minutesUsed;
            existingLog.managed_by = (borrowRecord && borrowRecord.managed_by) || existingLog.managed_by;
          } else {
            inv.usage_logs = inv.usage_logs || [];
            inv.usage_logs.push({
              borrow_id: borrowRecord && borrowRecord._id ? borrowRecord._id : undefined,
              borrow_record_ref: borrowRecord && borrowRecord.borrow_id ? String(borrowRecord.borrow_id) : undefined,
              item_id: idNum,
              identifier: ident,
              minutes: minutesUsed,
              borrowed_at: borrowedAt,
              returned_at: returnedAt,
              managed_by: (borrowRecord && borrowRecord.managed_by) || undefined
            });
          }

          // decrement borrowed count by 1 per identifier returned
          inv.borrowed = Math.max(0, (inv.borrowed || 0) - 1);
          // accumulate total usage
          inv.total_usage_minutes = (inv.total_usage_minutes || 0) + (minutesUsed || 0);
        }

        await inv.save();
        return;
      }

      // Fallback if no identifiers: treat the whole item as single unit
      const qtyReturned = parseInt(borrowItem.quantity || 1, 10);
      inv.borrowed = Math.max(0, (inv.borrowed || 0) - qtyReturned);

      const borrowedAt = borrowItem.date_borrowed ? new Date(borrowItem.date_borrowed) : (borrowRecord && borrowRecord.date_borrowed ? new Date(borrowRecord.date_borrowed) : null);
      const returnedAt = borrowItem.date_returned ? new Date(borrowItem.date_returned) : new Date();

      let minutesUsed = 0;
      if (borrowedAt && returnedAt) {
        minutesUsed = Math.round((returnedAt.getTime() - borrowedAt.getTime()) / 60000);
        if (minutesUsed < 0) minutesUsed = 0;
      }

      inv.total_usage_minutes = (inv.total_usage_minutes || 0) + (minutesUsed || 0);
      inv.usage_logs = inv.usage_logs || [];
      inv.usage_logs.push({
        borrow_id: borrowRecord && borrowRecord._id ? borrowRecord._id : undefined,
        borrow_record_ref: borrowRecord && borrowRecord.borrow_id ? String(borrowRecord.borrow_id) : undefined,
        item_id: idNum,
        identifier: undefined,
        minutes: minutesUsed,
        borrowed_at: borrowedAt,
        returned_at: returnedAt,
        managed_by: (borrowRecord && borrowRecord.managed_by) || undefined
      });

      await inv.save();
    }
  } catch (error) {
    console.error('Inventory update on return error:', error);
  }
}

// Update inventory when items are borrowed (record per-identifier logs when identifiers provided)
async function updateInventoryOnBorrow(borrowItem, borrowRecordId) {
  try {
    if (!borrowItem || !borrowItem.item_id) return;

    const idNum = String(borrowItem.item_id);
    const qty = parseInt(borrowItem.quantity || 1, 10);

    const inv = await Inventory.findOne({ equipment_num: isNaN(Number(idNum)) ? idNum : Number(idNum) });
    if (!inv) return;

    if (borrowItem.item_type === 'non-consumable') {
      // if identifiers were selected in borrowItem.identifiers, record a log per identifier
      const identifiers = Array.isArray(borrowItem.identifiers) ? borrowItem.identifiers : [];
      if (identifiers.length > 0) {
        for (const idObj of identifiers) {
          const ident = (typeof idObj === 'string') ? idObj : idObj.identifier;
          inv.usage_logs = inv.usage_logs || [];
          inv.usage_logs.push({
            borrow_id: borrowRecordId || undefined,
            borrow_record_ref: borrowRecordId ? String(borrowRecordId) : undefined,
            item_id: idNum,
            identifier: ident,
            minutes: 0,
            borrowed_at: new Date(),
            returned_at: null,
            managed_by: undefined
          });
          inv.borrowed = (inv.borrowed || 0) + 1;
        }
      } else {
        // no identifiers: record single log for the item / quantity
        inv.usage_logs = inv.usage_logs || [];
        inv.usage_logs.push({
          borrow_id: borrowRecordId || undefined,
          borrow_record_ref: borrowRecordId ? String(borrowRecordId) : undefined,
          item_id: idNum,
          identifier: undefined,
          minutes: 0,
          borrowed_at: new Date(),
          returned_at: null,
          managed_by: undefined
        });
        inv.borrowed = (inv.borrowed || 0) + qty;
      }
      await inv.save();
    }
  } catch (error) {
    console.error('updateInventoryOnBorrow error:', error);
  }
}

// COMBINED INVENTORY API (for both consumable and non-consumable)
app.get('/api/inventory', async (req, res) => {
  try {
    const [nonConsumable, consumable] = await Promise.all([
      NonConsumableInventory.find().sort({ equipment_num: 1 }),
      ConsumableInventory.find().sort({ item_num: 1 })
    ]);

    const combinedInventory = [
      ...nonConsumable.map(item => ({
        _id: item._id,
        num: item.equipment_num.toString(),
        equipment_name: item.equipment_name,
        total_qty: item.total_qty,
        borrowed: item.borrowed || 0,
        available: Math.max(0, (item.total_qty || 0) - (item.borrowed || 0)),
        brand_model: item.brand_model,
        location: item.location,
        identifier_type: item.identifier_type,
        identifiers: item.identifiers || [],
        statuses: item.statuses || [],
        is_consumable: false,
        item_type: 'non-consumable',
        // expose utilization
        total_usage_minutes: item.total_usage_minutes || 0,
        usage_logs: item.usage_logs || []
      })),
      ...consumable.map(item => ({
        _id: item._id,
        num: item.item_num.toString(),
        equipment_name: item.description,
        total_qty: (item.quantity_opened || 0) + (item.quantity_unopened || 0),
        borrowed: 0,
        available: (item.quantity_opened || 0) + (item.quantity_unopened || 0),
        location: item.location,
        description: item.description,
        quantity_opened: item.quantity_opened,
        quantity_unopened: item.quantity_unopened,
        is_consumable: true,
        item_type: 'consumable'
      }))
    ];

    res.json(combinedInventory);
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: error.message });
  }
});

// UPDATE BORROW MODEL (if needed)
// Make sure your Borrow model matches the new schema with items array
// MAINTENANCE CRUD
app.post('/api/maintenance', async (req, res) => {
  try {
    const { action, ...data } = req.body;

    switch ((action || 'read').toString()) {
      case 'create': {
        const newMaintenanceNum = await getNextSequence(Maintenance, 'maintenance_num');

        const doc = new Maintenance({
          maintenance_num: newMaintenanceNum,
          equipment_num: data.equipment_num,
          equipment_name: data.equipment_name || '',
          brand_model: data.brand_model || '',
          identifier_type: data.identifier_type || '',
          identifier_number: data.identifier_number || '',
          month: data.month || '',
          scheduledYear: data.scheduledYear || (new Date()).getFullYear(),

          // allow optional immediate accomplishment metadata
          date_accomplished: data.date_accomplished ? new Date(data.date_accomplished) : undefined,
          accomplished_by: data.accomplished_by || '',

          // detailed fields (optional)
          problemDescription: data.problemDescription || data.problem_description || data.problem || '',
          actionTaken: data.actionTaken || data.action_taken || '',
          result: data.result || '',
          conclusions: data.conclusions || '',
          routineCleaning: !!data.routineCleaning,
          partsAssessment: !!data.partsAssessment,
          visualInspection: !!data.visualInspection,
          calibrationLink: data.calibrationLink || data.calibration_link || '',
          notes: data.notes ? (typeof data.notes === 'object' ? JSON.stringify(data.notes) : data.notes) : (data.notes || '')
        });

        await doc.save();
        return res.json(jsonResponse(true, doc));
      }

      case 'read': {
        // optional filters: month, equipment_num, maintenance_num, etc.
        const q ={};
        if (data.month) q.month = data.month;
        if (data.equipment_num) q.equipment_num = data.equipment_num;
        if (data.maintenance_num) q.maintenance_num = data.maintenance_num;
        const list = await Maintenance.find(q).sort({ maintenance_num: 1 });
        return res.json(jsonResponse(true, list));
      }

      case 'update': {
        // support update by maintenance_num or by _id
        const query = {};
        if (data.num) query.maintenance_num = data.num;
        else if (data.id) query._id = data.id;
        else return res.status(400).json(jsonResponse(false, 'Missing identifier (num or id) for update'));

        // build update object from provided fields
        const update= {};

        const updatable = [
          'equipment_num','equipment_name','brand_model','identifier_type','identifier_number','month',
          'accomplished_by','date_accomplished',
          'problemDescription','actionTaken','result','conclusions',
          'routineCleaning','partsAssessment','visualInspection','calibrationLink','notes'
        ];

        updatable.forEach((k) => {
          if (typeof data[k] !== 'undefined') {
            update[k] = data[k];
          }
        });

        // convenience: allow snake_case aliases
        if (data.problem_description && !update.problemDescription) update.problemDescription = data.problem_description;
        if (data.action_taken && !update.actionTaken) update.actionTaken = data.action_taken;
        if (data.calibration_link && !update.calibrationLink) update.calibrationLink = data.calibration_link;

        // if accomplished_by provided but no date, set date_accomplished now
        if (data.accomplished_by && !data.date_accomplished) {
          update.date_accomplished = new Date();
        } else if (data.date_accomplished) {
          update.date_accomplished = new Date(data.date_accomplished);
        }

        if (Object.keys(update).length === 0) {
          return res.status(400).json(jsonResponse(false, 'No updatable fields provided'));
        }

        update.updatedAt = new Date();

        const updated = await Maintenance.findOneAndUpdate(query, { $set: update }, { new: true });

        if (!updated) return res.status(404).json(jsonResponse(false, 'Maintenance record not found'));

        // If this update marks the maintenance as accomplished, schedule next year's maintenance occurrence
        try {
          const accomplished = !!(update.accomplished_by || update.date_accomplished || updated.accomplished_by || updated.date_accomplished);
          if (accomplished) {
            // determine scheduledYear for the current record (fallback to current year)
            const currentScheduledYear = (updated.scheduledYear || (updated.date_accomplished ? new Date(updated.date_accomplished).getFullYear() : (new Date()).getFullYear()));
            const nextYear = Number(currentScheduledYear) + 1;

            // check if a record already exists for same equipment_num + month + scheduledYear = nextYear
            const exists = await Maintenance.findOne({
              equipment_num: updated.equipment_num,
              month: updated.month,
              scheduledYear: nextYear
            });

            if (!exists) {
              const nextNum = await getNextSequence(Maintenance, 'maintenance_num');
              const nextDoc = new Maintenance({
                maintenance_num: nextNum,
                equipment_num: updated.equipment_num,
                equipment_name: updated.equipment_name,
                brand_model: updated.brand_model,
                identifier_type: updated.identifier_type,
                identifier_number: updated.identifier_number,
                month: updated.month,
                scheduledYear: nextYear,
                // no date_accomplished yet -> pending for nextYear
                date_accomplished: undefined,
                accomplished_by: '',
                notes: '' // leave empty; copy if desired
              });
              await nextDoc.save().catch((e) => {
                // non-fatal: log but continue
                console.warn('Failed to create next-year maintenance schedule', e && e.message);
              });
            }
          }
        } catch (schedErr) {
          console.warn('Error scheduling next-year maintenance:', schedErr && schedErr.message);
        }

        return res.json(jsonResponse(true, updated));
      }

      case 'delete': {
        const query = {};
        if (data.num) query.maintenance_num = data.num;
        else if (data.id) query._id = data.id;
        else return res.status(400).json(jsonResponse(false, 'Missing identifier (num or id) for delete'));

        const deleted = await Maintenance.findOneAndDelete(query);
        if (!deleted) return res.status(404).json(jsonResponse(false, 'Maintenance record not found'));
        return res.json(jsonResponse(true, 'Maintenance record deleted'));
      }

      default:
        return res.status(400).json(jsonResponse(false, 'Invalid action for maintenance'));
    }
  } catch (error) {
    console.error('Maintenance API error:', error);
    return res.status(500).json(jsonResponse(false, error.message || 'Internal error'));
  }
});

// CALENDAR (Mock implementation)
app.post('/api/calendar', async (req, res) => {
  try {
    const { action } = req.body;

    switch (action) {
      case 'read':
        // For now, return empty array
        return res.json(jsonResponse(true, []));

      default:
        return res.status(400).json(jsonResponse(false, "Invalid action for calendar"));
    }
  } catch (error) {
    res.status(500).json(jsonResponse(false, error.message));
  }
});

// REPORT (Mock implementation)
app.post('/api/report', async (req, res) => {
  try {
    const { q } = req.body;
    
    const mockResponse = `Based on your question "${q}", this is a mock response from the reporting system.`;
    
    return res.json(jsonResponse(true, mockResponse));
  } catch (error) {
    res.status(500).json(jsonResponse(false, error.message));
  }
});

// ---------------------- REPLACE THE EXISTING DELETE ROUTE FOR RESERVATIONS WITH THE IMPROVED HANDLER ----------------------
app.delete('/api/reservations/:id', async (req, res) => {
  try {
    const id = req.params.id;

    // validate id
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, error: 'Invalid reservation id' });
    }

    // load reservation (lean for simpler manipulation)
    const reservation = await Reservation.findById(id).lean();
    if (!reservation) {
      return res.status(404).json({ success: false, error: 'Reservation not found' });
    }

    // Delete the reservation
    await Reservation.deleteOne({ _id: id });

    // Best-effort: remove any StudentPrep records that reference this reservation_code
    try {
      if (reservation.reservation_code) {
        await StudentPrep.deleteMany({ reservation_code: reservation.reservation_code }).catch(() => {});
      }
    } catch (spErr) {
      console.warn('Failed to cleanup StudentPrep records for reservation:', spErr);
    }

    // Best-effort: adjust inventory borrowed counts for assigned_items (non-fatal)
    try {
      const assigned = Array.isArray(reservation.assigned_items) ? reservation.assigned_items : [];
      for (const ai of assigned) {
        if (!ai || !ai.item_id) continue;
        const lookup = isNaN(Number(ai.item_id)) ? ai.item_id : Number(ai.item_id);
        const inv = await Inventory.findOne({ equipment_num: lookup });
        if (!inv) continue;
        inv.borrowed = Math.max(0, (inv.borrowed || 0) - (ai.quantity || 0));
        await inv.save();
      }
    } catch (invErr) {
      console.warn('Inventory adjustment failed while deleting reservation:', invErr);
    }

    // emit socket event (if io available)
    try {
      if (typeof io !== 'undefined' && io.to) {
        io.to(id).emit('reservationDeleted', { reservationId: id });
      }
    } catch (emitErr) {
      console.warn('Socket emit failed for reservation deletion:', emitErr);
    }

    return res.json({ success: true, message: 'Reservation deleted', reservationId: id });
  } catch (error) {
    console.error('Delete reservation error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
});
// ---------------------- END ADDITION ----------------------

// -------------------- FORECASTING API (with subject field) --------------------
app.post('/api/forecast-request', async (req, res) => {
  console.log('[forecast-request] incoming', { body: req.body, time: new Date().toISOString() });
  try {
    const action = (req.body.action || '').toString();
    const user = req.body.user || {};
    if (!action) return res.status(400).json({ success: false, error: 'Missing action' });

    // Ensure model available
    if (!ForecastRequest) {
      console.error('[forecast-request] ForecastRequest model missing');
      return res.status(500).json({ success: false, error: 'Server misconfiguration' });
    }

    if (action === 'create') {
      if (!user.email || !user.name) {
        return res.status(400).json({ success: false, error: 'Missing user info' });
      }
      
      // IMPORTANT: Include 'subject' in destructuring
      const { school = '', school_year = '', semester, subject = '', items } = req.body;
      
      console.log('[forecast-request] create data:', { 
        school, 
        school_year, 
        semester, 
        subject, 
        itemsCount: items?.length,
        userEmail: user.email 
      });
      
      if (!semester || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: 'Missing semester or items' });
      }
      
      const doc = new ForecastRequest({
        requester_email: user.email,
        requester_name: user.name,
        school,
        school_year,
        semester,
        subject, // This will now save the subject value
        items,
        status: 'Pending',
        date_requested: new Date()
      });
      
      await doc.save();
      console.log('[forecast-request] created', { id: doc._id, subject: doc.subject });
      return res.json({ success: true, data: doc });
    }

    if (action === 'read') {
      if (!user.email) {
        return res.status(400).json({ success: false, error: 'Missing user email' });
      }
      const list = await ForecastRequest.find({ requester_email: user.email }).sort({ date_requested: -1 });
      console.log('[forecast-request] read', { count: list.length, user: user.email });
      return res.json({ success: true, data: list });
    }

    if (action === 'update') {
      const id = req.body.id;
      if (!id || !user.email) {
        return res.status(400).json({ success: false, error: 'Missing id or user' });
      }
      
      const doc = await ForecastRequest.findById(id);
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      
      const role = req.body.user?.role || '';
      if (doc.requester_email !== user.email && !['Custodian', 'Admin'].includes(role)) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }
      
      if ((doc.status || 'Pending') !== 'Pending') {
        return res.status(400).json({ success: false, error: 'Only Pending requests may be edited' });
      }
      
      const update = {};
      if (typeof req.body.school !== 'undefined') update.school = req.body.school;
      if (typeof req.body.school_year !== 'undefined') update.school_year = req.body.school_year;
      if (typeof req.body.semester !== 'undefined') update.semester = req.body.semester;
      if (typeof req.body.subject !== 'undefined') update.subject = req.body.subject; // Include subject update
      if (Array.isArray(req.body.items)) update.items = req.body.items;
      
      const updated = await ForecastRequest.findByIdAndUpdate(id, { $set: update }, { new: true });
      console.log('[forecast-request] updated', { id, subject: updated?.subject });
      return res.json({ success: true, data: updated });
    }

    if (action === 'delete') {
      const id = req.body.id;
      if (!id || !user.email) {
        return res.status(400).json({ success: false, error: 'Missing id or user' });
      }
      
      const doc = await ForecastRequest.findById(id);
      if (!doc) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      
      const role = req.body.user?.role || '';
      if (doc.requester_email !== user.email && !['Custodian', 'Admin'].includes(role)) {
        return res.status(403).json({ success: false, error: 'Not authorized' });
      }
      
      await ForecastRequest.findByIdAndDelete(id);
      console.log('[forecast-request] deleted', { id });
      return res.json({ success: true, data: { id } });
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });
  } catch (err) {
    console.error('[forecast-request] error', err);
    return res.status(500).json({ success: false, error: err && err.message ? err.message : 'Internal error' });
  }
});

// -------------------- FORECAST APPROVAL API --------------------
app.post('/api/forecast-approval', async (req, res) => {
  console.log('[forecast-approval] incoming', { body: req.body, time: new Date().toISOString() });
  try {
    const action = (req.body.action || '').toString();
    if (!action) return res.status(400).json({ success: false, error: 'Missing action' });

    if (!ForecastRequest) {
      console.error('[forecast-approval] ForecastRequest model missing');
      return res.status(500).json({ success: false, error: 'Server misconfiguration' });
    }

    if (action === 'read') {
      const list = await ForecastRequest.find().sort({ date_requested: -1 });
      console.log('[forecast-approval] read all', { count: list.length });
      return res.json({ success: true, data: list });
    }

    if (action === 'approve') {
      const { id, custodian_email, custodian_name } = req.body;
      if (!id || !custodian_email || !custodian_name) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }
      
      const updated = await ForecastRequest.findByIdAndUpdate(id, {
        status: 'Approved',
        custodian_email,
        custodian_name,
        date_approved: new Date()
      }, { new: true });
      
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      
      console.log('[forecast-approval] approved', { id, by: custodian_email, subject: updated.subject });
      return res.json({ success: true, data: updated });
    }

    if (action === 'reject') {
      const { id, custodian_email, custodian_name, reason } = req.body;
      if (!id || !custodian_email || !custodian_name) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
      }
      
      const updated = await ForecastRequest.findByIdAndUpdate(id, {
        status: 'Rejected',
        custodian_email,
        custodian_name,
        date_rejected: new Date(),
        rejection_reason: reason || 'No reason provided'
      }, { new: true });
      
      if (!updated) {
        return res.status(404).json({ success: false, error: 'Not found' });
      }
      
      console.log('[forecast-approval] rejected', { id, by: custodian_email, reason, subject: updated.subject });
      return res.json({ success: true, data: updated });
    }

    return res.status(400).json({ success: false, error: 'Invalid action' });
  } catch (err) {
    console.error('[forecast-approval] error', err);
    return res.status(500).json({ success: false, error: err && err.message ? err.message : 'Internal error' });
  }
});
// -------------------- END IMPROVED: Forecasting API --------------------

// FIXED: Proper 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// create http server and socket.io
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: '*' } });


// basic socket handlers: join/leave rooms per reservation id
io.on('connection', (socket) => {
  socket.on('join', (roomId) => {
    if (roomId) socket.join(roomId);
  });
  socket.on('leave', (roomId) => {
    if (roomId) socket.leave(roomId);
  });
  socket.on('disconnect', () => {
    // cleanup if needed
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log(`Available endpoints:`);
  console.log(`  POST /api/users`);
  console.log(`  POST /api/pre-setup`);
  console.log(`  POST /api/nc-inventory`);
  console.log(`  POST /api/c-inventory`);
  console.log(`  POST /api/borrow`);
  console.log(`  POST /api/maintenance`);
  console.log(`  POST /api/calendar`);
  console.log(`  POST /api/report`);
  console.log(`  GET  /api/health`);
});