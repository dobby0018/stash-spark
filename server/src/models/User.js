
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    unique: true,
    maxlength: 254
  },

  // Required for password accounts, optional for Google accounts.
  passwordHash: {
    type: String,
    required: function () {
      return !this.googleId;
    },
    select: false
  },

  // Google's stable unique account identifier.
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },

  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
    index: true
  }
}, {
  timestamps: true,
  versionKey: false
});

export const User =
  mongoose.models.User ||
  mongoose.model('User', userSchema);
