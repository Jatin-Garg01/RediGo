const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Ride = require('../models/Ride');
const Chat = require('../models/chat');
const Notification = require('../models/notifications');
const Transaction = require('../models/Transaction');

async function createIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('🔌 Connected to MongoDB');

    // User indexes
    await User.collection.createIndex({ email: 1 }, { unique: true });
    console.log('✅ Created User email index');

    // Ride indexes
    await Ride.collection.createIndex({ driver: 1 });
    await Ride.collection.createIndex({ passengers: 1 });
    await Ride.collection.createIndex({ from_location: '2dsphere' });
    await Ride.collection.createIndex({ to_location: '2dsphere' });
    await Ride.collection.createIndex({ departureTime: 1 });
    console.log('✅ Created Ride indexes');

    // Chat indexes
    await Chat.collection.createIndex({ rideId: 1 });
    await Chat.collection.createIndex({ createdAt: 1 });
    console.log('✅ Created Chat indexes');

    // Notification indexes
    await Notification.collection.createIndex({ userId: 1 });
    await Notification.collection.createIndex({ createdAt: -1 });
    console.log('✅ Created Notification indexes');

    // Transaction indexes
    await Transaction.collection.createIndex({ userId: 1 });
    await Transaction.collection.createIndex({ rideId: 1 });
    console.log('✅ Created Transaction indexes');

    console.log('✅ All indexes created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating indexes:', error.message);
    process.exit(1);
  }
}

createIndexes();
