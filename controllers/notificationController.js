const NotificationService = require('../service/notificatoinService');
const Notification = require('../models/notifications');

class NotificationController {
  constructor(wsServer = null) {
    this.notificationService = new NotificationService(wsServer);
  }

  // Get user notifications
  async getLatestNotifications(req, res) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const userId = req.user.id;

      const result = await this.notificationService.getUserNotifications(
        userId, 
        parseInt(page), 
        parseInt(limit)
      );

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        error: error.message
      });
    }
  }

  // Get unread count
  async getUnreadCount(req, res) {
    try {
      const userId = req.user.id;
      const count = await Notification.countDocuments({
        userId,
        status: 'unread'
      });

      res.json({
        success: true,
        unreadCount: count
      });
    } catch (error) {
      console.error('Error fetching unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch unread count',
        error: error.message
      });
    }
  }

  // Mark notification as read
  async updateNotificationStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const userId = req.user.id;

      const notification = await this.notificationService.markAsRead(id, userId);

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        notification
      });
    } catch (error) {
      console.error('Error updating notification status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification',
        error: error.message
      });
    }
  }

  // Mark all as read
  async markAllAsRead(req, res) {
    try {
      const userId = req.user.id;
      const result = await this.notificationService.markAllAsRead(userId);

      res.json({
        success: true,
        message: 'All notifications marked as read',
        modifiedCount: result.modifiedCount
      });
    } catch (error) {
      console.error('Error marking all as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all as read',
        error: error.message
      });
    }
  }

  // Send test notification (for development)
  async sendTestNotification(req, res) {
    try {
      const userId = req.user.id;
      const { type = 'system', title, message } = req.body;

      const notification = await this.notificationService.createNotification({
        userId,
        type,
        title: title || '🔔 Test Notification',
        message: message || 'This is a test notification from the system!',
        priority: 'low'
      });

      res.json({
        success: true,
        notification
      });
    } catch (error) {
      console.error('Error sending test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
        error: error.message
      });
    }
  }

  // Get notification analytics (admin only)
  async getAnalytics(req, res) {
    try {
      // Check if user is admin
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      const stats = await Notification.aggregate([
        {
          $group: {
            _id: '$type',
            count: { $sum: 1 },
            unreadCount: {
              $sum: { $cond: [{ $eq: ['$status', 'unread'] }, 1, 0] }
            }
          }
        },
        { $sort: { count: -1 } }
      ]);

      const totalNotifications = await Notification.countDocuments();
      const totalUnread = await Notification.countDocuments({ status: 'unread' });

      res.json({
        success: true,
        analytics: {
          total: totalNotifications,
          totalUnread,
          byType: stats
        }
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch analytics',
        error: error.message
      });
    }
  }
}

module.exports = NotificationController;