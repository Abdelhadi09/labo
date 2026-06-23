const Tesseract = require('tesseract.js');
const { withTimeout } = require('../utils/withTimeout');

/**
 * Run OCR on an image buffer and return extracted text.
 * Times out after 60 seconds for large images.
 */
const extractTextFromImage = async (imageBuffer) => {
  try {
    const ocr = Tesseract.recognize(imageBuffer, 'fra+eng', {
      logger: () => {}, // suppress logs
    }).then(result => result.data.text);

    return await withTimeout(ocr, 60_000, 'Tesseract OCR');
  } catch (err) {
    console.error('OCR Error:', err);
    throw new Error('Failed to perform OCR on the image');
  }
};

/**
 * Match OCR text against analysis services using keywords
 */
const matchServicesFromText = (ocrText, services) => {
  const normalizedText = ocrText
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const matched = [];

  for (const service of services) {
    const keywords = service.keywords
      ? service.keywords.split(',').map((k) => k.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))
      : [];

    // Also include the service name itself
    keywords.push(
      service.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
    );
    keywords.push(service.code.toLowerCase());

    const found = keywords.some((keyword) => {
      if (!keyword) return false;
      // Check for whole word / phrase match
      return normalizedText.includes(keyword);
    });

    if (found) {
      matched.push(service);
    }
  }

  return matched;
};

module.exports = { extractTextFromImage, matchServicesFromText };
