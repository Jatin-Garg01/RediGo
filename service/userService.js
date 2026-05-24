const User = require("../models/User");
const Ride = require("../models/Ride");



const getUserRides = async (userId) => {
  try {
    const rides = await Ride.find({ 'driver.userId': userId })
                           .sort({ date: -1 }); 

    return {
      success: true,
      rides
    };
  } catch (err) {
    return {
      success: false,
      message: err.message
    };
  }
};

 
const getUserProfile = async (userId) => {
  try {
    const user = await User.findById(userId).populate('rides');
    
    if (!user) {
      return {
        success: false,
        message: "User not found"
      };
    }

    return {
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        gender: user.gender,
        city: user.city,
        profileCompletionPercentage: user.profileCompletionPercentage,
        profileCompletionSections: user.profileCompletionSections || [],
        isProfileComplete: user.isProfileComplete,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        emergencyContacts: user.emergencyContacts || [],
        vehicles: user.vehicles || [],
        notificationSettings: user.notificationSettings,
        privacySettings: user.privacySettings,
        totalRides: user.rides.length,
        rides: user.rides,
        bio: user.bio,
        address: user.address,
        state: user.state,
        profilePicture: user.profilePicture
      }
    };
  } catch (err) {
    return {
      success: false,
      message: err.message
    };
  }
};

 
const updateUserProfile = async (userId, updateData) => {
  try {
    // Clean and validate the update data
    const cleanedData = { ...updateData };
    
    // Convert dateOfBirth string to Date if provided
    if (cleanedData.dateOfBirth && typeof cleanedData.dateOfBirth === 'string') {
      cleanedData.dateOfBirth = new Date(cleanedData.dateOfBirth);
    }
    
    // Remove empty strings and convert to null/undefined for optional fields
    Object.keys(cleanedData).forEach(key => {
      if (cleanedData[key] === '') {
        delete cleanedData[key];
      }
    });
    
    console.log('Cleaned update data:', cleanedData);
    
    const user = await User.findByIdAndUpdate(
      userId,
      cleanedData,
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return {
        success: false,
        message: "User not found"
      };
    }

    return {
      success: true,
      message: "Profile updated successfully",
      user
    };
  } catch (err) {
    console.log('User update error:', err);
    
    // Handle validation errors
    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(error => error.message);
      return {
        success: false,
        message: `Validation failed: ${validationErrors.join(', ')}`
      };
    }
    
    // Handle duplicate key errors
    if (err.code === 11000) {
      return {
        success: false,
        message: 'Email or phone number already exists'
      };
    }
    
    return {
      success: false,
      message: err.message || 'Failed to update profile'
    };
  }
};

// Update ride status (user can only update their own rides)
const updateUserRideStatus = async (rideId, userId, status) => {
  try {
    const ride = await Ride.findOneAndUpdate(
      { _id: rideId, 'driver.userId': userId }, // Only owner can update
      { status },
      { new: true }
    );

    if (!ride) {
      return {
        success: false,
        message: "Ride not found or unauthorized"
      };
    }

    return {
      success: true,
      message: "Ride status updated successfully",
      ride
    };
  } catch (err) {
    return {
      success: false,
      message: err.message
    };
  }
};


const deleteUserRide = async (rideId, userId) => {
  try {
 
    const ride = await Ride.findOneAndDelete({
      _id: rideId,
      "driver.userId": userId,
    });

    if (!ride) {
      return {
        success: false,
        message: "Ride not found or unauthorized",
      };
    }

    await User.findByIdAndUpdate(userId, {
      $pull: { rides: rideId },
    });

    return {
      success: true,
      message: "Ride deleted successfully",
    };
  } catch (err) {
    return {
      success: false,
      message: "Internal server error",
      error: err.message,
    };
  }
};

