const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
require("dotenv").config();
const connectDB = require("./config/db");

// Import WebSocket and Notification Services - FIXED FILENAMES
const NotificationWebSocketServer = require('./websocket/notificationwebsocket');
const NotificationService = require('./service/notificatoinService');
const createNotificationRoutes = require('./Routes/notificationRoutes');

// Import Routes
const rideRoutes = require("./Routes/Rideroutes");
const authRoutes = require("./Routes/Authroutes");
const otpRoutes = require("./Routes/otpRoutes");  
const userRoutes = require("./Routes/userRoutes");
const chatRoutes = require("./Routes/chatRoutes");
const Chat = require("./models/chat");
const paymentRoutes = require("./Routes/paymentRoutes");

const app = express();
const server = http.createServer(app);

// Fix MaxListeners warning
require('events').EventEmitter.defaultMaxListeners = 20;

// CORS Configuration
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', 
  'https://redigo-zeta.vercel.app',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['polling', 'websocket'], // ✅ FIXED: Try polling first
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6,
  path: '/socket.io/',  
  serveClient: false
  
});

 
connectDB();

 
const wsServer = new NotificationWebSocketServer(server);
console.log('🔗 WebSocket server initialized');

 
const notificationService = new NotificationService(wsServer);

 
app.set('notificationService', notificationService);
 
app.use("/api/rides", rideRoutes);
app.use("/auth", authRoutes);
app.use("/auth", otpRoutes);
app.use("/api/otp", otpRoutes);
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/payments", paymentRoutes);

 
const notificationRoutes = createNotificationRoutes(wsServer, notificationService);
app.use('/api/notifications', notificationRoutes);

 

 
app.get('/health', (req, res) => {
  try {
    let wsStats = {
      connected_users: 0,
      total_connections: 0,
      server_status: 'not_initialized'
    };

    // Only call getStats if wsServer exists and has the method
    if (wsServer && typeof wsServer.getStats === 'function') {
      wsStats = wsServer.getStats();
    }

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      server: {
        port: process.env.PORT || 5000,
        
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version
      },
      websocket: {
        connected_users: wsStats.connectedUsers || 0,
        total_connections: wsStats.totalConnections || 0,
        server_status: wsStats.serverStatus || 'unknown'
      },
      socketio: {
        connected_sockets: io.engine.clientsCount || 0
      },
      database: {
        status: 'connected' // You can add actual DB health check here
      }
    });
  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Health check failed',
      error: error.message
    });
  }
});

// ...rest of existing code...

