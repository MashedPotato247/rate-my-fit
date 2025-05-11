require('dotenv').config(); // Load environment variables
const express = require('express');
const multer = require('multer');
const path = require('path');
const admin = require('firebase-admin'); // Firebase Admin SDK
const session = require('express-session'); // Session management
const nodemailer = require('nodemailer'); // Email sending functionality
const bcrypt = require('bcrypt'); // Password hashing
const axios = require('axios'); // HTTP client for API requests

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
const serviceAccount = require('./rate-my-fit-bf625-firebase-adminsdk-fbsvc-393c53b96f.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore(); // Firestore database instance

// Setup Nodemailer transporter using Gmail for testing
// For production, consider using a dedicated email service
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER || 'your.email@gmail.com', // Replace with your actual Gmail or use environment variables
    pass: process.env.EMAIL_PASS || 'your-app-password' // Use an App Password if you have 2FA enabled
  }
});

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

// User registration route

app.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if user already exists in Firestore
    const userRef = db.collection('users').doc(email);
    const doc = await userRef.get();

    if (doc.exists) {
      return res.status(400).send('User already exists!');
    }

    // Create the user in Firebase Authentication
    const firebaseUser = await admin.auth().createUser({
      email,
      password,
      displayName: username,
      emailVerified: false, // Default is false, being explicit
    });
    
    // Generate a random 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = Date.now() + 3600000; // 1 hour from now
    
    // Store verification code in Firestore
    await db.collection('verification_codes').doc(email).set({
      code: verificationCode,
      expires: verificationExpires
    });
    
    // Save the user to Firestore
    await userRef.set({
      username,
      email,
      uid: firebaseUser.uid, // Store the Firebase UID for reference
      emailVerified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Send verification email with 6-digit code
    const mailOptions = {
      from: '"Rate My Fit" <noreply@ratemyfit.com>',
      to: email,
      subject: 'Verify your Rate My Fit account',
      html: `
        <h1>Welcome to Rate My Fit!</h1>
        <p>Hey ${username}! Thanks for joining our community. 🔥</p>
        <p>Please verify your email address by entering the 6-digit code below on our website:</p>
        <div style="font-size: 24px; letter-spacing: 5px; text-align: center; margin: 20px; padding: 10px; background-color: #f7f7f7; font-family: monospace; font-weight: bold;">${verificationCode}</div>
        <p>This code will expire in 1 hour.</p>
      `
    };

    try {
      // Send verification email
      await transporter.sendMail(mailOptions);
      console.log(`Verification email sent to: ${email}`);
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      // We still want to create the user even if email fails
    }
    
    // Redirect to verification page
    res.redirect(`/verify?email=${email}`);
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
    // First, check if the user exists in Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(email)
      .catch(error => {
        console.error("Error fetching user:", error);
        return null;
      });
    
    if (!userRecord) {
      return res.render('login', { error: 'User does not exist!' });
    }
    
    // Check if email is verified
    if (!userRecord.emailVerified) {
      // Generate a new 6-digit verification code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const verificationExpires = Date.now() + 3600000; // 1 hour from now
      
      // Store verification code in Firestore
      await db.collection('verification_codes').doc(email).set({
        code: verificationCode,
        expires: verificationExpires
      });
      
      // Send verification email with 6-digit code
      const mailOptions = {
        from: '"Rate My Fit" <noreply@ratemyfit.com>',
        to: email,
        subject: 'Verify your Rate My Fit account',
        html: `
          <h1>Welcome to Rate My Fit!</h1>
          <p>Hey ${userRecord.displayName}! Thanks for joining our community. 🔥</p>
          <p>Please verify your email address by entering the 6-digit code below on our website:</p>
          <div style="font-size: 24px; letter-spacing: 5px; text-align: center; margin: 20px; padding: 10px; background-color: #f7f7f7; font-family: monospace; font-weight: bold;">${verificationCode}</div>
          <p>This code will expire in 1 hour.</p>
        `
      };
      
      try {
        // Send verification email
        await transporter.sendMail(mailOptions);
        console.log(`Verification email sent to: ${email}`);
      } catch (emailError) {
        console.error('Error sending verification email:', emailError);
      }
      
      return res.redirect(`/verify?email=${email}&message=Please verify your email before logging in! We sent you a verification code.`);
    }
    
    // Fetch user data from Firestore for additional info
    const userRef = db.collection('users').doc(email);
    const doc = await userRef.get();
    
    if (!doc.exists) {
      return res.render('login', { error: 'User account incomplete. Please contact support.' });
    }
    
    // Since Firebase Admin SDK doesn't provide password verification,
    // we need to use the Firebase Auth REST API
    try {
      // Get your Firebase Web API Key from Firebase Console -> Project Settings -> General
      const firebaseApiKey = process.env.FIREBASE_API_KEY || 'YOUR_FIREBASE_API_KEY';
      
      // Use Firebase Auth REST API to sign in with email/password
      const response = await axios.post(
        `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseApiKey}`,
        {
          email,
          password,
          returnSecureToken: true
        }
      );
      
      // If we got here, the password is correct
      
      // Set user in session
      req.session.user = {
        username: userRecord.displayName,
        email: userRecord.email,
        uid: userRecord.uid,
        emailVerified: userRecord.emailVerified
      };
      
      // Update Firestore record to match Auth status
      await userRef.update({
        emailVerified: userRecord.emailVerified,
        lastLogin: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // Redirect to dashboard
      res.redirect('/dashboard');
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      return res.render('login', { error: 'Invalid email or password' });
    }
    
    // Set user in session
    req.session.user = {
      username: userRecord.displayName,
      email: userRecord.email,
      uid: userRecord.uid,
      emailVerified: userRecord.emailVerified
    };
    
    // Update Firestore record to match Auth status
    await userRef.update({
      emailVerified: userRecord.emailVerified,
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Redirect to dashboard
    res.redirect('/dashboard');
  } catch (error) {
    console.error(error);
    res.status(500).send('Error: ' + error.message);
  }
});

app.get('/login', (req, res) => {
  const { message, error } = req.query;
  res.render('login', { message, error }); // Pass any messages to the login template
});

// Verification routes
app.get('/verify', (req, res) => {
  const { email, message, error } = req.query;
  
  if (!email) {
    return res.redirect('/login?error=Email is required for verification');
  }
  
  res.render('verification', { email, message, error });
});

app.post('/verify', async (req, res) => {
  const { email, code1, code2, code3, code4, code5, code6 } = req.body;
  const submittedCode = `${code1}${code2}${code3}${code4}${code5}${code6}`;
  
  try {
    // Get the verification code from Firestore
    const codeRef = db.collection('verification_codes').doc(email);
    const codeDoc = await codeRef.get();
    
    if (!codeDoc.exists) {
      return res.render('verification', { 
        email, 
        error: 'Verification code not found. Please request a new one.' 
      });
    }
    
    const { code, expires } = codeDoc.data();
    
    // Check if code is expired
    if (Date.now() > expires) {
      return res.render('verification', { 
        email, 
        error: 'Verification code has expired. Please request a new one.' 
      });
    }
    
    // Check if code matches
    if (submittedCode !== code) {
      return res.render('verification', { 
        email, 
        error: 'Invalid verification code. Please try again.' 
      });
    }
    
    // Code is valid, update user's email verification status in Firebase Auth
    await admin.auth().updateUser(
      (await admin.auth().getUserByEmail(email)).uid, 
      { emailVerified: true }
    );
    
    // Update emailVerified status in Firestore
    await db.collection('users').doc(email).update({
      emailVerified: true
    });
    
    // Delete the used verification code
    await codeRef.delete();
    
    // Redirect to login with success message
    res.redirect('/login?message=Email successfully verified! You can now log in.');
  } catch (error) {
    console.error('Verification error:', error);
    res.render('verification', { 
      email, 
      error: 'An error occurred during verification. Please try again.' 
    });
  }
});

app.get('/resend-verification', async (req, res) => {
  const { email } = req.query;
  
  if (!email) {
    return res.redirect('/login?error=Email is required for verification');
  }
  
  try {
    // Check if user exists in Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(email)
      .catch(error => {
        console.error("Error fetching user:", error);
        return null;
      });
    
    if (!userRecord) {
      return res.redirect('/login?error=User does not exist');
    }
    
    // If email is already verified, no need to resend
    if (userRecord.emailVerified) {
      return res.redirect('/login?message=Email is already verified. You can log in.');
    }
    
    // Get username from Firestore
    const userDoc = await db.collection('users').doc(email).get();
    if (!userDoc.exists) {
      return res.redirect('/login?error=User account incomplete');
    }
    const username = userDoc.data().username;
    
    // Generate a new 6-digit verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const verificationExpires = Date.now() + 3600000; // 1 hour from now
    
    // Store verification code in Firestore
    await db.collection('verification_codes').doc(email).set({
      code: verificationCode,
      expires: verificationExpires
    });
    
    // Send verification email with 6-digit code
    const mailOptions = {
      from: '"Rate My Fit" <noreply@ratemyfit.com>',
      to: email,
      subject: 'Verify your Rate My Fit account',
      html: `
        <h1>Welcome to Rate My Fit!</h1>
        <p>Hey ${username}! Thanks for being part of our community. 🔥</p>
        <p>Please verify your email address by entering the 6-digit code below on our website:</p>
        <div style="font-size: 24px; letter-spacing: 5px; text-align: center; margin: 20px; padding: 10px; background-color: #f7f7f7; font-family: monospace; font-weight: bold;">${verificationCode}</div>
        <p>This code will expire in 1 hour.</p>
      `
    };

    try {
      // Send verification email
      await transporter.sendMail(mailOptions);
      console.log(`Verification email resent to: ${email}`);
      res.render('verification', { 
        email, 
        message: 'A new verification code has been sent to your email.' 
      });
    } catch (emailError) {
      console.error('Error sending verification email:', emailError);
      res.render('verification', { 
        email, 
        error: 'Failed to send verification email. Please try again later.' 
      });
    }
  } catch (error) {
    console.error('Resend verification error:', error);
    res.redirect(`/verify?email=${email}&error=An error occurred. Please try again.`);
  }
});

// Dashboard Route
app.get('/dashboard', checkAuth, async (req, res) => {
  try {
    // Get user email from session
    const { email } = req.session.user;

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