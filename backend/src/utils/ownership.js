/**
 * Ownership helpers — every private record must be scoped to the authenticated user.
 * Shared catalogs (courses) and public rankings (leaderboard) are intentional exceptions.
 */

function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/** Build a Mongo filter that always includes the owner field. */
function ownedBy(userId, extra = {}) {
  return { user: userId, ...extra };
}

/** True when userId is in a participants array. */
function isParticipant(participants, userId) {
  if (!Array.isArray(participants) || userId == null) return false;
  return participants.some((p) => sameId(p?._id ?? p, userId));
}

module.exports = {
  sameId,
  ownedBy,
  isParticipant,
};
