const express = require("express");
const { createRide, findRides, editRideStats, rideUsingId, bookRide, getUserBookedRides, cancelBooking } = require("../controllers/rideController");
const { protect } = require("../middlewares/protect");
const Ride = require("../models/Ride"); // Add this import - this was missing!

const router = express.Router();

router.post("/addRide", protect, createRide);
router.get("/search", findRides);
router.put("/:id", protect, editRideStats);
router.get("/:id", rideUsingId);

router.post("/:id/book", protect, bookRide);
router.delete("/:id/cancel", protect, cancelBooking);

// Get user's booked rides (both as driver and passenger)
// In your Rideroutes.js - update the user/booked route
router.get('/user/booked', protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    console.log('🔍 Fetching booked rides for user:', userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User ID not found in token'
      });
    }

    // Find rides where user is either driver or passenger
    const rides = await Ride.find({
      $or: [
        { 'driver.userId': userId },
        { 'passengers.userId': userId }
      ]
    })
    .populate('driver.userId', 'name phone email profilePicture rating')
    .populate('passengers.userId', 'name phone email profilePicture')
    .sort({ date: -1 });

    console.log('✅ Found rides:', rides.length);

    // Add userRole and auto-update status based on date
    const ridesWithRole = rides.map(ride => {
      const rideObj = ride.toObject();
      
      // Determine user's role
      const isDriver = ride.driver.userId._id.toString() === userId.toString();
      rideObj.userRole = isDriver ? 'driver' : 'passenger';
      
      // AUTO-UPDATE STATUS BASED ON DATE
      const rideDate = new Date(ride.date);
      const currentDate = new Date();
      
      // Set time to compare only dates (not time)
      rideDate.setHours(0, 0, 0, 0);
      currentDate.setHours(0, 0, 0, 0);
      
      if (rideDate < currentDate && ride.status === 'active') {
        // If ride date has passed and it's still active, mark as completed
        rideObj.status = 'completed';
        // Update in database too
        Ride.findByIdAndUpdate(ride._id, { status: 'completed' }).exec();
      } else if (rideDate >= currentDate && ride.status !== 'cancelled') {
        // If ride date is today or future, mark as active (upcoming)
        rideObj.status = 'active';
      }
      
      // If user is passenger, find their booking details
      if (!isDriver) {
        const passengerBooking = ride.passengers.find(p => 
          p.userId._id.toString() === userId.toString()
        );
        if (passengerBooking) {
          rideObj.bookingDate = passengerBooking.bookingDate;
          rideObj.seatsBooked = passengerBooking.seatsBooked;
          rideObj.paymentStatus = passengerBooking.paymentStatus;
        }
      }
      
      return rideObj;
    });

    res.json({
      success: true,
      rides: ridesWithRole,
      count: ridesWithRole.length
    });

  } catch (error) {
    console.error('❌ Error fetching user booked rides:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booked rides',
      error: error.message
    });
  }
});
router.get("/user/booked/:status", protect, (req, res) => {
  req.query.status = req.params.status;
  getUserBookedRides(req, res);
});

// Get ride statistics for a user
router.get("/user/stats", protect, async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    
    // Get summary statistics
    const asDriver = await Ride.countDocuments({ 'driver.userId': userId });
    const asPassenger = await Ride.countDocuments({ 'passengers.userId': userId });
    const upcomingRides = await Ride.countDocuments({
      $or: [
        { 'driver.userId': userId },
        { 'passengers.userId': userId }
      ],
      date: { $gte: new Date() }
    });

    res.json({
      success: true,
      stats: {
        totalRidesAsDriver: asDriver,
        totalRidesAsPassenger: asPassenger,
        totalRides: asDriver + asPassenger,
        upcomingRides: upcomingRides
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user stats',
      error: error.message
    });
  }
});

module.exports = router;