// Test notification endpoint (for development)
app.post('/api/test-notification', async (req, res) => {
  try {
    const { userId, type = 'system', title, message } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const notification = await notificationService.createNotification({
      userId,
      type,
      title: title || '🔔 Test Notification',
      message: message || 'This is a test notification!',
      priority: 'low'
    });

    res.json({
      success: true,
      message: 'Test notification sent',
      notification,
      sent: wsServer.getUserConnectionCount(userId) > 0
    });
  } catch (error) {
    console.error('❌ Error sending test notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Socket.IO Logic
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('✅ Socket.IO User connected:', socket.id);

  socket.on('register-user', (userId) => {
    userSockets.set(userId, socket.id);
    socket.userId = userId;
    console.log(`👤 User ${userId} registered with socket ${socket.id}`);
  });

  socket.on('join-private-chat', (data) => {
    const { rideId, driverId, passengerId } = data;
  
    const roomId = `ride-${rideId}`;
    socket.join(roomId);
    
    console.log(`🔐 User ${socket.userId} joined 1-on-1 chat room: ${roomId}`);
    
    socket.currentRoomId = roomId;
    socket.rideId = rideId;
    socket.driverId = driverId;
    socket.passengerId = passengerId;
  });

  socket.on('send-private-message', async (data) => {
    console.log('💬 1-on-1 message received:', data);
    
    try {
      const participants = [];
      if (data.driverId) participants.push(data.driverId);
      if (data.passengerId) participants.push(data.passengerId);
      
      const newMessage = new Chat({
        rideId: data.rideId,
        userId: data.userId,
        userName: data.userName,
        message: data.message,
        chatParticipants: participants,
        timestamp: new Date(data.timestamp)
      });
      
      const savedMessage = await newMessage.save();
      console.log('💾 Message saved:', savedMessage._id);
      
      const messageToSend = {
        _id: savedMessage._id,
        rideId: data.rideId,
        userId: data.userId,
        userName: data.userName,
        message: data.message,
        timestamp: savedMessage.timestamp
      };
      
      const roomId = `ride-${data.rideId}`;
      console.log(`📤 Broadcasting to room: ${roomId}`);
      
      io.to(roomId).emit('receive-private-message', messageToSend);

      // Send real-time notification to other participant about new message
      try {
        const otherParticipantId = data.userId === data.driverId ? data.passengerId : data.driverId;
        if (otherParticipantId && notificationService) {
          await notificationService.createNotification({
            userId: otherParticipantId,
            type: 'new_message',
            title: 'New Message',
            message: `${data.userName}: ${data.message.substring(0, 50)}${data.message.length > 50 ? '...' : ''}`,
            metadata: {
              rideId: data.rideId,
              senderId: data.userId,
              senderName: data.userName,
              messageId: savedMessage._id
            },
            priority: 'medium'
          });
          console.log(`Notification sent to user ${otherParticipantId}`);
        }
      } catch (notifError) {
        console.error('Error sending message notification:', notifError);
      }
      
    } catch (error) {
      console.error('Error saving message:', error);
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });
  
  socket.on('typing-private', (data) => {
    const roomId = `ride-${data.rideId}`;
    console.log(`User ${data.userId} typing in room: ${roomId}`);
    socket.to(roomId).emit('user-typing-private', data);
  });

  socket.on('stop-typing-private', (data) => {
    const roomId = `ride-${data.rideId}`;
    console.log(`User ${data.userId} stopped typing in room: ${roomId}`);
    socket.to(roomId).emit('user-stop-typing-private', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.userId) {
      userSockets.delete(socket.userId);
      console.log(`Removed user ${socket.userId} from socket mapping`);
    }
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
 
  socket.on("driver-location-update", (data) => {
    const { driverId, rideId, latitude, longitude } = data;

    const roomId = `ride-${rideId}`;
    console.log(`📍 Driver ${driverId} updated location for ${roomId}:`, latitude, longitude);
    
    io.to(roomId).emit("receive-driver-location", {
      driverId,
      latitude,
      longitude,
      timestamp: new Date()
    });
  });
 
  socket.on('location-update', (data) => {
    console.log('📍 Location update with movement:', {
      userId: data.userId,
      rideId: data.rideId,
      userRole: data.userRole,
      speed: data.coords ? data.coords.speed : null,
      accuracy: data.coords ? data.coords.accuracy : null,
      lat: data.coords ? data.coords.lat : null,
      lng: data.coords ? data.coords.lng : null
    });
    
    socket.to(`ride-${data.rideId}`).emit('receive-location-update', {
      userId: data.userId,
      rideId: data.rideId,
      userRole: data.userRole,
      coords: data.coords,
      rotation: data.rotation,
      timestamp: data.timestamp
    });
  });

  socket.on('join-ride-tracking', (data) => {
    console.log('🚗 User joined ride tracking:', data.rideId, 'User:', data.userId, 'Role:', data.userRole);
    socket.join(`ride-${data.rideId}`);
    
    socket.to(`ride-${data.rideId}`).emit('user-started-tracking', {
      userId: data.userId,
      userRole: data.userRole,
      message: `${data.userRole} started location tracking`
    });
  });

  socket.on('leave-ride-tracking', (data) => {
    console.log('🚪 User left ride tracking:', data.rideId, 'User:', data.userId);
    socket.leave(`ride-${data.rideId}`);
  
    socket.to(`ride-${data.rideId}`).emit('user-stopped-tracking', {
      userId: data.userId,
      message: 'User stopped location tracking'
    });
  });
});

 
app.use((err, req, res, next) => {
  console.error('❌ Global Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

 
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /health',
      'GET /api/rides',
      'POST /auth/login',
      'POST /auth/register',
      'GET /api/user/profile',
      'GET /api/chat',
      'GET /api/payments',
      'GET /api/notifications/latest',
      'POST /api/test-notification'
    ]
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`1-on-1 Chat System Ready`);
  console.log(`WebSocket server ready at ws://localhost:${PORT}/ws/notifications`);
  console.log(`Real-time notifications active`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
   

});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('Unhandled Rejection:', error);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = { app, server, io, wsServer, notificationService };