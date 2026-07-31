const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  duration: {
    type: String,
    default: '0:00',
    trim: true,
  },
  type: {
    type: String,
    default: 'video',
  },
  /** "About this lesson" shown in the app */
  description: {
    type: String,
    trim: true,
    default: '',
  },
  pdfTitle: {
    type: String,
    trim: true,
    default: '',
  },
  videoUrl: {
    type: String,
    trim: true,
  },
  videoAvailableAt: {
    type: Date,
  },
  pdfUrl: {
    type: String,
    trim: true,
  },
  pdfAvailableAt: {
    type: Date,
  },
  order: {
    type: Number,
    default: 0,
  },
  /** Stable key for progress (auto-generated if omitted) */
  lessonKey: {
    type: String,
    trim: true,
  },
});

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    subtitle: {
      type: String,
      trim: true,
      default: '',
    },
    /** Category slug: beginner, intermediate, advanced, or custom (e.g. business) */
    level: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    color: [
      {
        type: String,
      },
    ],
    sortOrder: {
      type: Number,
      default: 0,
    },
    videoSource: {
      type: String,
      default: '',
    },
    lessons: [lessonSchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    views: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Course = mongoose.model('Course', courseSchema);

module.exports = Course;
