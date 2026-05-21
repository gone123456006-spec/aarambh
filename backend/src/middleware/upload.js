const multer = require('multer');
const ApiError = require('../utils/ApiError');
const { MAX_FILE_SIZES } = require('../utils/constants');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const mimeType = file.mimetype;

  if (file.fieldname === 'video') {
    if (mimeType.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Invalid file type. Only videos are allowed for this field.'), false);
    }
  } else if (file.fieldname === 'pdf') {
    if (mimeType === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Invalid file type. Only PDFs are allowed for this field.'), false);
    }
  } else if (file.fieldname === 'image' || file.fieldname === 'avatar') {
    if (mimeType.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new ApiError(400, 'Invalid file type. Only images are allowed for this field.'), false);
    }
  } else {
    cb(null, true);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: Math.max(MAX_FILE_SIZES.video, MAX_FILE_SIZES.pdf, MAX_FILE_SIZES.image),
  },
});

module.exports = upload;
