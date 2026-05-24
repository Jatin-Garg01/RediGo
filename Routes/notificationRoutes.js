const express = require('express');
const { protect } = require('../middlewares/protect');
const Notification = require('../models/notifications');

const createNotificationRoutes = (wsServer, notificationService) => {
  const router = express.Router();

  // Get latest notifications for user
  router.get('/latest', protect, async (req, res) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const userId = req.user.id || req.user._id;

      console.log('📋 Fetching notifications for user:', userId);

      const skip = (page - 1) * limit;
      
      const notifications = await Notification.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await Notification.countDocuments({ userId });
      const unreadCount = await Notification.countDocuments({ 
        userId, 
        status: 'unread' 
      });

      console.log(`✅ Found ${notifications.length} notifications, ${unreadCount} unread`);

      res.json({
        success: true,
        notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        },
        unreadCount
      });
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch notifications',
        error: error.message
      });
    }
  });

  // Get unread count
  router.get('/unread-count', protect, async (req, res) => {
    try {
      const userId = req.user.id || req.user._id;
      const count = await Notification.countDocuments({
        userId,
        status: 'unread'
      });

      res.json({
        success: true,
        unreadCount: count
      });
    } catch (error) {
      console.error('❌ Error fetching unread count:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch unread count',
        error: error.message
      });
    }
  });

  // Mark notification as read
  router.patch('/:id/status', protect, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user._id;

      console.log(`📝 Marking notification ${id} as read for user ${userId}`);

      const notification = await Notification.findOneAndUpdate(
        { _id: id, userId },
        { status: 'read' },
        { new: true }
      );

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
      console.error('❌ Error updating notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification',
        error: error.message
      });
    }
  });

  // Mark all notifications as read
  router.patch('/mark-all-read', protect, async (req, res) => {
    try {
      const userId = req.user.id || req.user._id;
      
      console.log(`📝 Marking all notifications as read for user ${userId}`);

      const result = await Notification.updateMany(
        { userId, status: 'unread' },
        { status: 'read' }
      );

      res.json({
        success: true,
        message: 'All notifications marked as read',
        modifiedCount: result.modifiedCount
      });
    } catch (error) {
      console.error('❌ Error marking all as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark all as read',
        error: error.message
      });
    }
  });

  // Send test notification
  router.post('/test', protect, async (req, res) => {
    try {
      const userId = req.user.id || req.user._id;
      const { type = 'system', title, message } = req.body;

      console.log(`🧪 Creating test notification for user ${userId}`);

      if (!notificationService) {
        return res.status(500).json({
          success: false,
          message: 'Notification service not available'
        });
      }

      const notification = await notificationService.createNotification({
        userId,
        type,
        title: title || '🔔 Test Notification',
        message: message || 'This is a test notification from the system!',
        priority: 'low'
      });

      res.json({
        success: true,
        notification,
        sent: wsServer ? wsServer.getUserConnectionCount(userId) > 0 : false
      });
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send test notification',
        error: error.message
      });
    }
  });

  // Delete notification
  router.delete('/:id', protect, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.id || req.user._id;

      const notification = await Notification.findOneAndDelete({
        _id: id,
        userId
      });

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete notification',
        error: error.message
      });
    }
  });

  console.log('✅ Notification routes created successfully');
  return router;
};

// FIXED THE EXPORT - Changed from module.log to module.exports
module.exports = createNotificationRoutes;