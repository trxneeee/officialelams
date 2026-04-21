// routes/report.js
const express = require('express');
const router = express.Router();

router.post('/ai-report', async (req, res) => {
  try {
    const { question, itemType } = req.body || {};
    if (!question || !itemType) return res.status(400).json({ success: false, error: 'question and itemType are required' });

    let data = [];
    let collectionName = '';

    try {
      // Non-Consumable
      if (itemType === "Non-Consumable") {
        const NonConsumableInventory = require('../models/NonConsumableInventory');
        const docs = await NonConsumableInventory.find({}).lean();
        collectionName = 'Non-Consumable Inventory';
        data = docs.map(item => ({
          equipment_num: item.equipment_num,
          equipment_name: item.equipment_name,
          brand_model: item.brand_model,
          facility: item.facility,
          room: item.room,
          shelf_no: item.shelf_no,
          total_qty: item.total_qty,
          borrowed: item.borrowed,
    // NEW: Identifiers paired with status
    identifier_status: Array.isArray(item.identifiers)
      ? item.identifiers.map((id, i) => `(${id}:${item.statuses?.[i] || "N/A"})`).join(', ')
      : "",
          total_usage_minutes: item.total_usage_minutes || 0,
          usage_logs_count: Array.isArray(item.usage_logs) ? item.usage_logs.length : 0
        }));
      }
      // Consumable
      else if (itemType === "Consumable") {
        const ConsumableInventory = require('../models/ConsumableInventory');
        const docs = await ConsumableInventory.find({}).lean();
        collectionName = 'Consumable Inventory';
        data = docs.map(item => ({
          item_num: item.item_num,
          description: item.description,
          location: item.location,
          quantity_opened: item.quantity_opened || 0,
          quantity_unopened: item.quantity_unopened || 0,
          quantity_on_order: item.quantity_on_order || 0,
          total_quantity: (item.quantity_opened || 0) + (item.quantity_unopened || 0),
          stock_alert: item.stock_alert || 0,
          is_low_stock: Number(item.quantity_opened || 0) <= Number(item.stock_alert || 0),
          remarks: item.remarks || ''
        }));
      }
      // Borrow
 else if (itemType === "Borrow") {
  const Borrow = require("../models/Borrow");
  const docs = await Borrow.find({}).lean();
  collectionName = "Borrow Records";

  const toPH = (date) => {
    if (!date) return null;
    return new Date(date).toLocaleString("en-PH", {
      timeZone: "Asia/Manila",
      hour12: true,
    });
  };

  data = docs.map(record => {
    const totalItems = (record.items || [])
      .reduce((s, it) => s + (it.quantity || 0), 0);

    const returnedItems = (record.items || [])
      .reduce((s, it) => s + ((it.status === "Returned") ? (it.quantity || 0) : 0), 0);

    // Convert all dates inside items & identifiers
    const itemsPH = (record.items || []).map(item => ({
      ...item,
      date_borrowed: toPH(item.date_borrowed),
      date_returned: toPH(item.date_returned),
      identifiers: (item.identifiers || []).map(id => ({
        ...id,
        date_returned: toPH(id.date_returned)
      }))
    }));

    return {
      ...record,

      // Replace items with PH-converted dates
      items: itemsPH,

      // Convert main record dates
      date_borrowed: toPH(record.date_borrowed),
      date_returned: toPH(record.date_returned),
      createdAt: toPH(record.createdAt),
      updatedAt: toPH(record.updatedAt),

      // Add computed stats
      total_items: totalItems,
      returned_items: returnedItems,
      pending_items: totalItems - returnedItems
    };
  });
}

      // Reservation (ADDED)
      else if (itemType === "Reservation" || itemType === "Reservations") {
        const Reservation = require('../models/Reservation');
        const docs = await Reservation.find({}).lean();
        collectionName = 'Reservations';
        data = docs.map(r => {
          const requested_items = Array.isArray(r.requested_items) ? r.requested_items : [];
          const assigned_items = Array.isArray(r.assigned_items) ? r.assigned_items : [];
          const messages = Array.isArray(r.messages) ? r.messages : [];
          const edits = Array.isArray(r.edits) ? r.edits : [];
          return {
            reservation_id: r.reservation_id ?? null,
            reservation_code: r.reservation_code ?? '',
            subject: r.subject ?? '',
            instructor: r.instructor ?? '',
            instructor_email: r.instructor_email ?? '',
            course: r.course ?? '',
            room: r.room ?? '',
            schedule: r.schedule ?? '',
            startTime: r.startTime ?? null,
            endTime: r.endTime ?? null,
            group_count: r.group_count ?? 0,
            needsItems: !!r.needsItems,
            requested_items_count: requested_items.length,
            total_requested_quantity: requested_items.reduce((s, it) => s + (it.quantity || 0), 0),
            assigned_items_count: assigned_items.length,
            status: r.status ?? '',
            date_created: r.date_created ?? null,
            date_approved: r.date_approved ?? null,
            date_assigned: r.date_assigned ?? null,
            messages_count: messages.length,
            edits_count: edits.length,
            notes_present: !!r.notes
          };
        });
      } else {
        return res.status(400).json({ success: false, error: 'Invalid itemType. Use "Non-Consumable", "Consumable", "Borrow", or "Reservation"' });
      }
    } catch (dbError) {
      console.error('Database error in ai-report:', dbError);
      return res.status(500).json({ success: false, error: 'Failed to fetch data from database: ' + (dbError && dbError.message || String(dbError)) });
    }

    if (!data || data.length === 0) {
      return res.json({ success: true, data: `No ${collectionName.toLowerCase()} data found.` });
    }

    // deterministic fallback if no AI key
    if (!process.env.GEMINI_API_KEY) {
      const q = String(question).toLowerCase();
      if (q.includes('list') || q.includes('table') || q.includes('show')) {
        const sample = data.slice(0, 20);
        const columns = Object.keys(sample[0]);
        const rows = sample.map(d => columns.map(c => (d[c] !== undefined && d[c] !== null) ? String(d[c]) : ''));
        return res.json({ success: true, data: { table: { columns, rows }, summary: `Showing first ${sample.length} of ${data.length} records from ${collectionName}` } });
      } else {
        const summaryParts = [
          `Collection: ${collectionName}`,
          `Total records: ${data.length}`
        ];
        if (itemType.toLowerCase().startsWith('reservation')) {
          const byStatus = data.reduce((acc, d) => { acc[d.status] = (acc[d.status] || 0) + 1; return acc; }, {});
          const avgRequested = Math.round(data.reduce((s,d)=>s + (d.requested_items_count||0),0) / Math.max(1,data.length));
          summaryParts.push(`By status: ${Object.entries(byStatus).map(([k,v])=>`${k||'Unknown'}:${v}`).join(', ')}`);
          summaryParts.push(`Average requested items per reservation: ${avgRequested}`);
        }
        summaryParts.push('Note: AI service not configured; set GEMINI_API_KEY to enable AI responses.');
        return res.json({ success: true, data: summaryParts.join('\n') });
      }
    }

    // attempt AI call if key present (best-effort; guards for SDK shapes)
    try {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel ? genAI.getGenerativeModel({ model: "gemini-2.0-flash" }) : null;

      const prompt = [
        `You are an assistant for ${collectionName}. Just analyze this data, no more other data (no previous data) and answer the user's question based on it.`,
        `Fields: ${Object.keys(data[0]).join(', ')}`,
        `Data sample (first 3): ${JSON.stringify(data.slice(0,3), null, 2)}`,
        `User question: ${question}`,
        `If the user requests a table, return JSON with: { table: { columns: [...], rows: [...] }, summary: "..." }. Otherwise return plain text analysis. Also clean the data, such us "_", capitalization and proper words (no shortcuts) for fields because that will be shown in Tables. Also if it is array, it should be analyzed well and displayed properly.`
      ].join('\n\n');

      let aiText = null;
      if (model && typeof model.generateContent === 'function') {
        const result = await model.generateContent(prompt);
        aiText = result?.outputText || (typeof result === 'string' ? result : null);
        if (!aiText && result?.response) {
          try {
            const resp = await result.response;
            if (typeof resp.text === 'function') aiText = await resp.text();
            else if (resp.outputText) aiText = resp.outputText;
          } catch (e) { /* ignore */ }
        }
      } else if (typeof genAI.generateText === 'function') {
        const out = await genAI.generateText({ model: "gemini-2.0-flash", input: prompt });
        aiText = out?.outputText || out?.text || null;
      }

      if (!aiText) throw new Error('AI invocation did not return text');

      let cleaned = aiText.trim();
      const jsonBlock = cleaned.match(/```json\s*([\s\S]*?)```/);
      if (jsonBlock && jsonBlock[1]) cleaned = jsonBlock[1].trim();
      try {
        const jsonResp = JSON.parse(cleaned);
        return res.json({ success: true, data: jsonResp });
      } catch (e) {
        return res.json({ success: true, data: aiText });
      }
    } catch (aiErr) {
      console.error('AI invocation failed:', aiErr);
      const sample = data.slice(0, 10);
      const columns = Object.keys(sample[0]).slice(0, 8);
      const rows = sample.map(d => columns.map(c => (d[c] !== undefined && d[c] !== null) ? String(d[c]) : ''));
      return res.json({ success: true, data: { table: { columns, rows }, summary: `AI failed; showing first ${sample.length} of ${data.length} records from ${collectionName}. Error: ${String(aiErr.message).slice(0,200)}` } });
    }

  } catch (error) {
    console.error('Unexpected error in ai-report:', error);
    return res.status(500).json({ success: false, error: error && error.message ? error.message : 'Internal server error' });
  }
});

module.exports = router;