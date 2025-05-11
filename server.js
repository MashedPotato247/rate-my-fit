require('dotenv').config(); // Load environment variables
const express = require('express');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt'); // For password hashing
const fs = require('fs'); // File system module
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;

const app = express();
const PORT = process.env.PORT || 3000;

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Simple JSON database for users
const userDbPath = path.join(dataDir, 'users.json');
if (!fs.existsSync(userDbPath)) {
  fs.writeFileSync(userDbPath, JSON.stringify({ users: [] }));
}

// Load users database
let db = { users: [] };
try {
  db = JSON.parse(fs.readFileSync(userDbPath, 'utf8'));
} catch (err) {
  console.error('Error loading users database:', err);
}

// Save user database function
const saveDb = () => {
  try {
    fs.writeFileSync(userDbPath, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error('Error saving users database:', err);
  }
};

// Initialize session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'a3f8c9e7d6b5a4f3c2e1d0f9b8a7c6d5e4f3a2b1c0d9e8', 
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' } // Using secure cookies in production
}));

// Initialize Passport for social login
app.use(passport.initialize());
app.use(passport.session());

// Passport serialize/deserialize
passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  const user = db.users.find(u => u.id === id);
  done(null, user);
});

// Configure Google Strategy
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user already exists
      let user = db.users.find(u => 
        u.googleId === profile.id || 
        (u.email === profile.emails[0].value)
      );
      
      if (user) {
        // Update existing user
        if (!user.googleId) {
          // Link accounts
          user.googleId = profile.id;
          saveDb();
        }
      } else {
        // Create new user
        user = {
          id: Date.now().toString(),
          googleId: profile.id,
          username: `user_${Date.now()}`,
          email: profile.emails[0].value,
          displayName: profile.displayName,
          photoURL: profile.photos[0].value,
          createdAt: new Date().toISOString(),
          isNewUser: true
        };
        
        db.users.push(user);
        saveDb();
      }
      
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: '/auth/github/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      // Fallback for email if profile.emails is undefined or empty
      const email = (profile.emails && profile.emails.length > 0) ? profile.emails[0].value : null;

      let user = db.users.find(u => u.githubId === profile.id || u.email === email);
      if (user) {
        if (!user.githubId) {
          user.githubId = profile.id;
          saveDb();
        }
      } else {
        user = {
          id: Date.now().toString(),
          githubId: profile.id,
          username: profile.username || `user_${Date.now()}`,
          email: email, // Use fallback email
          displayName: profile.displayName || profile.username,
          photoURL: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
          createdAt: new Date().toISOString(),
          isNewUser: true
        };
        db.users.push(user);
        saveDb();
      }
      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Set Storage Engine for Multer
const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

// Init Upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 10000000 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Images Only!');
    }
  }
}).single('fitImage');

// Set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');

// Body parser
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Auth Middleware
function checkAuth(req, res, next) {
  // Check both authentication methods:
  // 1. Session-based (traditional login)
  // 2. Passport-based (social login)
  if (req.session.user || req.isAuthenticated()) {
    // If authenticated via Passport but no session, set session for consistency
    if (req.isAuthenticated() && !req.session.user) {
      req.session.user = req.user;
    }
    
    // If new user without username, direct to complete-profile
    const user = req.session.user || req.user;
    if (user && user.isNewUser === true) {
      return res.redirect('/complete-profile');
    }
    
    return next();
  }
  res.redirect('/login');
}

// Login routes
app.get('/login', (req, res) => {
  const { message, error } = req.query;
  res.render('login', { message, error });
});

// Routes
// Ensure 'msg' is defined and passed to the template
app.get('/', (req, res) => {
  const msg = req.query.msg || null; // Retrieve 'msg' from query parameters or set to null
  const user = req.session.user || null; // Retrieve 'user' from session or set to null
  res.render('index', { msg, user, file: null }); // Pass 'msg' and 'user' to the template
});

// Dashboard Route
app.get('/dashboard', checkAuth, (req, res) => {
  // User will be available in req.session.user
  const user = req.session.user;
  
  // User data is already in the session, no need for database lookup
  res.render('dashboard', { user });
});

// Profile Route
app.get('/profile', checkAuth, (req, res) => {
  const user = req.session.user;
  res.render('profile', { user });
});

app.post('/profile', checkAuth, async (req, res) => {
  const { displayName, bio } = req.body;
  
  try {
    // Find user in database
    const userIndex = db.users.findIndex(u => u.id === req.session.user.id);
    
    if (userIndex === -1) {
      return res.render('profile', { 
        user: req.session.user,
        error: 'User not found'
      });
    }
    
    // Update user data
    db.users[userIndex].displayName = displayName;
    db.users[userIndex].bio = bio;
    
    // Save to database
    saveDb();
    
    // Update session
    req.session.user.displayName = displayName;
    req.session.user.bio = bio;
    
    res.render('profile', { 
      user: req.session.user,
      message: 'Profile updated successfully!'
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    res.render('profile', { 
      user: req.session.user,
      error: 'Something went wrong. Please try again.'
    });
  }
});

// Logout Route
app.get('/logout', (req, res) => {
  // Clear session and passport logout
  req.session.destroy(() => {
    req.logout(function(err) {
      if (err) { 
        console.error("Error during logout:", err);
      }
      res.redirect('/login');
    });
  });
});

// Protect the upload route
app.post('/upload', checkAuth, upload, (req, res) => {
  if (!req.file) {
    return res.render('index', { msg: 'No file uploaded!', file: null });
  }
  res.render('index', { msg: 'File uploaded successfully!', file: `/uploads/${req.file.filename}` });
});

// Social Login Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=Google+authentication+failed' }),
  function(req, res) {
    // If this is a new user, redirect to profile setup
    if (req.user.isNewUser) {
      return res.redirect('/complete-profile');
    }
    // Regular login, set session and redirect to dashboard
    req.session.user = req.user;
    res.redirect('/dashboard');
  }
);

// GitHub Login Route
app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login?error=GitHub+authentication+failed' }),
  function(req, res) {
    if (req.user.isNewUser) {
      return res.redirect('/complete-profile');
    }
    req.session.user = req.user;
    res.redirect('/dashboard');
  }
);

// Complete profile page for new social login users
app.get('/complete-profile', (req, res) => {
  // Only allow access if user is authenticated via Passport
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  res.render('complete-profile', { user: req.user });
});

app.post('/complete-profile', async (req, res) => {
  // Only allow access if user is authenticated via Passport
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  
  const { username, displayName } = req.body;
  
  try {
    // Check if username already exists
    if (db.users.some(u => u.username === username && u.id !== req.user.id)) {
      return res.render('complete-profile', { 
        user: req.user, 
        error: 'Username already taken' 
      });
    }
    
    // Find user in database
    const userIndex = db.users.findIndex(u => u.id === req.user.id);
    
    if (userIndex === -1) {
      return res.render('complete-profile', { 
        user: req.user, 
        error: 'User not found' 
      });
    }
    
    // Update username, displayName and remove isNewUser flag
    db.users[userIndex].username = username;
    db.users[userIndex].displayName = displayName || username;
    db.users[userIndex].isNewUser = false;
    
    // Save to database
    saveDb();
    
    // Update session and passport user
    req.user.username = username;
    req.user.displayName = displayName || username;
    req.user.isNewUser = false;
    req.session.user = req.user;
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Complete profile error:', error);
    res.render('complete-profile', { 
      user: req.user, 
      error: 'Something went wrong. Please try again.'
    });
  }
});

// Start Server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));