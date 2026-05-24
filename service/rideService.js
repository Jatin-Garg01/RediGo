const Ride = require("../models/Ride");
const User = require("../models/User");

/**
 * Add a new ride
 */
const addRide = async (rideData, user) => {
  try {
    // Ensure availableSeats is set correctly
    const availableSeats = rideData.availableSeats || rideData.seats;
    
    const rideWithUser = {
      ...rideData,
      availableSeats: availableSeats,
      driver: {
        userId: user._id,  
        name: user.name,
        phone: user.phone || rideData.driver?.phone || "",
        email: user.email || rideData.driver?.email || "",
        rating: user.rating || 5,
        licenseNumber: rideData.driver?.licenseNumber || null,
        vehicleDetails: rideData.driver?.vehicleDetails || {}
      },
      passengers: [], // Initialize empty passengers array
      status: 'active'
    };

    const newRide = new Ride(rideWithUser);
    await newRide.save();

    // Update user's rides array
    await User.findByIdAndUpdate(
      user._id,
      { $push: { rides: newRide._id } },
      { new: true }
    );

    console.log(`✅ New ride created: ${newRide._id} by ${user.name}`);

    return {
      success: true,
      message: "Ride added successfully",
      ride: newRide,
    };
  } catch (err) {
    console.error('❌ Error in addRide:', err);
    return {
      success: false,
      message: err.message,
    };
  }
};

/**
 * Search for available rides
 */
const searchRides = async (queryParams) => {
  try {
    const { from, to, date, passengers } = queryParams;
    const query = {};

    // Location filters
    if (from) query.from = { $regex: from, $options: "i" };
    if (to) query.to = { $regex: to, $options: "i" };

    // Date filter
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }

    // Passengers filter
    if (passengers) {
      query.availableSeats = { $gte: Number(passengers) };
    }

    // Only show active rides
    query.status = "active";

    // Only show future rides
    query.date = { ...query.date, $gte: new Date() };

    const rides = await Ride.find(query)
      .populate('driver.userId', 'name email phone profilePicture rating')
      .populate('passengers.userId', 'name profilePicture')
      .sort({ date: 1, price: 1 }); // Sort by date first, then price

    console.log(`🔍 Found ${rides.length} rides for search query`);
    
    return { 
      success: true, 
      rides,
      count: rides.length 
    };
  } catch (err) {
    console.error('❌ Error in searchRides:', err);
    return { 
      success: false, 
      message: err.message 
    };
  }
};

/**
 * Get ride by ID
 */
const getRideById = async (rideId) => {
  try {
    const ride = await Ride.findById(rideId)
      .populate('driver.userId', 'name email phone profilePicture rating')
      .populate('passengers.userId', 'name email phone profilePicture');
    
    if (!ride) {
      return {
        success: false,
        message: "Ride not found"
      };
    }

    return {
      success: true,
      ride
    };
  } catch (err) {
    console.error('❌ Error in getRideById:', err);
    return {
      success: false,
      message: err.message
    };
  }
};

/**
 * Edit an existing ride
 */
const editRide = async (rideId, userId, updateData) => {
  try {
    // Find the existing ride
    const existingRide = await Ride.findOne({ 
      _id: rideId, 
      'driver.userId': userId 
    });

    if (!existingRide) {
      return {
        success: false,
        message: "Ride not found or you are not authorized to edit it"
      };
    }

    // Prepare safe update data
    const safeUpdateData = { ...updateData };
    
    // Preserve driver information if updating driver details
    if (updateData.driver) {
      safeUpdateData.driver = {
        ...existingRide.driver.toObject(),
        ...updateData.driver,              
        userId: existingRide.driver.userId // Always preserve userId
      };
    }

    // If seats are being updated, recalculate available seats
    if (updateData.seats) {
      const bookedSeats = existingRide.passengers.reduce((sum, p) => sum + p.seatsBooked, 0);
      safeUpdateData.availableSeats = updateData.seats - bookedSeats;
      
      // Validate that new seat count doesn't go below booked seats
      if (safeUpdateData.availableSeats < 0) {
        return {
          success: false,
          message: `Cannot reduce seats below ${bookedSeats} (already booked seats)`
        };
      }
    }

    // Update the ride
    const ride = await Ride.findOneAndUpdate(
      { 
        _id: rideId, 
        'driver.userId': userId   
      },
      { $set: safeUpdateData },
      { new: true, runValidators: true }
    ).populate('driver.userId passengers.userId');

    console.log(`✅ Ride updated successfully: ${ride._id}`);

    return {
      success: true,
      message: "Ride updated successfully",
      ride
    };
  } catch (err) {
    console.error("❌ Error in editRide:", err);
    return {
      success: false,
      message: err.message
    };
  }
};

