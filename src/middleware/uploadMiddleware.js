const multer = require('multer');

// Configure multer to use memory storage
const storage = multer.memoryStorage();

// File filter to allow only images
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
    cb(null, true); // Accept image or pdf
  } else {
    cb(new Error('Invalid file type. Only images and PDFs are allowed.'), false); // Reject
  }
};


const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 1024 * 1024 * 5, // 5 MB file size limit
  },
});

module.exports = upload;