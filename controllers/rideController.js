const { addRide, searchRides , editRide , getRideById , bookRideService , getUserBookedRidesService } = require("../service/rideService");
const Ride = require("../models/Ride");
const createRide = async (req, res) => {
  try {
    const result = await addRide(req.body , req.user);
    if (result.success) return res.status(201).json(result);
    return res.status(500).json(result);

  }
  catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }

};

const findRides = async (req, res) => {
  try {
    const result = await searchRides(req.query);
    if (result.success) return res.status(200).json(result);
    return res.status(500).json(result);
  }
  catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const editRideStats = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await editRide(id, req.user._id, req.body);
    
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

const rideUsingId = async (req, res) => {
  try {
    const { id } = req.params;
    const ride = await getRideById(id);
    if (ride) {
      return res.status(200).json({ success: true, ride });
    } else {
      return res.status(404).json({ success: false, message: "Ride not found" });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};


const bookRide = async (req, res) => {
  try {
    const { id: rideId } = req.params;
    const userId = req.user._id || req.user.id;
    const { seatsBooked = 1 } = req.body;

    console.log(`🚗 User ${userId} attempting to book ride ${rideId} with ${seatsBooked} seats`);

    const result = await bookRideService(rideId, userId, seatsBooked, req.user, req.app);

    if (result.success) {
      console.log(`✅ Ride booked successfully for user ${userId}`);
      return res.status(200).json(result);
    } else {
      console.log(`❌ Booking failed: ${result.message}`);
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in bookRide controller:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to book ride",
      error: error.message
    });
  }
};



const getUserBookedRides = async (req, res) => {
  try {
    const userId = req.user._id || req.user.id;
    const { status, page = 1, limit = 10, timeFilter } = req.query;

    console.log(`📋 Fetching booked rides for user ${userId}`);

    const result = await getUserBookedRidesService(userId, { status, page, limit, timeFilter });

    if (result.success) {
      console.log(`✅ Found ${result.rides.length} booked rides for user ${userId}`);
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    console.error('❌ Error in getUserBookedRides controller:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booked rides",
      error: error.message
    });
  }
};




const cancelBooking = async (req, res) => {
  try {
    const { id: rideId } = req.params;
    const userId = req.user._id || req.user.id;
    const { reason } = req.body;

    console.log(`❌ User ${userId} attempting to cancel booking for ride ${rideId}`);

    // You can implement this service function later
    // const result = await cancelBookingService(rideId, userId, reason, req.app);

    return res.status(200).json({
      success: true,
      message: "Booking cancelled successfully"
    });
  } catch (error) {
    console.error('❌ Error in cancelBooking controller:', error);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel booking",
      error: error.message
    });
  }
};

module.exports = { createRide, findRides , editRideStats , rideUsingId , bookRide , getUserBookedRides , cancelBooking };
