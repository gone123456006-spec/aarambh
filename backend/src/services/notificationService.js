const Notification = require('../models/InAppNotification');
const User = require('../models/User');
const Course = require('../models/Course');
const CourseProgress = require('../models/CourseProgress');
const connectionState = require('./connectionStateService');

const DAY_MS = 24 * 60 * 60 * 1000;
const FALLBACK_PLAN_PRICE = 249;

const POINT_MILESTONES = [50, 100, 250, 500, 1000, 2500, 5000, 10000];
const GAME_LEVEL_MILESTONES = [1, 3, 5, 10, 15, 20, 25];

const GAME_LABELS = {
  quiz: 'Quiz Challenge',
  scramble: 'Word Scramble',
  fill: 'Fill in the Blank',
  flash: 'Flash Cards',
};

const DAILY_REWARD_MESSAGES = [
  'Your daily word reward is waiting — claim +5 points today!',
  'Don’t break your streak! Open Rewards and claim today’s word.',
  'A new English word is ready. Claim your daily points now.',
  'Consistency wins. Grab today’s daily reward before midnight.',
];

const CHAT_TIP_MESSAGES = [
  'Practice makes perfect — try Chat in English with a real learner.',
  'New friends, new words. Start a Chat in English session today.',
  'Speak & type with learners worldwide. Open Chat in English!',
];

const CALL_TIP_MESSAGES = [
  'Ready to speak? Try Call in English with a random learner.',
  'Boost your confidence — start a Call in English practice session.',
  'Hearing real English helps a lot. Tap Call in English on Home.',
];

const LEADERBOARD_TIPS = [
  'Check the Leaderboard — climb higher with more game points!',
  'Your rank updates with every point you earn. See who’s on top!',
  'Compete with learners across India on the Leaderboard.',
];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

const REQUEST_NOTIFICATION_TYPES = new Set(['chat', 'call']);

/**
 * Create a notification. If `key` is set and already exists for this user, skip.
 * Incoming chat/call request notifications are not created while the user is busy
 * in an active chat, voice, or video session (`allowWhenBusy` opts out).
 */
async function createNotification(userId, title, message, type = 'system', options = {}) {
  try {
    const { key = null, data = null, allowWhenBusy = false } = options;

    const isRequest = REQUEST_NOTIFICATION_TYPES.has(type);
    if (isRequest && !allowWhenBusy && (await connectionState.isBusyAsync(userId))) {
      return null;
    }

    if (key) {
      const existing = await Notification.findOne({ user: userId, key }).select('_id').lean();
      if (existing) return null;
    }

    const notification = await Notification.create({
      user: userId,
      title,
      message,
      type,
      key: key || undefined,
      data,
      read: false,
    });

    return notification;
  } catch (error) {
    // Duplicate key (race) — ignore
    if (error?.code === 11000) return null;
    console.error('Failed to create notification:', error.message || error);
    return null;
  }
}

async function getNotifications(userId, { limit = 50, unreadOnly = false } = {}) {
  const filter = { user: userId };
  if (unreadOnly) filter.read = false;
  return Notification.find(filter).sort({ createdAt: -1 }).limit(Math.min(limit, 100)).lean();
}

async function getUnreadCount(userId) {
  return Notification.countDocuments({ user: userId, read: false });
}

async function markAsRead(notificationId, userId) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, user: userId },
    { $set: { read: true } },
    { new: true }
  );
}

async function markAllAsRead(userId) {
  return Notification.updateMany({ user: userId, read: false }, { $set: { read: true } });
}

async function deleteNotification(notificationId, userId) {
  return Notification.findOneAndDelete({ _id: notificationId, user: userId });
}

async function deleteAllNotifications(userId) {
  return Notification.deleteMany({ user: userId });
}

/** Welcome on first signup */
async function notifyWelcome(userId, { isNewUser, name } = {}) {
  const first = (name || 'Learner').toString().trim().split(/\s+/)[0] || 'Learner';
  if (isNewUser) {
    return createNotification(
      userId,
      `Welcome to Ohm's, ${first}! 🎉`,
      'Start with free Beginner courses, play games for points, and claim your daily word reward. We’re glad you’re here!',
      'welcome',
      { key: 'welcome-first', data: { route: '/(tabs)/' } }
    );
  }
  return createNotification(
    userId,
    `Welcome back, ${first}!`,
    'Keep learning today — your courses, games, and daily rewards are ready.',
    'welcome',
    { key: `welcome-back-${todayKey()}`, data: { route: '/(tabs)/' } }
  );
}

/** Daily reward reminder (once per day) */
async function notifyDailyRewardReminder(userId) {
  return createNotification(
    userId,
    'Daily reward waiting',
    pick(DAILY_REWARD_MESSAGES),
    'reward',
    { key: `daily-reward-nudge-${todayKey()}`, data: { route: '/(tabs)/rewards' } }
  );
}