/**
 * Book a ride service
 */
/**
 * Book a ride service - FIXED for your data structure
 */
const bookRideService = async (rideId, userId, seatsBooked, user, app) => {
  try {
    console.log(`🚗 Processing booking: User ${userId} booking ${seatsBooked} seats for ride ${rideId}`);

    // Find the ride WITHOUT population first to get the raw driver data
    const rideRaw = await Ride.findById(rideId);
    
    if (!rideRaw) {
      return {
        success: false,
        message: 'Ride not found'
      };
    }

    // Check for time conflicts with existing bookings
    const rideDate = new Date(rideRaw.date);
    const rideTime = rideDate.getTime();
    const timeBuffer = 2 * 60 * 60 * 1000; // 2 hours buffer

    console.log('⏰ Checking for time conflicts...');
    
    // Find all rides where user is already a passenger
    const conflictingRides = await Ride.find({
      'passengers.userId': userId,
      _id: { $ne: rideId }, // Exclude current ride
      status: { $in: ['active', 'scheduled'] }
    });

    // Check for time conflicts
    for (const existingRide of conflictingRides) {
      const existingRideTime = new Date(existingRide.date).getTime();
      const timeDiff = Math.abs(rideTime - existingRideTime);
      
      if (timeDiff < timeBuffer) {
        const conflictDate = new Date(existingRide.date).toLocaleString();
        return {
          success: false,
          message: `You already have a ride booked at ${conflictDate}. Cannot book overlapping rides within 2 hours of each other.`,
          conflictingRide: {
            id: existingRide._id,
            from: existingRide.from,
            to: existingRide.to,
            date: conflictDate
          }
        };
      }
    }

    console.log('✅ No time conflicts found');

    // Additional database-level check for existing booking
    const existingBooking = await Ride.findOne({
      _id: rideId,
      'passengers.userId': userId
    });

    if (existingBooking) {
      console.log('❌ User already has booking in this ride');
      return {
        success: false,
        message: 'You have already booked this ride'
      };
    }

    console.log('🔍 Raw ride driver structure:', JSON.stringify(rideRaw.driver, null, 2));

    // Extract driver ID from the raw data structure
    let driverId;
    
    if (rideRaw.driver) {
      // Check if userId exists in driver object
      if (rideRaw.driver.userId) {
        driverId = rideRaw.driver.userId.toString();
      } 
      // FALLBACK: If userId is missing, use the driver's _id as the userId
      else if (rideRaw.driver._id) {
        console.log('⚠️ Driver userId missing, using driver._id as fallback');
        driverId = rideRaw.driver._id.toString();
      }
      // FALLBACK: Check if the driver object itself is the userId
      else if (mongoose.Types.ObjectId.isValid(rideRaw.driver)) {
        console.log('⚠️ Driver is ObjectId, using as driverId');
        driverId = rideRaw.driver.toString();
      }
    }

    if (!driverId) {
      console.error('❌ Driver ID not found in ride structure:', rideRaw.driver);
      // Let's try to find the ride creator from the database
      const rideWithCreator = await Ride.findById(rideId).lean();
      
      // If we still can't find driver info, we need to fix this ride
      return {
        success: false,
        message: 'This ride has corrupted driver data. Please contact support to fix this ride.',
        debug: {
          driverStructure: rideRaw.driver,
          rideId: rideId
        }
      };
    }

    console.log('👨‍💼 Extracted Driver ID:', driverId, 'Booking User ID:', userId.toString());

    // Get the populated ride for other operations
    const ride = await Ride.findById(rideId)
      .populate('driver.userId', 'name email phone profilePicture rating')
      .populate('passengers.userId', 'name email phone profilePicture');

    // Validation checks using extracted driver ID
    const validationResult = validateBooking(ride, userId, seatsBooked, driverId);
    if (!validationResult.isValid) {
      console.log('❌ Validation failed:', validationResult.message);
      return {
        success: false,
        message: validationResult.message
      };
    }

    // Create new passenger entry
    const newPassenger = {
      userId: userId,
      seatsBooked: seatsBooked,
      bookingDate: new Date(),
      status: 'confirmed',
      paymentStatus: 'pending'
    };

    // Add passenger and update available seats
    ride.passengers.push(newPassenger);
    ride.availableSeats -= seatsBooked;
    
    // Save the updated ride
    const savedRide = await ride.save();

    // Re-populate the saved ride
    await savedRide.populate([
      { path: 'driver.userId', select: 'name email phone profilePicture rating' },
      { path: 'passengers.userId', select: 'name email phone profilePicture' }
    ]);

    console.log('✅ Ride saved successfully, sending notifications...');

    // Send notifications
    await sendBookingNotifications(savedRide, userId, seatsBooked, user, app, driverId);

    console.log(`✅ Ride booked successfully: ${seatsBooked} seats for user ${userId}`);

    return {
      success: true,
      message: 'Ride booked successfully!',
      data: {
        ride: savedRide,
        booking: newPassenger,
        totalAmount: ride.price * seatsBooked,
        remainingSeats: savedRide.availableSeats
      }
    };

  } catch (error) {
    console.error('❌ Error in bookRideService:', error);
    return {
      success: false,
      message: 'Failed to book ride',
      error: error.message
    };
  }
};
/**
 * Fixed validation function
 */
