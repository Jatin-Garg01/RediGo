const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rideId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride',
    required: true
  },
  razorpayOrderId: {
    type: String,
    required: true
  },
  razorpayPaymentId: {
    type: String,
    required: true
  },
  razorpaySignature: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentMethod: {
    type: String
  },
  refundId: {
    type: String
  },
  refundAmount: {
    type: Number
  },
  refundedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for faster queries
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ razorpayPaymentId: 1 });
transactionSchema.index({ razorpayOrderId: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);