const firebaseService = require('./firebaseService');

/**
 * Send a notification when a new course is added.
 * @param {Object} course - The newly created course
 */
async function notifyNewCourse(course) {
  if (!firebaseService.isFirebaseEnabled()) {
    return;
  }

  try {
    const title = 'New Course Available!';
    const body = `Start learning with our new ${course.level || ''} course: ${course.title}`;
    
    await firebaseService.createAndSendNotification({
      title,
      body,
      data: {
        type: 'course',
        courseId: course._id.toString(),
        level: course.level,
      },
      targetType: 'all',
    });
    
    console.log(`✅ Sent notification for new course: ${course.title}`);
  } catch (error) {
    console.error('Failed to send new course notification:', error);
  }
}

/**
 * Send a notification when a course is updated with new lessons.
 * @param {Object} course - The updated course
 * @param {number} newLessonsCount - Number of new lessons added
 */
async function notifyCourseLessonsAdded(course, newLessonsCount) {
  if (!firebaseService.isFirebaseEnabled() || !newLessonsCount) {
    return;
  }

  try {
    const title = 'Course Updated!';
    const body = `${newLessonsCount} new lesson${newLessonsCount > 1 ? 's' : ''} added to ${course.title}`;
    
    await firebaseService.createAndSendNotification({
      title,
      body,
      data: {
        type: 'course_update',
        courseId: course._id.toString(),
        level: course.level,
      },
      targetType: 'all',
    });
    
    console.log(`✅ Sent notification for course update: ${course.title}`);
  } catch (error) {
    console.error('Failed to send course update notification:', error);
  }
}

/**
 * Send a welcome notification to a new user.
 * @param {Object} user - The newly registered user
 */
async function notifyWelcome(user) {
  if (!firebaseService.isFirebaseEnabled()) {
    return;
  }

  try {
    // Wait a bit for the user to register their device token
    setTimeout(async () => {
      const title = 'Welcome to Ohm\'s English!';
      const body = 'Start your English learning journey today. Explore courses, practice with others, and track your progress.';
      
      await firebaseService.sendToUsers([user._id], { title, body }, {
        type: 'welcome',
      });
      
      console.log(`✅ Sent welcome notification to user: ${user.name || user.email}`);
    }, 5000); // 5 second delay
  } catch (error) {
    console.error('Failed to send welcome notification:', error);
  }
}

/**
 * Send a notification about a subscription event.
 * @param {string} userId - The user ID
 * @param {string} eventType - 'activated' | 'expiring_soon' | 'expired'
 * @param {Object} subscription - The subscription object
 */
async function notifySubscriptionEvent(userId, eventType, subscription) {
  if (!firebaseService.isFirebaseEnabled()) {
    return;
  }

  try {
    let title, body;
    
    switch (eventType) {
      case 'activated':
        title = 'Subscription Activated!';
        body = `Your ${subscription.plan?.toUpperCase()} subscription is now active. Enjoy unlimited access!`;
        break;
      case 'expiring_soon':
        title = 'Subscription Expiring Soon';
        body = `Your subscription expires in 3 days. Renew now to keep learning!`;
        break;
      case 'expired':
        title = 'Subscription Expired';
        body = 'Your subscription has expired. Renew to continue accessing premium courses.';
        break;
      default:
        return;
    }
    
    await firebaseService.sendToUsers([userId], { title, body }, {
      type: 'subscription',
      event: eventType,
      subscriptionId: subscription._id?.toString(),
    });
    
    console.log(`✅ Sent ${eventType} notification to user: ${userId}`);
  } catch (error) {
    console.error('Failed to send subscription notification:', error);
  }
}

/**
 * Send a general announcement to all users.
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} data - Custom data
 */
async function notifyAnnouncement(title, body, data = {}) {
  if (!firebaseService.isFirebaseEnabled()) {
    return;
  }

  try {
    await firebaseService.createAndSendNotification({
      title,
      body,
      data: {
        type: 'announcement',
        ...data,
      },
      targetType: 'all',
    });
    
    console.log(`✅ Sent announcement: ${title}`);
  } catch (error) {
    console.error('Failed to send announcement:', error);
  }
}

module.exports = {
  notifyNewCourse,
  notifyCourseLessonsAdded,
  notifyWelcome,
  notifySubscriptionEvent,
  notifyAnnouncement,
};