const validateBooking = (ride, userId, seatsBooked, driverId) => {
  console.log('🔍 Validating booking:', {
    rideId: ride._id,
    userId: userId.toString(),
    driverId: driverId,
    seatsBooked: seatsBooked,
    availableSeats: ride.availableSeats,
    rideStatus: ride.status
  });

  // Check available seats
  if (ride.availableSeats < seatsBooked) {
    return {
      isValid: false,
      message: `Only ${ride.availableSeats} seats available, but you requested ${seatsBooked} seats`
    };
  }

  // Check if user is not the driver
  if (driverId === userId.toString()) {
    return {
      isValid: false,
      message: 'You cannot book your own ride'
    };
  }

  // Check if user already booked this ride
  console.log('🔍 Checking existing passengers:', ride.passengers.map(p => ({
    userId: p.userId,
    userIdType: typeof p.userId,
    userIdString: p.userId?.toString ? p.userId.toString() : 'no toString method'
  })));
  
  console.log('🔍 Current user ID:', userId.toString());
  
  const alreadyBooked = ride.passengers.some(p => {
    let passengerUserId;
    
    // Handle populated user object
    if (typeof p.userId === 'object' && p.userId !== null) {
      if (p.userId._id) {
        passengerUserId = p.userId._id.toString();
      } else if (p.userId.toString) {
        passengerUserId = p.userId.toString();
      }
    } else {
      // Handle ObjectId string
      passengerUserId = p.userId.toString();
    }
    
    console.log('🔍 Comparing passenger:', passengerUserId, 'with user:', userId.toString());
    return passengerUserId === userId.toString();
  });

  console.log('🔍 Already booked result:', alreadyBooked);

  if (alreadyBooked) {
    return {
      isValid: false,
      message: 'You have already booked this ride'
    };
  }

  // Check if ride date is in the future (allow same day)
  const rideDate = new Date(ride.date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (rideDate < today) {
    return {
      isValid: false,
      message: 'Cannot book a ride that has already passed'
    };
  }

  // Check if ride is active
  if (!['active', 'started'].includes(ride.status)) {
    return {
      isValid: false,
      message: 'This ride is no longer available for booking'
    };
  }

  return { isValid: true };
};

/**
 * Fixed notification function
 */
const sendBookingNotifications = async (ride, userId, seatsBooked, user, app, driverId) => {
  const notificationService = app?.get('notificationService');

  if (!notificationService) {
    console.log('⚠️ Notification service not available, skipping notifications');
    return;
  }

  try {
    // Get driver info safely from ride structure
    let driverName = 'Driver';
    let driverPhone = '';
    
    if (ride.driver) {
      // Check if driver.userId is populated
      if (ride.driver.userId && typeof ride.driver.userId === 'object') {
        driverName = ride.driver.userId.name || ride.driver.name || 'Driver';
        driverPhone = ride.driver.userId.phone || ride.driver.phone || '';
      } else {
        // Use driver info directly from driver object
        driverName = ride.driver.name || 'Driver';
        driverPhone = ride.driver.phone || '';
      }
    }

    console.log('📧 Sending notification to passenger:', userId);
    // Send notification to passenger (booker)
    await notificationService.createNotification({
      userId: userId,
      type: 'ride_booked',
      title: '🎉 Ride Booked Successfully!',
      message: `Your ride from ${ride.from} to ${ride.to} on ${ride.formattedDate || new Date(ride.date).toLocaleDateString()} has been confirmed.`,
      metadata: {
        rideId: ride._id,
        from: ride.from,
        to: ride.to,
        date: ride.date,
        time: ride.time,
        price: ride.price,
        seatsBooked: seatsBooked,
        totalAmount: ride.price * seatsBooked,
        driverName: driverName,
        driverPhone: driverPhone,
        actionType: 'ride_booked'
      },
      actionUrl: `/ride/${ride._id}/track`,
      priority: 'high'
    });

    console.log('📧 Sending notification to driver:', driverId);
    // Send notification to driver
    await notificationService.createNotification({
      userId: driverId,
      type: 'new_booking',
      title: '🚗 New Booking Received!',
      message: `${user.name || 'A passenger'} has booked ${seatsBooked} seat(s) for your ride from ${ride.from} to ${ride.to}.`,
      metadata: {
        rideId: ride._id,
        passengerName: user.name || 'Passenger',
        passengerPhone: user.phone || '',
        passengerEmail: user.email || '',
        seatsBooked: seatsBooked,
        from: ride.from,
        to: ride.to,
        date: ride.date,
        time: ride.time,
        earnings: ride.price * seatsBooked,
        remainingSeats: ride.availableSeats,
        actionType: 'new_booking'
      },
      actionUrl: `/ride/${ride._id}/manage`,
      priority: 'high'
    });

    console.log('✅ Booking notifications sent successfully');
  } catch (notificationError) {
    console.error('❌ Error sending booking notifications:', notificationError);
    // Don't fail the booking if notifications fail
  }
};
/**
 * Get user's booked rides
 */
const getUserBookedRidesService = async (userId, options = {}) => {
  try {
    const { status, page = 1, limit = 10, timeFilter } = options;
    const skip = (page - 1) * limit;

    console.log(`📋 Fetching booked rides for user ${userId}`);

    // Build query for rides where user is either driver or passenger
    const query = {
      $or: [
        { 'driver.userId': userId },
        { 'passengers.userId': userId }
      ]
    };

    // Add status filter if provided
    if (status && status !== 'all') {
      if (status === 'confirmed') {
        query['passengers.status'] = 'confirmed';
      } else if (status === 'pending') {
        query['passengers.status'] = 'pending';
      } else if (status === 'cancelled') {
        query['passengers.status'] = 'cancelled';
      }
    }

    // Add time filter
    if (timeFilter) {
      const now = new Date();
      if (timeFilter === 'upcoming') {
        query.date = { $gte: now };
      } else if (timeFilter === 'completed') {
        query.date = { $lt: now };
      }
    }

    const rides = await Ride.find(query)
      .populate('driver.userId', 'name email phone profilePicture rating')
      .populate('passengers.userId', 'name email phone profilePicture')
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Transform rides to include user role and booking details
    const transformedRides = rides.map(ride => {
      const isDriver = ride.driver.userId._id.toString() === userId.toString();
      const passengers = ride.passengers || [];
      const passengerBooking = passengers.find(p => 
        p.userId._id.toString() === userId.toString()
      );

      return {
        ...ride,
        userRole: isDriver ? 'driver' : 'passenger',
        userBooking: passengerBooking || null,
        totalEarnings: isDriver ? passengers.reduce((sum, p) => 
          sum + (ride.price * p.seatsBooked), 0
        ) : null,
        totalPassengers: passengers.length,
        bookedSeats: passengers.reduce((sum, p) => sum + p.seatsBooked, 0),
        isUpcoming: new Date(ride.date) > new Date(),
        isCompleted: new Date(ride.date) < new Date()
      };
    });

    // Get total count for pagination
    const totalRides = await Ride.countDocuments(query);

    // Create summary statistics
    const asDriver = transformedRides.filter(ride => ride.userRole === 'driver');
    const asPassenger = transformedRides.filter(ride => ride.userRole === 'passenger');
    const upcomingRides = transformedRides.filter(ride => ride.isUpcoming);
    const completedRides = transformedRides.filter(ride => ride.isCompleted);

    console.log(`✅ Found ${transformedRides.length} rides for user ${userId}`);

    return {
      success: true,
      rides: transformedRides,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalRides,
        pages: Math.ceil(totalRides / limit)
      },
      summary: {
        total: transformedRides.length,
        asDriver: asDriver.length,
        asPassenger: asPassenger.length,
        upcomingRides: upcomingRides.length,
        completedRides: completedRides.length,
        totalEarnings: asDriver.reduce((sum, ride) => sum + (ride.totalEarnings || 0), 0),
        totalSpent: asPassenger.reduce((sum, ride) => {
          const booking = ride.userBooking;
          return sum + (booking ? ride.price * booking.seatsBooked : 0);
        }, 0)
      }
    };

  } catch (error) {
    console.error('❌ Error in getUserBookedRidesService:', error);
    return {
      success: false,
      message: 'Failed to fetch booked rides',
      error: error.message
    };
  }
};

