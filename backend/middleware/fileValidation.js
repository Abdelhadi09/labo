// Magic bytes (file signatures) for allowed image types.
// These are the actual first bytes of the binary file — impossible to spoof
// by just renaming or changing the Content-Type header.
const MAGIC = {
  // JPEG: FF D8 FF
  jpeg: { bytes: [0xff, 0xd8, 0xff], offset: 0 },
  // PNG:  89 50 4E 47 0D 0A 1A 0A
  png:  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 },
  // WEBP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50  ("RIFF....WEBP")
  webp: { bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 },        // check "RIFF"
  webp2:{ bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },        // check "WEBP"
  // TIFF: 49 49 2A 00 (little-endian) or 4D 4D 00 2A (big-endian)
  tiffLE: { bytes: [0x49, 0x49, 0x2a, 0x00], offset: 0 },
  tiffBE: { bytes: [0x4d, 0x4d, 0x00, 0x2a], offset: 0 },
};

/**
 * Returns true if `buffer` starts with the given byte sequence at `offset`.
 */
function matchesSignature(buffer, bytes, offset = 0) {
  if (buffer.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buffer[offset + i] === b);
}

/**
 * Validates the actual magic bytes of an uploaded file buffer.
 * Returns the detected type string, or null if unrecognised.
 */
function detectImageType(buffer) {
  if (matchesSignature(buffer, MAGIC.jpeg.bytes))   return 'jpeg';
  if (matchesSignature(buffer, MAGIC.png.bytes))    return 'png';
  if (matchesSignature(buffer, MAGIC.tiffLE.bytes)) return 'tiff';
  if (matchesSignature(buffer, MAGIC.tiffBE.bytes)) return 'tiff';
  // WEBP needs both "RIFF" at 0 and "WEBP" at 8
  if (
    matchesSignature(buffer, MAGIC.webp.bytes,  MAGIC.webp.offset) &&
    matchesSignature(buffer, MAGIC.webp2.bytes, MAGIC.webp2.offset)
  ) return 'webp';
  return null;
}

/**
 * Express middleware — must be used AFTER multer so req.file is populated.
 * Rejects the request if:
 *   - No file was uploaded (pass-through; let route handle required-file logic)
 *   - Magic bytes don't match any allowed image type
 *   - Declared MIME type doesn't match the detected type (mismatch attack)
 */
function validateImageFile(req, res, next) {
  if (!req.file) return next(); // no file → let the route handle it

  const detected = detectImageType(req.file.buffer);

  if (!detected) {
    return res.status(400).json({
      error: 'Fichier invalide. Seuls les formats JPEG, PNG, WEBP et TIFF sont acceptés.',
    });
  }

  // Cross-check with the declared MIME type
  const mimeMap = {
    jpeg: 'image/jpeg',
    png:  'image/png',
    webp: 'image/webp',
    tiff: 'image/tiff',
  };
  const expectedMime = mimeMap[detected];
  if (req.file.mimetype !== expectedMime) {
    return res.status(400).json({
      error: `Le type de fichier déclaré (${req.file.mimetype}) ne correspond pas au contenu réel (${expectedMime}).`,
    });
  }

  // Attach detected type so routes can use it without re-detecting
  req.file.detectedType = detected;
  next();
}

module.exports = { validateImageFile, detectImageType };