// Profile completion service
const calculateUserProfileCompletion = async (userId) => {
  try {
    const user = await User.findById(userId);
    
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const completionData = {
      profileCompletion: user.calculateProfileCompletion(),
      profileCompletionSections: user.profileCompletionSections || [],
      canPublishRides: user.canPublishRides(),
      hasVehicles: user.vehicles && user.vehicles.length > 0,
      vehiclesCount: user.vehicles ? user.vehicles.length : 0,
      missingFields: []
    };

    // Check for missing required fields
    const requiredFields = [
      { field: 'firstName', label: 'First Name' },
      { field: 'lastName', label: 'Last Name' },
      { field: 'phoneNumber', label: 'Phone Number' },
      { field: 'dateOfBirth', label: 'Date of Birth' },
      { field: 'gender', label: 'Gender' }
      
    ];

    requiredFields.forEach(({ field, label }) => {
      if (!user[field]) {
        completionData.missingFields.push({ field, label });
      }
    });

    return { success: true, data: completionData };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Vehicle management services
const validateVehicleData = (vehicleData) => {
  const { make, model, year, color, licensePlate, seatCapacity, vehicleType } = vehicleData;
  
  if (!make || !model || !year || !color || !licensePlate || !seatCapacity || !vehicleType) {
    return { isValid: false, message: 'All vehicle fields are required' };
  }
  
  if (year < 1990 || year > new Date().getFullYear() + 1) {
    return { isValid: false, message: 'Invalid vehicle year' };
  }
  
  if (seatCapacity < 1 || seatCapacity > 8) {
    return { isValid: false, message: 'Seat capacity must be between 1 and 8' };
  }
  
  const validVehicleTypes = ['sedan', 'hatchback', 'suv', 'coupe', 'convertible', 'wagon', 'pickup', 'van'];
  if (!validVehicleTypes.includes(vehicleType.toLowerCase())) {
    return { isValid: false, message: 'Invalid vehicle type' };
  }
  
  return { isValid: true };
};

const addUserVehicle = async (userId, vehicleData) => {
  try {
    const validation = validateVehicleData(vehicleData);
    if (!validation.isValid) {
      return { success: false, message: validation.message };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    // Check for duplicate license plates
    const existingVehicle = user.vehicles.find(v => 
      v.licensePlate.toUpperCase() === vehicleData.licensePlate.toUpperCase()
    );
    
    if (existingVehicle) {
      return { success: false, message: 'Vehicle with this license plate already exists' };
    }

    const newVehicle = {
      ...vehicleData,
      licensePlate: vehicleData.licensePlate.toUpperCase(),
      seatCapacity: parseInt(vehicleData.seatCapacity),
      vehicleType: vehicleData.vehicleType.toLowerCase(),
      isActive: true
    };

    user.vehicles.push(newVehicle);
    await user.save();

    return {
      success: true,
      message: 'Vehicle added successfully',
      vehicle: user.vehicles[user.vehicles.length - 1]
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

const getUserVehicles = async (userId) => {
  try {
    const user = await User.findById(userId).select('vehicles');
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    return { success: true, vehicles: user.vehicles || [] };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

const updateUserVehicle = async (userId, vehicleId, updateData) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const vehicleIndex = user.vehicles.findIndex(v => v._id.toString() === vehicleId);
    if (vehicleIndex === -1) {
      return { success: false, message: 'Vehicle not found' };
    }

    // Validate update data if provided
    if (Object.keys(updateData).length > 0) {
      const validation = validateVehicleData({ ...user.vehicles[vehicleIndex].toObject(), ...updateData });
      if (!validation.isValid) {
        return { success: false, message: validation.message };
      }
    }

    // Update vehicle fields
    Object.keys(updateData).forEach(key => {
      if (key !== '_id') {
        user.vehicles[vehicleIndex][key] = updateData[key];
      }
    });

    await user.save();

    return {
      success: true,
      message: 'Vehicle updated successfully',
      vehicle: user.vehicles[vehicleIndex]
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

const deleteUserVehicle = async (userId, vehicleId) => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    const vehicleIndex = user.vehicles.findIndex(v => v._id.toString() === vehicleId);
    if (vehicleIndex === -1) {
      return { success: false, message: 'Vehicle not found' };
    }

    user.vehicles.splice(vehicleIndex, 1);
    await user.save();

    return { success: true, message: 'Vehicle deleted successfully' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

// Emergency contact services
const validateEmergencyContactData = (contactData) => {
  const { name, phoneNumber, relationship } = contactData;
  
  if (!name || !phoneNumber || !relationship) {
    return { isValid: false, message: 'All emergency contact fields are required' };
  }
  
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,15}$/;
  if (!phoneRegex.test(phoneNumber)) {
    return { isValid: false, message: 'Invalid phone number format' };
  }
  
  const validRelationships = ['parent', 'spouse', 'sibling', 'friend', 'relative', 'colleague', 'other'];
  if (!validRelationships.includes(relationship.toLowerCase())) {
    return { isValid: false, message: 'Invalid relationship type' };
  }
  
  return { isValid: true };
};

const addEmergencyContact = async (userId, contactData) => {
  try {
    const validation = validateEmergencyContactData(contactData);
    if (!validation.isValid) {
      return { success: false, message: validation.message };
    }

    const user = await User.findById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }

    if (!user.emergencyContacts) {
      user.emergencyContacts = [];
    }

    // Limit to 3 emergency contacts
    if (user.emergencyContacts.length >= 3) {
      return { success: false, message: 'Maximum 3 emergency contacts allowed' };
    }

    const newContact = {
      ...contactData,
      relationship: contactData.relationship.toLowerCase()
    };

    user.emergencyContacts.push(newContact);
    await user.save();

    return {
      success: true,
      message: 'Emergency contact added successfully',
      contact: user.emergencyContacts[user.emergencyContacts.length - 1]
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

module.exports = {
  getUserRides,
  getUserProfile,
  updateUserProfile,
  updateUserRideStatus,
  deleteUserRide,
  // New profile and vehicle management services
  calculateUserProfileCompletion,
  validateVehicleData,
  addUserVehicle,
  getUserVehicles,
  updateUserVehicle,
  deleteUserVehicle,
  validateEmergencyContactData,
  addEmergencyContact
};