/** Auth AsyncStorage keys — kept separate to avoid circular imports. */
export const AUTH_KEYS = {
  accessToken: 'accessToken',
  refreshToken: 'refreshToken',
  userId: 'userId',
  userEmail: 'userEmail',
  userName: 'userName',
  userAvatar: 'userAvatar',
  userRegion: 'userRegion',
  gender: 'gender',
  level: 'level',
  userPhone: 'userPhone',
} as const;
