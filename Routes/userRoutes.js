const express = require("express");
const { protect } = require("../middlewares/protect");
const { 
  getMyRides, 
  getProfile, 
  updateProfile, 
  updateRideStatus,
  deleteRide,
  getDashboardStats,
  getUserRidesNew,
  getBookedRides,
  // Profile completion
  getProfileCompletion,
  // Vehicle management
  getVehicles,
  addVehicle,
  updateVehicle,
  deleteVehicle,
  // Emergency contacts
  getEmergencyContacts,
  addEmergencyContact,
  updateEmergencyContact,
  deleteEmergencyContact,
  // Settings
  updateNotificationSettings,
  updatePrivacySettings,
  changePassword,
  // Account verification
  verifyAccount,
  // Enhanced profile update
  updateProfileComplete
} = require("../controllers/userController");

const router = express.Router();

// ✅ FIXED: Put specific routes BEFORE parameterized routes
// These routes must come BEFORE any routes with :rideId parameter

// User profile routes
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);

// Profile completion routes
router.get("/profile-completion", protect, getProfileCompletion);

// Vehicle management routes
router.get("/vehicles", protect, getVehicles);
router.post("/vehicles", protect, addVehicle);
router.put("/vehicles/:vehicleId", protect, updateVehicle);
router.delete("/vehicles/:vehicleId", protect, deleteVehicle);

// Emergency contacts routes
router.get("/emergency-contacts", protect, getEmergencyContacts);
router.post("/emergency-contacts", protect, addEmergencyContact);
router.put("/emergency-contacts/:contactId", protect, updateEmergencyContact);
router.delete("/emergency-contacts/:contactId", protect, deleteEmergencyContact);

// Settings routes
router.put("/notification-settings", protect, updateNotificationSettings);
router.put("/privacy-settings", protect, updatePrivacySettings);
router.put("/change-password", protect, changePassword);

// Account verification routes
router.post("/verify-account", protect, verifyAccount);

// Enhanced profile update
router.put("/profile-complete", protect, updateProfileComplete);

// ✅ NEW: Dashboard routes - Put these FIRST
router.get('/dashboard-stats', protect, getDashboardStats);
router.get('/user-rides', protect, getUserRidesNew);
router.get('/booked-rides', protect, getBookedRides);

// Existing ride management routes
router.get("/my-rides", protect, getMyRides); 

// ✅ IMPORTANT: Parameterized routes go LAST
// These routes have :rideId parameter, so they must be after specific routes
router.put("/rides/:rideId/status", protect, updateRideStatus);
router.delete("/rides/:rideId", protect, deleteRide);

module.exports = router;