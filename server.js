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
app.use(express.static('public'));
app.set('view engine', 'ejs');

// Routes
app.get('/', (req, res) => res.render('index'));
app.get('/trending', (req, res) => res.render('trending'));

app.post('/upload', upload.single('fitImage'), (req, res) => {
  if (!req.file) {
    return res.render('index', { msg: 'No file uploaded!' });
  }
  res.render('index', { msg: 'File uploaded successfully!', file: `/uploads/${req.file.filename}` });
});

// Start Server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));