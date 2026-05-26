export type UserProfile = {
  id?: string;
  _id?: string;
  email?: string;
  name?: string;
  phone?: string;
  gender?: string;
  region?: string;
  level?: string;
  profileCompleted?: boolean;
};

/** Matches backend isUserProfileComplete */
export function isProfileCompleteUser(user: UserProfile | null | undefined): boolean {
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
