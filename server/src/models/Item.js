import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
  // Personal items belong to one user. Admin items belong to the shared
  // admin workspace, so they intentionally do not have a userId.
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function requireUserForPersonalItems() {
      return this.scope !== 'admin';
    },
    index: true
  },
  scope: {
    type: String,
    enum: ['personal', 'admin'],
    default: 'personal',
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },
  details: {
    type: String,
    trim: true,
    maxlength: 500,
    default: ''
  }
}, {
  timestamps: true,
  versionKey: false
});

itemSchema.index({ userId: 1, createdAt: -1 });
itemSchema.index({ scope: 1, createdAt: -1 });

export const Item = mongoose.models.Item || mongoose.model('Item', itemSchema);