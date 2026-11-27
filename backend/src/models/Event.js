const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    session_id: { type: String, required: true, index: true },
    event_type: { type: String, enum: ['page_view', 'click'], required: true },
    page_url: { type: String, required: true, index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    x: { type: Number, default: null },
    y: { type: Number, default: null },
    viewport_width: { type: Number, default: null },
    viewport_height: { type: Number, default: null },
    device_type: { type: String, enum: ['mobile', 'desktop'], default: 'desktop', index: true },
  },
  { versionKey: false }
);

eventSchema.index({ page_url: 1, event_type: 1 });

module.exports = mongoose.model('Event', eventSchema);
