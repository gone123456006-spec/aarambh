const cloudinary = require('../config/cloudinary');
const ApiError = require('../utils/ApiError');

/**
 * Upload buffer directly to Cloudinary using stream
 */
const uploadToCloudinary = (fileBuffer, folder, resourceType = 'auto') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `aarambh/${folder}`,
        resource_type: resourceType,
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary Upload Error:', error);
          return reject(new ApiError(500, `Cloudinary upload failed: ${error.message}`));
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          duration: result.duration, // Returns duration in seconds for videos
        });
      }
    );

    // End upload stream with buffer content
    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete asset from Cloudinary using public ID
 */
const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
    return result;
  } catch (error) {
    console.error('Cloudinary Deletion Error:', error);
    throw new ApiError(500, `Cloudinary delete failed: ${error.message}`);
  }
};

module.exports = {
  uploadToCloudinary,
  deleteFromCloudinary,
};
