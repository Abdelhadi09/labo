const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary under the "ordonnances" folder.
 * Returns the secure HTTPS URL of the uploaded image.
 */
const uploadOrdonnance = (fileBuffer, originalName, mimeType) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'ordonnances',
        resource_type: 'image',
        // Keep original filename (without extension) as public_id context
        use_filename: true,
        unique_filename: true,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

/**
 * Delete an image from Cloudinary by its secure URL.
 * Extracts the public_id from the URL automatically.
 */
const deleteOrdonnance = async (secureUrl) => {
  try {
    // Extract public_id: everything between /upload/vXXXXX/ and the extension
    const match = secureUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
    if (!match) return;
    const publicId = match[1]; // e.g. "ordonnances/abc123"
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('Cloudinary delete error:', err);
  }
};

module.exports = { uploadOrdonnance, deleteOrdonnance };