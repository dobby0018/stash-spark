
import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required.'],
    trim: true,
    maxlength: [120, 'Product name must be at most 120 characters.']
  },

  sku: {
    type: String,
    required: [true, 'SKU is required.'],
    trim: true,
    uppercase: true,
    maxlength: [40, 'SKU must be at most 40 characters.'],
    match: [
      /^[A-Z0-9][A-Z0-9._-]*$/,
      'SKU can contain letters, numbers, dots, underscores and hyphens.'
    ],
    unique: true
  },

  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description must be at most 1000 characters.'],
    default: ''
  },

  category: {
    type: String,
    required: [true, 'Category is required.'],
    trim: true,
    maxlength: [80, 'Category must be at most 80 characters.']
  },

  price: {
    type: Number,
    required: [true, 'Price is required.'],
    min: [0, 'Price cannot be negative.'],
    validate: {
      validator: Number.isFinite,
      message: 'Price must be a valid number.'
    }
  },

  stock: {
    type: Number,
    required: true,
    default: 0,
    min: [0, 'Stock cannot be negative.'],
    validate: {
      validator: Number.isInteger,
      message: 'Stock must be a whole number.'
    }
  },

  reorderLevel: {
    type: Number,
    required: true,
    default: 5,
    min: [0, 'Reorder level cannot be negative.'],
    validate: {
      validator: Number.isInteger,
      message: 'Reorder level must be a whole number.'
    }
  },

  isActive: {
    type: Boolean,
    default: true,
    index: true
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, {
  timestamps: true,
  versionKey: false
});

productSchema.index({
  name: 'text',
  sku: 'text',
  category: 'text'
});

productSchema.index({
  category: 1,
  isActive: 1
});

productSchema.index({
  stock: 1,
  reorderLevel: 1
});

export const Product =
  mongoose.models.Product ||
  mongoose.model('Product', productSchema);
