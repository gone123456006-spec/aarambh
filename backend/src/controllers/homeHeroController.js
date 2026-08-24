const HomeHero = require('../models/HomeHero');
const uploadService = require('../services/uploadService');
const { buildPublicUploadUrl, relativeUploadPath } = require('../config/uploads');
const ApiError = require('../utils/ApiError');
const ApiResponse = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');

const HERO_KEY = HomeHero.KEY || 'home';

function noStore(res) {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Pragma', 'no-cache');
}

function storedPath(doc) {
  if (!doc) return null;
  return doc.imagePath || relativeUploadPath(doc.imageUrl) || null;
}

function formatHero(req, doc) {
  const imagePath = storedPath(doc);
  if (!imagePath) {
    return { imageUrl: null, updatedAt: null };
  }
  return {
    imageUrl: buildPublicUploadUrl(req, imagePath),
    updatedAt: doc.updatedAt || doc.createdAt || null,
  };
}

async function getHeroDoc() {
  return HomeHero.findOneAndUpdate(
    { key: HERO_KEY },
    { $setOnInsert: { key: HERO_KEY, imageUrl: null, imagePath: null } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

const getPublicHero = asyncHandler(async (req, res) => {
  const doc = await HomeHero.findOne({ key: HERO_KEY }).lean();
  noStore(res);
  res.status(200).json(new ApiResponse(200, formatHero(req, doc), 'Home hero retrieved'));
});

const getAdminHero = asyncHandler(async (req, res) => {
  const doc = await getHeroDoc();
  noStore(res);
  res.status(200).json(new ApiResponse(200, formatHero(req, doc), 'Home hero retrieved'));
});

const uploadHero = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, 'Please choose an image to upload');
  }

  const payload = await uploadService.saveHeroImage(req);

  try {
    const previous = await HomeHero.findOneAndUpdate(
      { key: HERO_KEY },
      {
        $set: {
          imagePath: payload.path,
          imageUrl: payload.url,
        },
      },
      { upsert: true, new: false, setDefaultsOnInsert: true }
    );

    const previousPath = storedPath(previous);
    if (previousPath && previousPath !== payload.path) {
      uploadService.deleteLocalPath(previousPath);
    }

    const doc = await HomeHero.findOne({ key: HERO_KEY });
    noStore(res);
    res.status(200).json(new ApiResponse(200, formatHero(req, doc), 'Home hero image saved'));
  } catch (err) {
    uploadService.deleteLocalPath(payload.path);
    throw err;
  }
});

const deleteHero = asyncHandler(async (req, res) => {
  const doc = await getHeroDoc();
  const previousPath = storedPath(doc);
  if (previousPath) {
    uploadService.deleteLocalPath(previousPath);
  }
  if (doc.imageUrl) {
    uploadService.deleteLocalAsset(doc.imageUrl);
  }
  doc.imagePath = null;
  doc.imageUrl = null;
  await doc.save();

  noStore(res);
  res.status(200).json(new ApiResponse(200, formatHero(req, doc), 'Home hero image removed'));
});

module.exports = {
  getPublicHero,
  getAdminHero,
  uploadHero,
  deleteHero,
};
