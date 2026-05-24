const mongoose = require('mongoose');
const User = require('../models/User');
const { 
  getUserRides, 
  getUserProfile, 
  updateUserProfile, 
  updateUserRideStatus,
  deleteUserRide
} = require("../service/userService");

const getMyRides = async (req, res) => {
  try {
    const result = await getUserRides(req.user._id);
    console.log(result);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(500).json(result);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const getProfile = async (req, res) => {
  try {
    const result = await getUserProfile(req.user._id);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(404).json(result);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const updateProfile = async (req, res) => {
  try {
    const result = await updateUserProfile(req.user._id, req.body);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const updateRideStatus = async (req, res) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;
    
    const result = await updateUserRideStatus(rideId, req.user._id, status);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

const deleteRide = async (req, res) => {
  try {
    const { rideId } = req.params;
    const result = await deleteUserRide(rideId, req.user._id);
    console.log(result);
    
    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

// ✅ FIXED: Dashboard Stats
const getDashboardStats = async (req, res) => {
  try {
    console.log('📊 getDashboardStats called');
    console.log('📊 User from req.user:', req.user);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user._id; // ✅ Use _id consistently
    console.log('📊 Calculating stats for user:', userId);
    
    const Ride = require('../models/Ride');

    // ✅ Convert to ObjectId to avoid cast errors
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Get user's posted rides
    const userRides = await Ride.find({ driverId: userObjectId });
    console.log(`📊 User posted rides: ${userRides.length}`);
    
    // Get user's booked rides (rides where user is a passenger)
    const bookedRides = await Ride.find({ 
      'passengers.userId': userObjectId 
    });
    console.log(`📊 User booked rides: ${bookedRides.length}`);

    // Filter upcoming booked rides for display count
    const now = new Date();
    const upcomingBookedRides = bookedRides.filter(ride => {
      const rideDate = new Date(ride.date);
      return rideDate >= now;
    });
    console.log(`📊 User upcoming booked rides: ${upcomingBookedRides.length}`);

    // Calculate stats
    const totalRidesOffered = userRides.length;
    const totalRidesBooked = upcomingBookedRides.length; // Only upcoming for display
    
    // Calculate earnings from posted rides
    const totalEarnings = userRides.reduce((sum, ride) => {
      const passengers = ride.passengers || [];
      return sum + (passengers.length * (ride.price || 0));
    }, 0);

    // Calculate money spent on ALL booked rides (completed + upcoming)
    const totalSpent = bookedRides.reduce((sum, ride) => {
      return sum + (ride.price || 0);
    }, 0);

    // Count rides by status
    const completedRides = userRides.filter(ride => ride.status === 'completed').length;
    const activeRides = userRides.filter(ride => 
      ride.status === 'active' || ride.status === 'scheduled' || !ride.status
    ).length;
    const cancelledRides = userRides.filter(ride => ride.status === 'cancelled').length;

    // Count total passengers served
    const totalPassengers = userRides.reduce((sum, ride) => {
      return sum + (ride.passengers?.length || 0);
    }, 0);

    // Count upcoming rides
    const upcomingRides = userRides.filter(ride => {
      const rideDate = new Date(ride.date);
      const now = new Date();
      return rideDate > now && (ride.status !== 'cancelled' && ride.status !== 'completed');
    }).length;

    const stats = {
      totalRidesOffered,
      totalRidesBooked,
      totalEarnings,
      totalSpent,
      completedRides,
      activeRides,
      cancelledRides,
      totalPassengers,
      upcomingRides
    };

    console.log('📊 Calculated stats:', stats);

    res.status(200).json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics',
      error: error.message
    });
  }
};

// ✅ FIXED: Get User Rides
const getUserRidesNew = async (req, res) => {
  try {
    console.log('🔍 getUserRidesNew called');
    console.log('🔍 User from req.user:', req.user);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user._id; // ✅ Use _id consistently
    console.log('🔍 Fetching rides for user:', userId);
    
    const Ride = require('../models/Ride');
    
    // ✅ Convert to ObjectId to avoid cast errors
    const userObjectId = new mongoose.Types.ObjectId(userId);
    
    // ✅ Use only driverId field (most common in ride schemas)
    const rides = await Ride.find({ driverId: userObjectId })
      .populate('passengers.userId', 'name email phone')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${rides.length} rides for user ${userId}`);
    
    res.status(200).json({
      success: true,
      rides,
      count: rides.length
    });

  } catch (error) {
    console.error('❌ Error fetching user rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rides',
      error: error.message
    });
  }
};

// ✅ FIXED: Get Booked Rides
const getBookedRides = async (req, res) => {
  try {
    console.log('🔍 getBookedRides called');
    console.log('🔍 User from req.user:', req.user);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = req.user._id; // ✅ Use _id consistently
    console.log('🔍 Fetching booked rides for user:', userId);
    
    const Ride = require('../models/Ride');
    
    // ✅ Convert to ObjectId to avoid cast errors
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const bookedRides = await Ride.find({ 
      'passengers.userId': userObjectId 
    })
    .populate('driver.userId', 'name email phone')
    .sort({ createdAt: -1 });

    console.log(`✅ Found ${bookedRides.length} booked rides for user ${userId}`);
    console.log('🔍 Sample booked ride structure:', bookedRides.length > 0 ? JSON.stringify(bookedRides[0], null, 2) : 'No rides found');

    // Add driver info to response
    const ridesWithDriverInfo = bookedRides.map(ride => ({
      ...ride.toObject(),
      driverName: ride.driver?.userId?.name || ride.driver?.name || 'Unknown Driver',
      driverPhone: ride.driver?.userId?.phone || ride.driver?.phone || null,
      driverEmail: ride.driver?.userId?.email || ride.driver?.email || null
    }));

    res.status(200).json({
      success: true,
      bookedRides: ridesWithDriverInfo,
      count: ridesWithDriverInfo.length
    });

  } catch (error) {
    console.error('❌ Error fetching booked rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booked rides',
      error: error.message
    });
  }
};

// Profile completion controller
const getProfileCompletion = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const profileData = {
      profileCompletion: user.calculateProfileCompletion(),
      profileCompletionSections: user.profileCompletionSections || [],
      canPublishRides: user.canPublishRides(),
      hasVehicles: user.vehicles && user.vehicles.length > 0,
      vehiclesCount: user.vehicles ? user.vehicles.length : 0,
      isProfileComplete: user.profileCompletionSections && user.profileCompletionSections.includes('basic_info') && 
                       user.profileCompletionSections.includes('contact_info') &&
                       user.profileCompletionSections.includes('emergency_contact'),
      missingFields: []
    };

    // Check missing profile fields
    const requiredFields = ['firstName', 'lastName', 'phoneNumber', 'dateOfBirth', 'gender'];
    for (const field of requiredFields) {
      if (!user[field]) {
        profileData.missingFields.push(field);
      }
    }

    res.json({ success: true, data: profileData });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get profile completion', error: error.message });
  }
};

// Vehicle management controllers
const addVehicle = async (req, res) => {
  try {
    const { make, model, year, color, licensePlate, seatCapacity, vehicleType } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newVehicle = {
      make,
      model,
      year,
      color,
      licensePlate: licensePlate.toUpperCase(),
      seatCapacity: parseInt(seatCapacity),
      vehicleType,
      isActive: true
    };

    user.vehicles.push(newVehicle);
    await user.save();

    res.json({ 
      success: true, 
      message: 'Vehicle added successfully',
      vehicle: user.vehicles[user.vehicles.length - 1]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add vehicle', error: error.message });
  }
};

const getVehicles = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('vehicles');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, vehicles: user.vehicles || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get vehicles', error: error.message });
  }
};

const updateVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;
    const updateData = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const vehicleIndex = user.vehicles.findIndex(v => v._id.toString() === vehicleId);
    if (vehicleIndex === -1) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    // Update vehicle fields
    Object.keys(updateData).forEach(key => {
      if (key !== '_id') {
        user.vehicles[vehicleIndex][key] = updateData[key];
      }
    });

    await user.save();

    res.json({ 
      success: true, 
      message: 'Vehicle updated successfully',
      vehicle: user.vehicles[vehicleIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update vehicle', error: error.message });
  }
};

const deleteVehicle = async (req, res) => {
  try {
    const { vehicleId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const vehicleIndex = user.vehicles.findIndex(v => v._id.toString() === vehicleId);
    if (vehicleIndex === -1) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    user.vehicles.splice(vehicleIndex, 1);
    await user.save();

    res.json({ success: true, message: 'Vehicle deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete vehicle', error: error.message });
  }
};

// Emergency contact management
const addEmergencyContact = async (req, res) => {
  try {
    const { name, phoneNumber, relationship } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const newContact = {
      name,
      phoneNumber,
      relationship
    };

    if (!user.emergencyContacts) {
      user.emergencyContacts = [];
    }
    
    user.emergencyContacts.push(newContact);
    await user.save();

    res.json({ 
      success: true, 
      message: 'Emergency contact added successfully',
      contact: user.emergencyContacts[user.emergencyContacts.length - 1]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add emergency contact', error: error.message });
  }
};

const getEmergencyContacts = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('emergencyContacts');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, contacts: user.emergencyContacts || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get emergency contacts', error: error.message });
  }
};

const updateEmergencyContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const updateData = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const contactIndex = user.emergencyContacts.findIndex(c => c._id.toString() === contactId);
    if (contactIndex === -1) {
      return res.status(404).json({ success: false, message: 'Emergency contact not found' });
    }

    Object.keys(updateData).forEach(key => {
      if (key !== '_id') {
        user.emergencyContacts[contactIndex][key] = updateData[key];
      }
    });

    await user.save();

    res.json({ 
      success: true, 
      message: 'Emergency contact updated successfully',
      contact: user.emergencyContacts[contactIndex]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update emergency contact', error: error.message });
  }
};

const deleteEmergencyContact = async (req, res) => {
  try {
    const { contactId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const contactIndex = user.emergencyContacts.findIndex(c => c._id.toString() === contactId);
    if (contactIndex === -1) {
      return res.status(404).json({ success: false, message: 'Emergency contact not found' });
    }

    user.emergencyContacts.splice(contactIndex, 1);
    await user.save();

    res.json({ success: true, message: 'Emergency contact deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete emergency contact', error: error.message });
  }
};

// Settings management
const updateNotificationSettings = async (req, res) => {
  try {
    const { rideUpdates, messages, promotions, emergencyAlerts } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.notificationSettings = {
      rideUpdates: rideUpdates !== undefined ? rideUpdates : user.notificationSettings.rideUpdates,
      messages: messages !== undefined ? messages : user.notificationSettings.messages,
      promotions: promotions !== undefined ? promotions : user.notificationSettings.promotions,
      emergencyAlerts: emergencyAlerts !== undefined ? emergencyAlerts : user.notificationSettings.emergencyAlerts
    };

    await user.save();

    res.json({ 
      success: true, 
      message: 'Notification settings updated successfully',
      settings: user.notificationSettings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update notification settings', error: error.message });
  }
};

const updatePrivacySettings = async (req, res) => {
  try {
    const { profileVisibility, showEmail, showPhoneNumber } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.privacySettings = {
      profileVisibility: profileVisibility || user.privacySettings.profileVisibility,
      showEmail: showEmail !== undefined ? showEmail : user.privacySettings.showEmail,
      showPhoneNumber: showPhoneNumber !== undefined ? showPhoneNumber : user.privacySettings.showPhoneNumber
    };

    await user.save();

    res.json({ 
      success: true, 
      message: 'Privacy settings updated successfully',
      settings: user.privacySettings
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update privacy settings', error: error.message });
  }
};

const verifyAccount = async (req, res) => {
  try {
    const { documentType, documentNumber } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.verification = {
      isVerified: true,
      documentType,
      documentNumber,
      verifiedAt: new Date()
    };

    await user.save();

    res.json({ 
      success: true, 
      message: 'Account verification submitted successfully',
      verification: user.verification
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify account', error: error.message });
  }
};

// Enhanced profile update with completion tracking
const updateProfileComplete = async (req, res) => {
  try {
    const updateData = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update user fields
    Object.keys(updateData).forEach(key => {
      if (key !== '_id' && key !== 'profileCompletionSections') {
        user[key] = updateData[key];
      }
    });

    // The profile completion will be calculated automatically by the pre-save middleware
    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        profileCompletion: user.calculateProfileCompletion(),
        canPublishRides: user.canPublishRides(),
        vehicles: user.vehicles
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update profile', error: error.message });
  }
};

// Change password controller
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    // Get user with password field
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Verify current password
    const bcrypt = require('bcrypt');
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    user.password = hashedNewPassword;
    await user.save();

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to change password', error: error.message });
  }
};

module.exports = {
  getMyRides,
  getProfile,
  updateProfile,
  updateRideStatus,
  deleteRide,
  getDashboardStats,
  getUserRidesNew,
  getBookedRides,
  // New profile and vehicle management functions
  getProfileCompletion,
  addVehicle,
  getVehicles,
  updateVehicle,
  deleteVehicle,
  addEmergencyContact,
  getEmergencyContacts,
  updateEmergencyContact,
  deleteEmergencyContact,
  updateNotificationSettings,
  updatePrivacySettings,
  verifyAccount,
  updateProfileComplete,
  changePassword
};