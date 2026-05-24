const multer = require('multer');

// Usa memoryStorage per evitare problemi di filesystem su Render (ephemeral disk)
// I file vengono salvati come base64 in MongoDB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Solo file PDF consentiti'));
  },
});

module.exports = upload;
