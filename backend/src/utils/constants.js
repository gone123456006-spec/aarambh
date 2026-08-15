module.exports = {
  DB_NAME: "aarambh",
  OTP_EXPIRY_MINUTES: 5,
  MAX_OTP_ATTEMPTS: 3,
  MAX_FILE_SIZES: {
    video: 100 * 1024 * 1024, // 100MB
    pdf: 20 * 1024 * 1024,    // 20MB
    image: 5 * 1024 * 1024,   // 5MB
    hero: 8 * 1024 * 1024,    // 8MB home hero banner
  },
  GAMES: {
    QUIZ: "quiz",
    SCRAMBLE: "scramble",
    FILL: "fill",
    FLASH: "flash",
  },
  LEVELS: {
    BEGINNER: "beginner",
    INTERMEDIATE: "intermediate",
    ADVANCED: "advanced",
  },
  GENDERS: ["Male", "Female", "Other"],
};
