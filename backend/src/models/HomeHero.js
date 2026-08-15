const mongoose = require('mongoose');

const KEY = 'home';

const homeHeroSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: KEY,
      unique: true,
      index: true,
    },
    imagePath: {
      type: String,
      default: null,
    },
    imageUrl: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

homeHeroSchema.statics.KEY = KEY;

module.exports = mongoose.model('HomeHero', homeHeroSchema);
