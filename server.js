const express = require('express');
const multer = require('multer');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Set Storage Engine for Multer
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

// Initialize Multer
const upload = multer({ storage });

// Middleware
app.use(express.static('public')); // Serve static files (like CSS, images)
app.set('view engine', 'ejs'); // Set EJS as the template engine

// Routes

// Home Page Route
app.get('/', (req, res) => {
  res.render('index', { msg: null, file: null }); // Default values for msg and file
});

// Trending Page Route
app.get('/trending', (req, res) => {
  res.render('trending'); // Render trending page (placeholder for now)
});

// Upload Route
app.post('/upload', upload.single('fitImage'), (req, res) => {
  if (!req.file) {
    // Handle case where no file is uploaded
    return res.render('index', { msg: 'No file uploaded!', file: null });
  }
  // File successfully uploaded
  res.render('index', { msg: 'File uploaded successfully!', file: `/uploads/${req.file.filename}` });
});

// Start Server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));