/** After user claims daily word */
async function notifyDailyRewardClaimed(userId, { pointsAdded = 5, journeyBonusAdded = 0 } = {}) {
  const notes = [];
  if (pointsAdded > 0) {
    notes.push(
      createNotification(
        userId,
        'Daily reward claimed! ✨',
        `You earned +${pointsAdded} points from today’s word. Come back tomorrow for more!`,
        'reward',
        { key: `daily-reward-claimed-${todayKey()}`, data: { route: '/(tabs)/rewards' } }
      )
    );
  }
  if (journeyBonusAdded > 0) {
    notes.push(
      createNotification(
        userId,
        'Journey complete! 🏆',
        `Amazing! You finished the 100-day word journey and earned a bonus of +${journeyBonusAdded} points.`,
        'achievement',
        { key: 'daily-journey-bonus', data: { route: '/(tabs)/rewards' } }
      )
    );
  }
  await Promise.all(notes);
}

/** Lesson / course completion */
async function notifyLessonCompleted(userId, lessonId) {
  const progress = await CourseProgress.findOne({ user: userId }).lean();
  const completed = progress?.completedLessons || [];

  await createNotification(
    userId,
    'Lesson completed! 📚',
    `Great job finishing a lesson. Keep going — consistency builds fluent English.`,
    'course',
    {
      key: `lesson-done-${lessonId}`,
      data: { route: '/(tabs)/my-courses', lessonId },
    }
  );

  // Check if an entire category is now complete
  const courses = await Course.find({}).select('level title lessons').lean();
  for (const course of courses) {
    const keys = (course.lessons || [])
      .map((l) => l.lessonKey || (l._id && String(l._id)))
      .filter(Boolean);
    if (keys.length === 0) continue;
    const allDone = keys.every((k) => completed.includes(k));
    if (!allDone) continue;

    await createNotification(
      userId,
      `${course.title} completed! 🎓`,
      `You’ve finished every lesson in ${course.title}. Proud of your progress!`,
      'course',
      {
        key: `course-done-${course.level}`,
        data: { route: '/(tabs)/my-courses', level: course.level },
      }
    );
  }
}

/** Game level / completion */
async function notifyGameProgress(userId, { gameId, level, score, completed, prevLevel = 0 }) {
  const label = GAME_LABELS[gameId] || 'Game';

  if (typeof level === 'number' && level > prevLevel && GAME_LEVEL_MILESTONES.includes(level)) {
    await createNotification(
      userId,
      `${label} — Level ${level}! 🎮`,
      `You reached level ${level}${typeof score === 'number' ? ` with ${score} points` : ''}. Keep climbing!`,
      'game',
      {
        key: `game-level-${gameId}-${level}`,
        data: { route: '/(tabs)/ved', gameId, level },
      }
    );
  } else if (typeof level === 'number' && level > prevLevel && level > 0) {
    await createNotification(
      userId,
      `${label} level up!`,
      `Level ${level} unlocked. Practice a little more to earn points and climb the leaderboard.`,
      'game',
      {
        key: `game-level-${gameId}-${level}`,
        data: { route: '/(tabs)/ved', gameId },
      }
    );
  }

  if (completed) {
    await createNotification(
      userId,
      `${label} cleared! 🏅`,
      `You completed every available ${label} level. New levels will unlock in a future update.`,
      'achievement',
      {
        key: `game-completed-${gameId}`,
        data: { route: '/leaderboard', gameId },
      }
    );
  }
}

/** Points milestones + leaderboard nudge */
async function notifyPointsMilestones(userId, prevPoints, nextPoints) {
  if (nextPoints <= prevPoints) return;

  for (const milestone of POINT_MILESTONES) {
    if (prevPoints < milestone && nextPoints >= milestone) {
      await createNotification(
        userId,
        `${milestone.toLocaleString('en-IN')} points! ⭐`,
        `You’ve reached ${milestone.toLocaleString('en-IN')} total points. Check the Leaderboard to see your new rank!`,
        'points',
        {
          key: `points-milestone-${milestone}`,
          data: { route: '/leaderboard', points: nextPoints },
        }
      );
    }
  }

  // Soft leaderboard tip occasionally when points increase a lot
  if (nextPoints - prevPoints >= 20) {
    await createNotification(
      userId,
      'Leaderboard update',
      pick(LEADERBOARD_TIPS),
      'leaderboard',
      {
        key: `leaderboard-tip-${todayKey()}`,
        data: { route: '/leaderboard' },
      }
    );
  }
}

async function notifySubscriptionActivated(userId, { expiryDate, planName, category } = {}) {
  const expiry =
    expiryDate instanceof Date
      ? expiryDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '30 days';
  const title = planName ? `${planName} is active 👑` : 'Subscription active! 👑';
  const body = category
    ? `${planName || 'Your plan'} is unlocked until ${expiry}. Enjoy learning!`
    : `Your courses are unlocked until ${expiry}. Enjoy learning!`;

  return createNotification(userId, title, body, 'subscription', {
    key: `sub-active-${Date.now()}`,
    data: { route: '/profile' },
  });
}

