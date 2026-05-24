const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const url = require('url');

class NotificationWebSocketServer {
  constructor(server) {
   this.wss = new WebSocket.Server({
  noServer: true
});

// so this basically upgradiing the request if new notification is coming
//  and mapping the users eg if one person has multiple tabs openened soo thats why  
server.on('upgrade', (req, socket, head) => {
  if (req.url.startsWith('/ws/notifications')) {
    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req);
    });
  }
});

    this.clients = new Map();
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      console.log('🔗 New WebSocket connection attempt');
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      console.error('❌ WebSocket Server Error:', error);
    });

    console.log('🔗 WebSocket server initialized on path: /ws/notifications');
  }

  async handleConnection(ws, req) {
    try {
      const parsedUrl = url.parse(req.url, true);
      const token = parsedUrl.query.token;

      if (!token) {
        console.log('❌ No token provided');
        ws.close(1008, 'No token provided');
        return;
      }

      let decoded;
      try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token verified for user:', decoded.id);
      } catch (jwtError) {
        console.error('❌ JWT verification failed:', jwtError.message);
        ws.close(1008, 'Invalid token');
        return;
      }

      const userId = decoded.id;

      if (!this.clients.has(userId)) {
        this.clients.set(userId, new Set());
      }
      this.clients.get(userId).add(ws);

      console.log(`🟢 User ${userId} connected to notifications WebSocket`);

      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to notification service',
        timestamp: new Date().toISOString(),
        userId: userId
      }));

      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'ping') {
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: new Date().toISOString()
            }));
          }
        } catch (error) {
          console.error('❌ Error parsing message:', error);
        }
      });

      ws.on('close', (code, reason) => {
        console.log(`🔴 User ${userId} disconnected:`, code);
        this.handleDisconnection(userId, ws);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket connection error:', error);
        this.handleDisconnection(userId, ws);
      });

      await this.sendPendingNotifications(userId, ws);

    } catch (error) {
      console.error('❌ Connection error:', error);
      ws.close(1008, 'Connection error');
    }
  }

  handleDisconnection(userId, ws) {
    const userConnections = this.clients.get(userId);
    if (userConnections) {
      userConnections.delete(ws);
      if (userConnections.size === 0) {
        this.clients.delete(userId);
      }
    }
    console.log(`🗑️ User ${userId} removed. Total users: ${this.clients.size}`);
  }

  async sendPendingNotifications(userId, ws) {
    try {
     
      let notifications = [];
      try {
        const Notification = require('../models/notifications');
        notifications = await Notification.find({
          userId,
          status: 'unread'
        })
        .sort({ createdAt: -1 })
        .limit(5);
      } catch (modelError) {
        console.log('⚠️ Notification model not found, skipping pending notifications');
        return;
      }

      if (notifications.length > 0) {
        console.log(`📋 Sending ${notifications.length} pending notifications to user ${userId}`);
        
        notifications.forEach(notification => {
          ws.send(JSON.stringify({
            id: notification._id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            timestamp: notification.createdAt,
            metadata: notification.metadata
          }));
        });
      }
    } catch (error) {
      console.error('❌ Error sending pending notifications:', error);
    }
  }

  sendToUser(userId, notification) {
    const userConnections = this.clients.get(userId.toString());
    if (userConnections && userConnections.size > 0) {
      const message = JSON.stringify(notification);
      console.log(`📤 Sending to user ${userId}:`, notification.title || notification.type);
      
      let sentCount = 0;
      userConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
          sentCount++;
        }
      });
      
      return sentCount > 0;
    }
    return false;
  }

  sendToUsers(userIds, notification) {
    let sentCount = 0;
    userIds.forEach(userId => {
      if (this.sendToUser(userId, notification)) {
        sentCount++;
      }
    });
    return sentCount;
  }

  broadcast(notification) {
    let sentCount = 0;
    this.clients.forEach((connections, userId) => {
      if (this.sendToUser(userId, notification)) {
        sentCount++;
      }
    });
    return sentCount;
  }

  getConnectedUsers() {
    return Array.from(this.clients.keys());
  }

  getUserConnectionCount(userId) {
    const connections = this.clients.get(userId.toString());
    return connections ? connections.size : 0;
  }

  
  getStats() {
    const totalConnections = Array.from(this.clients.values())
      .reduce((sum, connections) => sum + connections.size, 0);
    
    return {
      connectedUsers: this.clients.size,
      totalConnections,
      uptime: process.uptime(),
      serverStatus: 'running'
    };
  }

 
  isUserConnected(userId) {
    return this.clients.has(userId.toString()) && this.clients.get(userId.toString()).size > 0;
  }

  getServerInfo() {
    return {
      path: '/ws/notifications',
      port: this.wss.options.port || 'inherited from HTTP server',
      clientsCount: this.wss.clients.size,
      usersCount: this.clients.size
    };
  }
}

module.exports = NotificationWebSocketServer;