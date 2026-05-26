/**
 * Returns true when the user has finished the onboarding profile (name, phone, etc.).
 */
function isUserProfileComplete(user) {
  if (!user) return false;
  if (user.profileCompleted === true) return true;

  return Boolean(
    user.name?.trim() &&
      user.phone?.trim() &&
      user.gender &&
      user.region?.trim() &&
      user.level
  );
}

/**
 * Persist profileCompleted when all required fields are present.
 */
async function ensureProfileCompletedFlag(user) {
  if (!user) return user;
  if (isUserProfileComplete(user) && !user.profileCompleted) {
    user.profileCompleted = true;
    await user.save();
  }
  return user;
}

module.exports = {
  isUserProfileComplete,
  ensureProfileCompletedFlag,
};
