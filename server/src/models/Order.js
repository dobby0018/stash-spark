
import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  // Customer who placed the order
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },

  // Product being ordered
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },

  // Product details saved at purchase time
  productName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 120
  },

  sku: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    maxlength: 40
  },

  // Quantity requested
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Order quantity must be at least 1.'],
    validate: {
      validator: Number.isInteger,
      message: 'Order quantity must be a whole number.'
    }
  },

  // Price copied from the product by the backend
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Unit price cannot be negative.'],
    validate: {
      validator: Number.isFinite,
      message: 'Unit price must be a valid number.'
    }
  },

  totalAmount: {
    type: Number,
    required: true,
    min: [0, 'Order total cannot be negative.'],
    validate: {
      validator: Number.isFinite,
      message: 'Order total must be a valid number.'
    }
  },

  status: {
    type: String,
    enum: [
      'placed',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'completed',
      'cancelled'
    ],
    default: 'placed',
    index: true
  },

  // Customer confirms receipt
  receivedAt: {
    type: Date,
    default: null
  },

  // Order completion timestamp
  completedAt: {
    type: Date,
    default: null
  },

  // Prevent restoring stock more than once
  stockRestored: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  versionKey: false
});

// Validate totalAmount when both component values change.
// The backend must still calculate the total itself.
orderSchema.pre('validate', function () {
  if (
    Number.isFinite(this.quantity) &&
    Number.isFinite(this.unitPrice) &&
    Number.isFinite(this.totalAmount)
  ) {
    const expectedTotal = Math.round(
      this.quantity * this.unitPrice * 100
    ) / 100;

    if (Math.abs(this.totalAmount - expectedTotal) > 0.001) {
      this.invalidate(
        'totalAmount',
        'Order total must equal quantity multiplied by unit price.'
      );
    }
  }
});

// Indexes for order listings and filtering
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ productId: 1, createdAt: -1 });

export const Order =
  mongoose.models.Order ||
  mongoose.model('Order', orderSchema);
