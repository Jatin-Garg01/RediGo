// Add this to your backend - create a file utils/statusUpdater.js

const Ride = require('../models/Ride');

const updateRideStatuses = async () => {
  try {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    // Update rides that have passed their date
    const result = await Ride.updateMany(
      {
        date: { $lt: currentDate },
        status: 'active'
      },
      {
        $set: { status: 'completed' }
      }
    );
    
    console.log(`✅ Updated ${result.modifiedCount} rides to completed status`);
    return result;
  } catch (error) {
    console.error('❌ Error updating ride statuses:', error);
  }
};

// Run this every hour or when server starts
module.exports = { updateRideStatuses };