const Notification = require('../models/notifications');
const User = require('../models/User');

class NotificationService {
  constructor(wsServer = null) {
    this.wsServer = wsServer;
  }

  // Create and send notification
  async createNotification({
    userId,
    type,
    title,
    message,
    priority = 'medium',
    metadata = {},
    actionUrl = null,
    expiresAt = null
  }) {
    try {
      // Create notification in database
      const notification = new Notification({
        userId,
        type,
        title,
        message,
        priority,
        metadata,
        actionUrl,
        expiresAt
      });

      await notification.save();

      // Send via WebSocket if available
      if (this.wsServer) {
        const wsPayload = {
          id: notification._id,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          timestamp: notification.createdAt,
          metadata: notification.metadata,
          actionUrl: notification.actionUrl
        };

        this.wsServer.sendToUser(userId, wsPayload);
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  // Send ride-related notifications
  async sendRideNotification(type, userId, rideData) {
    const notificationMap = {
      ride_match: {
        title: '🚗 New Ride Match!',
        message: `Perfect match found from ${rideData.from} to ${rideData.to} on ${rideData.date}`,
        metadata: { rideId: rideData.id, matchScore: rideData.matchScore }
      },
      ride_booked: {
        title: '✅ Ride Booked Successfully!',
        message: `Your ride with ${rideData.driverName} has been confirmed for ${rideData.date}`,
        metadata: { rideId: rideData.id, bookingId: rideData.bookingId }
      },
      ride_cancelled: {
        title: '❌ Ride Cancelled',
        message: `Unfortunately, your ride on ${rideData.date} has been cancelled. Full refund initiated.`,
        metadata: { rideId: rideData.id, refundAmount: rideData.refundAmount }
      },
      payment_received: {
        title: '💰 Payment Received',
        message: `You received ₹${rideData.amount} for your ride to ${rideData.destination}`,
        metadata: { amount: rideData.amount, paymentId: rideData.paymentId }
      },
      ride_reminder: {
        title: '⏰ Ride Reminder',
        message: `Your ride from ${rideData.from} to ${rideData.to} starts in 30 minutes`,
        metadata: { rideId: rideData.id, reminderType: '30min' }
      }
    };

    const config = notificationMap[type];
    if (!config) {
      throw new Error(`Unknown ride notification type: ${type}`);
    }

    return await this.createNotification({
      userId,
      type,
      title: config.title,
      message: config.message,
      metadata: config.metadata,
      priority: type === 'ride_cancelled' ? 'high' : 'medium'
    });
  }

  // Get notifications for user
  async getUserNotifications(userId, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    
    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Notification.countDocuments({ userId });
    const unreadCount = await Notification.countDocuments({ 
      userId, 
      status: 'unread' 
    });

    return {
      notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      unreadCount
    };
  }

  // Mark notification as read
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { status: 'read' },
      { new: true }
    );

    return notification;
  }

  // Mark all notifications as read
  async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { userId, status: 'unread' },
      { status: 'read' }
    );

    return result;
  }

  // Clean up old notifications
  async cleanupOldNotifications() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const result = await Notification.deleteMany({
      createdAt: { $lt: thirtyDaysAgo },
      status: 'read'
    });

    console.log(`🧹 Cleaned up ${result.deletedCount} old notifications`);
    return result;
  }
}

module.exports = NotificationService;