/**
 * Get rides by status
 */
const getRidesByStatusService = async (userId, status) => {
  try {
    const query = {
      $or: [
        { 'driver.userId': userId },
        { 'passengers.userId': userId }
      ]
    };

    const now = new Date();
    if (status === 'upcoming') {
      query.date = { $gte: now };
    } else if (status === 'completed') {
      query.date = { $lt: now };
    } else if (status === 'active') {
      query.status = 'active';
      query.date = { $gte: now };
    }

    const rides = await Ride.find(query)
      .populate('driver.userId', 'name email phone profilePicture rating')
      .populate('passengers.userId', 'name email phone profilePicture')
      .sort({ date: status === 'upcoming' ? 1 : -1 });

    return {
      success: true,
      rides,
      count: rides.length
    };

  } catch (error) {
    console.error('❌ Error in getRidesByStatusService:', error);
    return {
      success: false,
      message: 'Failed to fetch rides by status',
      error: error.message
    };
  }
};

/**
 * Cancel a booking
 */
const cancelBookingService = async (rideId, userId, reason, app) => {
  try {
    const ride = await Ride.findById(rideId)
      .populate('driver.userId', 'name email phone')
      .populate('passengers.userId', 'name email phone');

    if (!ride) {
      return {
        success: false,
        message: 'Ride not found'
      };
    }

    // Find the passenger booking
    const passengerIndex = ride.passengers.findIndex(p => 
      p.userId._id.toString() === userId.toString()
    );

    if (passengerIndex === -1) {
      return {
        success: false,
        message: 'Booking not found'
      };
    }

    const passenger = ride.passengers[passengerIndex];
    const seatsToRefund = passenger.seatsBooked;

    // Remove passenger from ride
    ride.passengers.splice(passengerIndex, 1);
    
    // Restore available seats
    ride.availableSeats += seatsToRefund;
    
    await ride.save();

    // Send cancellation notifications
    const notificationService = app?.get('notificationService');
    if (notificationService) {
      try {
        // Notify the user who cancelled
        await notificationService.createNotification({
          userId: userId,
          type: 'booking_cancelled',
          title: '❌ Booking Cancelled',
          message: `Your booking for the ride from ${ride.from} to ${ride.to} has been cancelled.`,
          metadata: {
            rideId: ride._id,
            reason: reason,
            refundAmount: ride.price * seatsToRefund
          }
        });

        // Notify the driver
        await notificationService.createNotification({
          userId: ride.driver.userId._id,
          type: 'booking_cancelled',
          title: '📢 Booking Cancelled',
          message: `A passenger has cancelled their booking for your ride from ${ride.from} to ${ride.to}.`,
          metadata: {
            rideId: ride._id,
            seatsFreed: seatsToRefund,
            reason: reason
          }
        });
      } catch (notificationError) {
        console.error('❌ Error sending cancellation notifications:', notificationError);
      }
    }

    return {
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        refundedSeats: seatsToRefund,
        refundAmount: ride.price * seatsToRefund
      }
    };

  } catch (error) {
    console.error('❌ Error in cancelBookingService:', error);
    return {
      success: false,
      message: 'Failed to cancel booking',
      error: error.message
    };
  }
};

