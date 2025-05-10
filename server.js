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
app.get('/trending', async (req, res) => {
  try {
    const outfitsSnapshot = await db.collection('outfits').get();
    const outfits = outfitsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    const userId = "testUser123"; // Placeholder userId for now
    res.render('trending', { outfits, userId }); // Pass userId to the template
  } catch (error) {
    console.error(error);
    res.status(500).send('Error: ' + error.message);
  }
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

const bcrypt = require('bcrypt'); // Add this at the top of the file

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if user already exists
    const userRef = db.collection('users').doc(email);
    const doc = await userRef.get();

    if (doc.exists) {
      return res.status(400).send('User already exists!');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save new user
    await userRef.set({
      username,
      email,
      password: hashedPassword, // Save the hashed password
    });

    res.send('The account was created successfully');
  } catch (error) {
    console.error(error);
    res.status(400).send('Error: ' + error.message);
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const userRef = db.collection('users').doc(email);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(400).send('User does not exist!');
    }

    const user = doc.data();

    // Compare the hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).send('Invalid credentials!');
    }

    res.send('Login successful!');
  } catch (error) {
    console.error(error);
    res.status(400).send('Error: ' + error.message);
  }
});

// Dashboard Route
app.get('/dashboard', async (req, res) => {
  const { email } = req.query; // Assume email is passed as a query parameter for now

  try {
    // Fetch user data from Firestore
    const userRef = db.collection('users').doc(email);
    const doc = await userRef.get();

    if (!doc.exists) {
      return res.status(404).send('User not found!');
    }

    const user = doc.data();

    // Render the dashboard view with user data
    res.render('dashboard', { user });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error: ' + error.message);
  }
});

// Voting Route
app.post('/vote', async (req, res) => {
  const { outfitId, voteType, userId } = req.body; // Include userId in the request

  try {
    const outfitRef = db.collection('outfits').doc(outfitId);
    const doc = await outfitRef.get();

    if (!doc.exists) {
      return res.status(404).send('Outfit not found!');
    }

    const outfit = doc.data();

    // Check if the user has already voted
    const voters = outfit.voters || []; // Get the list of voters (default to empty array)
    if (voters.includes(userId)) {
      return res.status(400).send('You have already voted for this outfit!');
    }

    // Update vote count
    if (voteType === 'fire') {
      outfit.fireVotes = (outfit.fireVotes || 0) + 1;
    } else if (voteType === 'nope') {
      outfit.nopeVotes = (outfit.nopeVotes || 0) + 1;
    } else {
      return res.status(400).send('Invalid vote type!');
    }

    // Add the user to the list of voters
    voters.push(userId);

    // Save updated votes and voters back to Firestore
    await outfitRef.update({
      fireVotes: outfit.fireVotes,
      nopeVotes: outfit.nopeVotes,
      voters: voters,
    });

    res.send('Vote recorded!');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error: ' + error.message);
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));