const express = require('express');
const { protect } = require('../middlewares/protect');
const Chat = require('../models/chat');

const router = express.Router();

 
router.get('/conversations/:userId', protect, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    
    console.log("Fetching conversations for user:", currentUserId);
    
    // ✅ Find all messages where user is involved
    const messages = await Chat.find({
      $or: [
        { userId: currentUserId },
        { chatParticipants: currentUserId }
      ]
    }).sort({ timestamp: -1 });
    
    console.log(`Found ${messages.length} messages`);
    
    if (messages.length === 0) {
      return res.json({
        success: true,
        conversations: []
      });
    }
    
    // ✅ Import User model to get actual user details
    const User = require('../models/User');
    
    // ✅ Group by rideId and create unique conversations
    const conversationMap = new Map();
    
    for (const msg of messages) {
      const rideId = msg.rideId;
      
      // ✅ Determine the other user
      let otherUserId;
      if (msg.userId.toString() !== currentUserId.toString()) {
        otherUserId = msg.userId.toString();
      } else if (msg.chatParticipants && msg.chatParticipants.length > 0) {
        otherUserId = msg.chatParticipants.find(p => 
          p.toString() !== currentUserId.toString()
        )?.toString();
      }
      
      if (!otherUserId) continue;
      
      const uniqueKey = `${rideId}-${otherUserId}`;
      
      if (!conversationMap.has(uniqueKey)) {
        conversationMap.set(uniqueKey, {
          uniqueKey,
          rideId,
          otherUserId,
          lastMessage: msg,
          messageCount: 1
        });
      } else {
        const existing = conversationMap.get(uniqueKey);
        existing.messageCount++;
        // Update last message if this one is newer
        if (new Date(msg.timestamp) > new Date(existing.lastMessage.timestamp)) {
          existing.lastMessage = msg;
        }
      }
    }
    
    // ✅ Fetch actual user details and ride details
    const conversations = [];
    
    for (const conv of conversationMap.values()) {
      try {
        // ✅ Get actual user details
        const otherUser = await User.findById(conv.otherUserId).select('name email phone');
        
        // ✅ Get ride details
        const Ride = require('../models/Ride');
        const ride = await Ride.findById(conv.rideId);
        
        conversations.push({
          uniqueKey: conv.uniqueKey,
          rideId: conv.rideId,
          lastMessage: {
            _id: conv.lastMessage._id,
            message: conv.lastMessage.message,
            userId: conv.lastMessage.userId,
            userName: conv.lastMessage.userName,
            timestamp: conv.lastMessage.timestamp
          },
          otherUser: {
            _id: conv.otherUserId,
            name: otherUser?.name || conv.lastMessage.userName || "User",
            email: otherUser?.email || "user@example.com",
            phone: otherUser?.phone || "N/A",
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(otherUser?.name || conv.lastMessage.userName || "User")}&background=059669&color=fff`
          },
          rideDetails: {
            from: ride?.from || "Unknown",
            to: ride?.to || "Unknown",
            date: ride?.date || new Date(),
            time: ride?.time || "N/A",
            price: ride?.price || 0
          },
          messageCount: conv.messageCount,
          unreadCount: 0
        });
      } catch (error) {
        console.error('Error fetching details for conversation:', error);
        // Add fallback conversation if user/ride fetch fails
        conversations.push({
          uniqueKey: conv.uniqueKey,
          rideId: conv.rideId,
          lastMessage: {
            _id: conv.lastMessage._id,
            message: conv.lastMessage.message,
            userId: conv.lastMessage.userId,
            userName: conv.lastMessage.userName,
            timestamp: conv.lastMessage.timestamp
          },
          otherUser: {
            _id: conv.otherUserId,
            name: conv.lastMessage.userName || "User",
            email: "user@example.com",
            phone: "N/A",
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.lastMessage.userName || "User")}&background=059669&color=fff`
          },
          rideDetails: {
            from: "Loading...",
            to: "Loading...",
            date: new Date(),
            time: "N/A",
            price: 0
          },
          messageCount: conv.messageCount,
          unreadCount: 0
        });
      }
    }
    
    // Sort by last message timestamp
    conversations.sort((a, b) => 
      new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp)
    );
    
    res.json({
      success: true,
      conversations
    });
    
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching conversations',
      error: error.message
    });
  }
});
// ✅ Get passenger info from chat history for driver
router.get('/passenger/:rideId', protect, async (req, res) => {
  try {
    const { rideId } = req.params;
    const currentUserId = req.user._id;
    
    console.log('Getting passenger for ride:', rideId, 'driver:', currentUserId);
    
    // Find any message in this ride where sender is not current user
    const message = await Chat.findOne({
      rideId: rideId,
      userId: { $ne: currentUserId }
    }).sort({ timestamp: -1 });
    
    if (!message) {
      return res.json({
        success: false,
        message: 'No passenger found in chat history'
      });
    }
    
    // Get full user details
    const User = require('../models/User');
    const passenger = await User.findById(message.userId).select('name email phone');
    
    if (!passenger) {
      return res.json({
        success: false,
        message: 'Passenger not found'
      });
    }
    
    res.json({
      success: true,
      passenger: {
        _id: passenger._id,
        name: passenger.name,
        email: passenger.email,
        phone: passenger.phone
      }
    });
    
  } catch (error) {
    console.error('Error getting passenger info:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting passenger info'
    });
  }
});

// ✅ Get 1-on-1 chat history (GENERIC ROUTE AFTER SPECIFIC ROUTES)
// ✅ FIXED: Get ALL messages between two users in a ride
// ✅ FIXED: Get complete chat history for current user in a ride
router.get('/:rideId/:userId', protect, async (req, res) => {
  try {
    const { rideId, userId } = req.params;
    const currentUserId = req.user._id;
    
    console.log('Fetching chat history for ride:', rideId, 'user:', currentUserId);
    
    // ✅ Find ALL messages for this specific ride
    const messages = await Chat.find({
      rideId: rideId
    })
    .sort({ timestamp: 1 })
    .limit(100);
    
    console.log(`Found ${messages.length} total messages for ride`);
    
    // ✅ Show ALL messages in the ride (complete conversation)
    // This ensures both driver and passenger see the full chat
    
    res.json({
      success: true,
      messages: messages
    });
    
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching chat history'
    });
  }
});

// ✅ Save new message
router.post('/', protect, async (req, res) => {
  try {
    const { rideId, message, otherUserId } = req.body;
    
    const newMessage = new Chat({
      rideId,
      userId: req.user._id,
      userName: req.user.name || req.user.email,
      message,
      chatParticipants: [req.user._id, otherUserId].filter(Boolean),
      timestamp: new Date()
    });
    
    await newMessage.save();
    
    res.json({
      success: true,
      message: newMessage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;