/**
 * Get user ride statistics
 */
const getUserRideStatsService = async (userId) => {
  try {
    const totalAsDriver = await Ride.countDocuments({ 'driver.userId': userId });
    const totalAsPassenger = await Ride.countDocuments({ 'passengers.userId': userId });
    
    const upcomingAsDriver = await Ride.countDocuments({
      'driver.userId': userId,
      date: { $gte: new Date() },
      status: 'active'
    });
    
    const upcomingAsPassenger = await Ride.countDocuments({
      'passengers.userId': userId,
      date: { $gte: new Date() },
      'passengers.status': 'confirmed'
    });

    // Calculate total earnings as driver
    const driverRides = await Ride.find({ 'driver.userId': userId }).lean();
    const totalEarnings = driverRides.reduce((sum, ride) => {
      return sum + ride.passengers.reduce((rideSum, passenger) => {
        return rideSum + (ride.price * passenger.seatsBooked);
      }, 0);
    }, 0);

    // Calculate total spent as passenger
    const passengerRides = await Ride.find({ 'passengers.userId': userId }).lean();
    const totalSpent = passengerRides.reduce((sum, ride) => {
      const userBooking = ride.passengers.find(p => p.userId.toString() === userId.toString());
      return sum + (userBooking ? ride.price * userBooking.seatsBooked : 0);
    }, 0);

    return {
      success: true,
      stats: {
        totalRidesAsDriver: totalAsDriver,
        totalRidesAsPassenger: totalAsPassenger,
        totalRides: totalAsDriver + totalAsPassenger,
        upcomingRidesAsDriver: upcomingAsDriver,
        upcomingRidesAsPassenger: upcomingAsPassenger,
        totalUpcomingRides: upcomingAsDriver + upcomingAsPassenger,
        totalEarnings: totalEarnings,
        totalSpent: totalSpent,
        netAmount: totalEarnings - totalSpent
      }
    };
  } catch (error) {
    console.error('❌ Error in getUserRideStatsService:', error);
    return {
      success: false,
      message: 'Failed to fetch user statistics',
      error: error.message
    };
  }
};

module.exports = { 
  addRide, 
  searchRides,
  getRideById,
  editRide,
  bookRideService,
  getUserBookedRidesService,
  getRidesByStatusService,
  cancelBookingService,
  getUserRideStatsService
};