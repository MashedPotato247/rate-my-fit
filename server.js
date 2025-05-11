const express = require('express');
const multer = require('multer');
const path = require('path');
const admin = require('firebase-admin'); // Firebase Admin SDK
const session = require('express-session'); // Add this at the top of your file

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
const serviceAccount = require('./rate-my-fit-bf625-firebase-adminsdk-fbsvc-393c53b96f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore(); // Firestore database instance

// Initialize session middleware
app.use(session({
  secret: 'a3f8c9e7d6b5a4f3c2e1d0f9b8a7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7', // 128-character randomly generated key
  resave: false,
  saveUninitialized: true,
}));

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

// Example: Pass user to all views
app.use((req, res, next) => {
  res.locals.user = req.session ? req.session.user : null;
  next();
});

// Authentication Middleware
function checkAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    // If no session or user, redirect to login
    return res.redirect('/login');
  }
  next(); // User is authenticated, proceed to the next middleware/route
}

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

// Protect the upload route
app.post('/upload', checkAuth, upload.single('fitImage'), (req, res) => {
  if (!req.file) {
    return res.render('index', { msg: 'No file uploaded!', file: null });
  }
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

app.get('/register', (req, res) => {
  res.render('register'); // Render the register.ejs file
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

    // Set user in session
    req.session.user = {
      username: user.username,
      email: user.email,
    };

    // Redirect to dashboard
    res.redirect(`/dashboard?email=${email}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Error: ' + error.message);
  }
});

app.get('/login', (req, res) => {
  res.render('login'); // Render the login.ejs file
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

// Protect the voting route
app.post('/vote', checkAuth, async (req, res) => {
  const { outfitId, voteType, userId } = req.body;

  try {
    const outfitRef = db.collection('outfits').doc(outfitId);
    const doc = await outfitRef.get();

    if (!doc.exists) {
      return res.status(404).send('Outfit not found!');
    }

    const outfit = doc.data();
    const voters = outfit.voters || [];
    if (voters.includes(userId)) {
      return res.status(400).send('You have already voted for this outfit!');
    }

    if (voteType === 'fire') {
      outfit.fireVotes = (outfit.fireVotes || 0) + 1;
    } else if (voteType === 'nope') {
      outfit.nopeVotes = (outfit.nopeVotes || 0) + 1;
    } else {
      return res.status(400).send('Invalid vote type!');
    }

    voters.push(userId);
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

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login'); // Redirect to login after logout
  });
});

// Start Server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));