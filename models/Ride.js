const mongoose = require('mongoose');

// Passenger schema for ride bookings
const passengerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seatsBooked: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  bookingDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'confirmed'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  pickupLocation: {
    type: String,
    default: null
  },
  dropLocation: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Driver schema
const driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    default: 5,
    min: 0,
    max: 5
  },
  phone: {
    type: String,
    required: true
  },
  email: {
    type: String,
    default: null
  },
  licenseNumber: {
    type: String,
    default: null
  }
});

// Car schema
const carSchema = new mongoose.Schema({
  model: {
    type: String,
    default: null
  },
  color: {
    type: String,
    default: null
  },
  licensePlate: {
    type: String,
    default: null
  },
  year: {
    type: Number,
    default: null
  },
  make: {
    type: String,
    default: null
  }
});

// Coordinates schema for location data
const coordinatesSchema = new mongoose.Schema({
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  }
}, { _id: false });

// Main ride schema
const rideSchema = new mongoose.Schema({
  // Location information
  from: {
    type: String,
    required: true,
    trim: true
  },
  to: {
    type: String,
    required: true,
    trim: true
  },
  fromCoords: {
    type: coordinatesSchema,
    default: null
  },
  toCoords: {
    type: coordinatesSchema,
    default: null
  },
  
  // Date and time
  date: {
    type: Date,
    required: true
  },
  time: {
    type: String,
    required: true,
    match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/ // HH:MM format validation
  },
  
  // Seat and pricing information
  seats: {
    type: Number,
    required: true,
    min: 1,
    max: 8,
    default: function() {
      return this.availableSeats;
    }
  },
  availableSeats: {
    type: Number,
    required: true,
    min: 0,
    max: 8
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Route information
  distance: {
    type: String,
    default: null
  },
  duration: {
    type: String,
    default: null
  },
  
  // Driver information (embedded schema)
  driver: {
    type: driverSchema,
    required: true
  },
  
  // Car information (embedded schema)
  car: {
    type: carSchema,
    default: () => ({})
  },
  
  // Passengers array (for bookings)
  passengers: [passengerSchema],
  
  // Additional information
  notes: {
    type: String,
    maxlength: 1000,
    default: null
  },
  
  // Ride preferences
  preferences: {
    smoking: {
      type: Boolean,
      default: false
    },
    pets: {
      type: Boolean,
      default: false
    },
    music: {
      type: Boolean,
      default: true
    },
    luggage: {
      type: String,
      enum: ['none', 'small', 'medium', 'large'],
      default: 'medium'
    }
  },
  
  // Ride status
  status: {
    type: String,
    enum: ["active", "completed", "cancelled", "started", "full"],
    default: "active"
  },
  
  // Ride type
  rideType: {
    type: String,
    enum: ['regular', 'express', 'luxury'],
    default: 'regular'
  },
  
  // Booking settings
  instantBooking: {
    type: Boolean,
    default: true
  },
  
  // Cancellation policy
  cancellationPolicy: {
    type: String,
    enum: ['flexible', 'moderate', 'strict'],
    default: 'moderate'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
rideSchema.index({ from: 1, to: 1, date: 1 });
rideSchema.index({ 'driver.userId': 1 });
rideSchema.index({ 'passengers.userId': 1 });
rideSchema.index({ date: 1, status: 1 });
rideSchema.index({ createdAt: -1 });
rideSchema.index({ status: 1, availableSeats: 1 });

// Compound index for search queries
rideSchema.index({ 
  from: 'text', 
  to: 'text', 
  'driver.name': 'text' 
});

// Virtual for total booked seats
rideSchema.virtual('bookedSeats').get(function() {
  return this.passengers.reduce((total, passenger) => {
    return total + (passenger.seatsBooked || 0);
  }, 0);
});

// Virtual for remaining seats (calculated)
rideSchema.virtual('remainingSeats').get(function() {
  return this.availableSeats;
});

// Virtual for total earnings (for driver)
rideSchema.virtual('totalEarnings').get(function() {
  return this.passengers.reduce((total, passenger) => {
    return total + (this.price * (passenger.seatsBooked || 0));
  }, 0);
});

// Virtual for ride status display
rideSchema.virtual('displayStatus').get(function() {
  if (this.availableSeats === 0) return 'Full';
  if (new Date(this.date) < new Date()) return 'Completed';
  return this.status.charAt(0).toUpperCase() + this.status.slice(1);
});

// Virtual for formatted date
rideSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('en-IN', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
});

// Virtual for ride duration in readable format
rideSchema.virtual('formattedDuration').get(function() {
  if (!this.duration) return 'N/A';
  return this.duration;
});

// Pre-save middleware to update available seats and total seats
rideSchema.pre('save', function(next) {
  // Calculate booked seats
  const bookedSeats = this.passengers.reduce((total, passenger) => {
    return total + (passenger.seatsBooked || 0);
  }, 0);
  
  // If this is a new document and seats is not set, set it to availableSeats
  if (this.isNew && !this.seats) {
    this.seats = this.availableSeats;
  }
  
  // If passengers were modified, recalculate available seats
  if (this.isModified('passengers')) {
    this.availableSeats = this.seats - bookedSeats;
  }
  
  // Update status based on available seats
  if (this.availableSeats === 0 && this.status === 'active') {
    this.status = 'full';
  } else if (this.availableSeats > 0 && this.status === 'full') {
    this.status = 'active';
  }
  
  // Validate that available seats is not negative
  if (this.availableSeats < 0) {
    const err = new Error('Available seats cannot be negative');
    return next(err);
  }
  
  next();
});

// Pre-save middleware for date validation
rideSchema.pre('save', function(next) {
  // Only validate date for new rides or if date is modified
  if (this.isNew || this.isModified('date')) {
    const now = new Date();
    const rideDate = new Date(this.date);
    
    // Allow rides to be created for today or future dates
    if (rideDate < now.setHours(0, 0, 0, 0)) {
      const err = new Error('Ride date cannot be in the past');
      return next(err);
    }
  }
  next();
});

// Static methods for common queries
rideSchema.statics.findAvailableRides = function(from, to, date, seatsNeeded = 1) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  return this.find({
    from: new RegExp(from, 'i'),
    to: new RegExp(to, 'i'),
    date: {
      $gte: startDate,
      $lte: endDate
    },
    availableSeats: { $gte: seatsNeeded },
    status: { $in: ['active', 'started'] }
  })
  .populate('driver.userId', 'name phone email profilePicture rating')
  .populate('passengers.userId', 'name profilePicture')
  .sort({ date: 1, createdAt: 1 });
};

rideSchema.statics.findUserRides = function(userId, role = 'both') {
  const query = {};
  
  if (role === 'driver') {
    query['driver.userId'] = userId;
  } else if (role === 'passenger') {
    query['passengers.userId'] = userId;
  } else {
    query.$or = [
      { 'driver.userId': userId },
      { 'passengers.userId': userId }
    ];
  }
  
  return this.find(query)
    .populate('driver.userId', 'name phone email profilePicture rating')
    .populate('passengers.userId', 'name phone email profilePicture')
    .sort({ date: -1 });
};

// Instance methods
rideSchema.methods.canUserBook = function(userId, seatsNeeded = 1) {
  // Convert ObjectIds to strings for comparison
  const userIdStr = userId.toString();
  const driverIdStr = this.driver.userId.toString();
  
   
  if (driverIdStr === userIdStr) {
    return { canBook: false, reason: 'Cannot book your own ride' };
  }
  
  
  const alreadyBooked = this.passengers.some(p => 
    p.userId.toString() === userIdStr
  );
  if (alreadyBooked) {
    return { canBook: false, reason: 'Already booked this ride' };
  }
  
 
  if (this.availableSeats < seatsNeeded) {
    return { canBook: false, reason: 'Not enough seats available' };
  }
  
  
  const now = new Date();
  const rideDateTime = new Date(`${this.date.toDateString()} ${this.time}`);
  if (rideDateTime < now) {
    return { canBook: false, reason: 'Ride time has passed' };
  }
  
 
  if (!['active', 'started'].includes(this.status)) {
    return { canBook: false, reason: 'Ride is not available for booking' };
  }
  
  return { canBook: true };
};

rideSchema.methods.addPassenger = function(userId, seatsBooked = 1, additionalInfo = {}) {
  const canBook = this.canUserBook(userId, seatsBooked);
  if (!canBook.canBook) {
    throw new Error(canBook.reason);
  }
  
  this.passengers.push({
    userId,
    seatsBooked,
    bookingDate: new Date(),
    status: 'confirmed',
    ...additionalInfo
  });
  
  return this.save();
};

rideSchema.methods.removePassenger = function(userId) {
  const passengerIndex = this.passengers.findIndex(p => 
    p.userId.toString() === userId.toString()
  );
  
  if (passengerIndex === -1) {
    throw new Error('Passenger not found in this ride');
  }
  
  const removedPassenger = this.passengers.splice(passengerIndex, 1)[0];
  return { passenger: removedPassenger, ride: this.save() };
};

 
rideSchema.methods.getSummary = function() {
  return {
    id: this._id,
    route: `${this.from} → ${this.to}`,
    date: this.formattedDate,
    time: this.time,
    price: this.price,
    availableSeats: this.availableSeats,
    totalSeats: this.seats,
    status: this.displayStatus,
    driver: {
      name: this.driver.name,
      rating: this.driver.rating,
      phone: this.driver.phone
    },
    car: this.car,
    totalPassengers: this.passengers.length,
    totalEarnings: this.totalEarnings
  };
};

const Ride = mongoose.model('Ride', rideSchema);

module.exports = Ride;