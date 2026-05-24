const mongoose = require('mongoose');
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    profilePicture: { type: String },
    dateOfBirth: { type: Date },
    gender: { 
      type: String, 
      enum: ['male', 'female', 'other', 'prefer-not-to-say'] 
    },
    address: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },
    bio: { type: String, maxLength: 300 },
    
    // Profile completion tracking
    profileCompletionSections: [{
      section: {
        type: String,
        enum: [
          'basic_info',      // name, email, phone
          'personal_info',   // date of birth, gender
          'location_info',   // address, city, state, pincode
          'bio_info',        // bio, profile picture
          'vehicles',        // at least one vehicle added
          'emergency_contacts' // emergency contacts added
        ]
      },
      completed: { type: Boolean, default: false },
      completedAt: { type: Date }
    }],
    
    // Overall profile completion percentage
    profileCompletionPercentage: { 
      type: Number, 
      default: 0,
      min: 0,
      max: 100 
    },
    
    // Profile completion status
    isProfileComplete: { type: Boolean, default: false },
    
    // Vehicles array
    vehicles: [{
      make: { type: String, required: true },
      model: { type: String, required: true },
      year: { type: Number, required: true },
      color: { type: String, required: true },
      licensePlate: { type: String, required: true },
      vehicleType: { 
        type: String, 
        enum: ['car', 'suv', 'truck', 'van', 'motorcycle'],
        default: 'car'
      },
      isVerified: { type: Boolean, default: false },
      addedAt: { type: Date, default: Date.now }
    }],
    
    // Emergency contacts
    emergencyContacts: [{
      name: { type: String, required: true },
      phone: { type: String, required: true },
      relationship: { 
        type: String,
        enum: ['parent', 'spouse', 'sibling', 'friend', 'other']
      },
      addedAt: { type: Date, default: Date.now }
    }],
    
    // User statistics
    rating: { type: Number, default: 5.0, min: 1, max: 5 },
    totalRides: { type: Number, default: 0 },
    totalEarnings: { type: Number, default: 0 },
    totalSavings: { type: Number, default: 0 },
    
    // Notification preferences
    notificationSettings: {
      emailNotifications: { type: Boolean, default: true },
      smsNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
      rideUpdates: { type: Boolean, default: true },
      promotions: { type: Boolean, default: false },
      weeklyReports: { type: Boolean, default: true }
    },
    
    // Privacy settings
    privacySettings: {
      showPhone: { type: Boolean, default: true },
      showEmail: { type: Boolean, default: false },
      showLastSeen: { type: Boolean, default: true },
      allowMessages: { type: Boolean, default: true },
      shareLocation: { type: Boolean, default: true }
    },
    
    rides: [{ type: mongoose.Schema.Types.ObjectId, ref: "Ride" }],
    
    // Account status
    isEmailVerified: { type: Boolean, default: false },
    isPhoneVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    joinDate: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// Method to calculate profile completion percentage
userSchema.methods.calculateProfileCompletion = function() {
  const sections = [
    {
      name: 'basic_info',
      check: () => this.name && this.email && this.phone
    },
    {
      name: 'personal_info', 
      check: () => this.dateOfBirth && this.gender
    },
    {
      name: 'location_info',
      check: () => this.address && this.city && this.state
    },
    {
      name: 'bio_info',
      check: () => this.bio && this.profilePicture
    },
    {
      name: 'vehicles',
      check: () => this.vehicles && this.vehicles.length > 0
    },
    {
      name: 'emergency_contacts',
      check: () => this.emergencyContacts && this.emergencyContacts.length > 0
    }
  ];

  let completedSections = 0;
  const updatedSections = [];

  sections.forEach(section => {
    const isCompleted = section.check();
    if (isCompleted) completedSections++;

    // Update or add section status
    const existingSection = this.profileCompletionSections.find(s => s.section === section.name);
    if (existingSection) {
      existingSection.completed = isCompleted;
      if (isCompleted && !existingSection.completedAt) {
        existingSection.completedAt = new Date();
      }
    } else {
      updatedSections.push({
        section: section.name,
        completed: isCompleted,
        completedAt: isCompleted ? new Date() : null
      });
    }
  });

  // Add new sections
  updatedSections.forEach(section => {
    this.profileCompletionSections.push(section);
  });

  // Calculate percentage
  this.profileCompletionPercentage = Math.round((completedSections / sections.length) * 100);
  
  // Set profile complete status (require at least basic_info and vehicles)
  const hasBasicInfo = sections[0].check(); // basic_info
  const hasVehicles = sections[4].check(); // vehicles
  this.isProfileComplete = hasBasicInfo && hasVehicles;

  return {
    percentage: this.profileCompletionPercentage,
    isComplete: this.isProfileComplete,
    completedSections: completedSections,
    totalSections: sections.length,
    sections: this.profileCompletionSections
  };
};

// Method to check if user can publish rides
userSchema.methods.canPublishRides = function() {
  const basicInfo = this.name && this.email && this.phone;
  const hasVehicles = this.vehicles && this.vehicles.length > 0;
  return basicInfo && hasVehicles;
};

// Method to get missing requirements for ride publishing
userSchema.methods.getRidePublishingRequirements = function() {
  const requirements = [];
  
  if (!this.name) requirements.push('Full name is required');
  if (!this.email) requirements.push('Email address is required');
  if (!this.phone) requirements.push('Phone number is required');
  if (!this.vehicles || this.vehicles.length === 0) {
    requirements.push('At least one vehicle must be added');
  }
  
  return requirements;
};

// Pre-save middleware to calculate profile completion
userSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.calculateProfileCompletion();
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
