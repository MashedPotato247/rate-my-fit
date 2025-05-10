const express = require('express');
const multer = require('multer');
const path = require('path');
const admin = require('firebase-admin'); // Firebase Admin SDK

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
const serviceAccount = require('./rate-my-fit-bf625-firebase-adminsdk-fbsvc-393c53b96f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore(); // Firestore database instance

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
app.use(express.urlencoded({ extended: true })); // Parse form data
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

// Registration Route
app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if user already exists
    const userRef = db.collection('users').doc(email);
    const doc = await userRef.get();

    if (doc.exists) {
      return res.status(400).send('User already exists!');
    }

    // Save new user
    await userRef.set({
      username,
      email,
      password, // No hashing for simplicity (you can add bcrypt later)
    });

    res.send('The account was created successfully');
  } catch (error) {
    console.error(error);
    res.status(400).send('Error: ' + error.message);
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));