async function notifySubscriptionStatus(userId) {
  // Lazy require avoids circular dependency with subscriptionService
  const { getLatestSubscription, PLAN_PRICE } = require('./subscriptionService');
  const planPrice = PLAN_PRICE || FALLBACK_PLAN_PRICE;

  const latest = await getLatestSubscription(userId);
  if (!latest) {
    return createNotification(
      userId,
      'Unlock Pro courses',
      `Go Pro for ₹${planPrice}/month to unlock Intermediate and Advanced lessons.`,
      'subscription',
      {
        key: `sub-upsell-${todayKey().slice(0, 7)}`, // once per month
        data: { route: '/profile' },
      }
    );
  }

  if (latest.status === 'expired' || (latest.expiryDate && latest.expiryDate.getTime() <= Date.now())) {
    return createNotification(
      userId,
      'Pro subscription expired',
      'Your Pro access has ended. Renew to unlock Intermediate and Advanced courses again — your progress is saved.',
      'subscription',
      {
        key: `sub-expired-${todayKey()}`,
        data: { route: '/profile' },
      }
    );
  }

  if (latest.isCurrentlyActive() && latest.expiryDate) {
    const daysLeft = Math.ceil((latest.expiryDate.getTime() - Date.now()) / DAY_MS);
    if (daysLeft > 0 && daysLeft <= 3) {
      return createNotification(
        userId,
        'Pro expiring soon',
        `Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left on your Pro plan. Renew anytime from Profile.`,
        'subscription',
        {
          key: `sub-expiring-${todayKey()}`,
          data: { route: '/profile' },
        }
      );
    }
  }

  return null;
}

async function notifyChatMatched(userId, peerName) {
  const name = peerName || 'a learner';
  return createNotification(
    userId,
    'Chat partner found! 💬',
    `You’re connected with ${name}. Practice English together — be kind and keep chatting!`,
    'chat',
    {
      key: `chat-match-${Date.now()}`,
      data: { route: '/random-chat' },
    }
  );
}

async function notifyMissedCall(userId, peerName) {
  const name = peerName || 'a learner';
  return createNotification(
    userId,
    'Missed Call in English',
    `You missed a call from ${name}. Try Call in English again when you’re free.`,
    'call',
    {
      key: `missed-call-${Date.now()}`,
      data: { route: '/random-chat?intent=call' },
    }
  );
}

async function notifyCallTip(userId) {
  return createNotification(
    userId,
    'Call in English',
    pick(CALL_TIP_MESSAGES),
    'call',
    {
      key: `call-tip-${todayKey()}`,
      data: { route: '/random-chat?intent=call' },
    }
  );
}

async function notifyChatTip(userId) {
  return createNotification(
    userId,
    'Chat in English',
    pick(CHAT_TIP_MESSAGES),
    'chat',
    {
      key: `chat-tip-${todayKey()}`,
      data: { route: '/random-chat' },
    }
  );
}

/**
 * Run on app open / login — auto-sends welcome, daily reward, subscription,
 * and rotating practice tips (all deduped by key).
 */
async function bootstrapUserNotifications(userId, { isLogin = false } = {}) {
  const user = await User.findById(userId).select('name totalPoints createdAt').lean();
  if (!user) return { created: 0 };

  const created = [];

  if (isLogin) {
    created.push(await notifyWelcome(userId, { isNewUser: false, name: user.name }));
  } else {
    // Soft welcome-back once per day when opening the app
    created.push(await notifyWelcome(userId, { isNewUser: false, name: user.name }));
  }

  created.push(await notifyDailyRewardReminder(userId));
  created.push(await notifySubscriptionStatus(userId));

  // Rotate tips: even days = chat, odd = call (plus always try both — keys dedupe)
  const dayNum = Math.floor(Date.now() / DAY_MS);
  if (dayNum % 2 === 0) {
    created.push(await notifyChatTip(userId));
  } else {
    created.push(await notifyCallTip(userId));
  }

  // Leaderboard tip once every few days based on points
  if ((user.totalPoints || 0) > 0) {
    created.push(
      await createNotification(
        userId,
        'Your performance',
        `You have ${(user.totalPoints || 0).toLocaleString('en-IN')} points. Open Performance or Leaderboard to track your growth.`,
        'leaderboard',
        {
          key: `perf-tip-${todayKey().slice(0, 7)}-${Math.floor(Number(todayKey().slice(8, 10)) / 3)}`,
          data: { route: '/performance' },
        }
      )
    );
  }

  return {
    created: created.filter(Boolean).length,
  };
}

module.exports = {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  deleteAllNotifications,
  notifyWelcome,
  notifyDailyRewardReminder,
  notifyDailyRewardClaimed,
  notifyLessonCompleted,
  notifyGameProgress,
  notifyPointsMilestones,
  notifySubscriptionActivated,
  notifySubscriptionStatus,
  notifyChatMatched,
  notifyMissedCall,
  notifyCallTip,
  notifyChatTip,
  bootstrapUserNotifications,
  // backward compat alias
  getUnreadNotifications: (userId) => getNotifications(userId, { unreadOnly: true }),
};
