const mongoose = require('mongoose');

const courseProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    completedLessons: [
      {
        type: String, // String lesson IDs (e.g. 'b1', 'b2')
      },
    ],
    lastLessonId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const CourseProgress = mongoose.model('CourseProgress', courseProgressSchema);

module.exports = CourseProgress;
