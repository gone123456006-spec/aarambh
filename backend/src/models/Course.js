const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  duration: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    default: 'video',
  },
  description: {
    type: String,
    trim: true,
  },
  pdfTitle: {
    type: String,
    trim: true,
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
    },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      required: true,
      unique: true, // One course per level (beginner/intermediate/advanced) containing lessons
    },
    color: [
      {
        type: String,
      },
    ],
    videoSource: {
      type: String, // fallback URL
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
