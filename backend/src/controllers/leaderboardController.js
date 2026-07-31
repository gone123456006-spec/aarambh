const User = require('../models/User');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Format a User document into a leaderboard entry.
 */
function formatEntry(user, rank) {
  return {
    id: String(user._id),
    name: user.name?.trim() || 'Learner',
    location: user.region?.trim() || '',
    avatar: user.avatar?.trim() || '',
    points: user.totalPoints || 0,
    rank,
  };
}

/**
 * GET /api/leaderboard
 *
 * Logic:
 *  1. Fetch ALL non-admin users, sorted by:
 *       totalPoints DESC  →  _id ASC  (userId is an ObjectId; earlier account = smaller id = wins tie)
 *     Limit 100 to cap memory (covers ranks 1-100 comfortably; expand if needed).
 *  2. Assign rank = array index + 1 (pure position, no gaps).
 *  3. Compute the logged-in user's exact global rank with a countDocuments that
 *     mirrors the same two-level tie-breaker — no random drift on equal points.
 *  4. Always return `me` with accurate rank + points so the "My Rank" card
 *     works even when the user is outside the top 100.
 *
 * Tie-breaker rule (deterministic, never random):
 *   points DESC  →  _id ASC   (userId string ordering; lower ObjectId = created earlier = ranks higher)
 *
 * Compound index (add once to DB for fast queries):
 *   db.users.createIndex({ totalPoints: -1, _id: 1 })
 */
const getLeaderboard = asyncHandler(async (req, res) => {
  /* ── 1. Ranked list ────────────────────────────────────────────────── */
  const topUsers = await User.find({ role: { $ne: 'admin' } })
    .select('name region avatar totalPoints')
    .sort({ totalPoints: -1, _id: 1 })   // points ↓  →  userId ↑
    .limit(100)
    .lean();

  const rankings = topUsers.map((user, index) => formatEntry(user, index + 1));

  /* ── 2. Logged-in user's exact global rank ──────────────────────────
   *
   * Count how many non-admin users rank strictly above the current user
   * using the same tie-breaker:
   *
   *   • MORE points than me              → ranks above me
   *   • SAME points but smaller _id      → ranks above me (joined earlier)
   *
   * myRank = higherRankedCount + 1
   */
  const myPoints = req.user.totalPoints || 0;
  const myId = req.user._id;

  const [higherRankedCount, totalUsers] = await Promise.all([
    User.countDocuments({
      role: { $ne: 'admin' },
      $or: [
        // Case A – strictly more points
        { totalPoints: { $gt: myPoints } },
        // Case B – same points, smaller ObjectId (wins tie)
        { totalPoints: myPoints, _id: { $lt: myId } },
      ],
    }),
    User.countDocuments({ role: { $ne: 'admin' } }),
  ]);

  const myRank = higherRankedCount + 1;
  const myIdStr = String(myId);

  /* ── 3. Build `me` entry ────────────────────────────────────────────
   *
   * Prefer the entry from the ranked list (already formatted correctly);
   * fall back to building one from req.user if they are outside top 100.
   * Always stamp the computed rank so the footer is always accurate.
   */
  let me = rankings.find((e) => e.id === myIdStr);
  me = me ? { ...me, rank: myRank } : formatEntry(req.user, myRank);

  res.status(200).json(
    new ApiResponse(
      200,
      { rankings, totalUsers, me },
      'Leaderboard fetched successfully'
    )
  );
});

module.exports = { getLeaderboard };
