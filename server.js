require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const session = require('express-session');
const bcrypt = require('bcrypt');
const fs = require('fs');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const GitHubStrategy = require('passport-github2').Strategy;
const firebaseAdmin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 3000;

firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.applicationDefault(),
  databaseURL: process.env.FIREBASE_DATABASE_URL
});

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

app.use(session({
  secret: process.env.SESSION_SECRET || 'a3f8c9e7d6b5a4f3c2e1d0f9b8a7c6d5e4f3a2b1c0d9e8', 
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.user = req.session.user || req.user || null;
  res.locals.currentPath = req.path; // Add current path to all routes
  next();
});

passport.serializeUser((user, done) => {
  done(null, user.googleId || user.email);
});

passport.deserializeUser(async (identifier, done) => {
  try {
    const userRef = firebaseAdmin.firestore().collection('users');
    let userSnapshot;

    userSnapshot = await userRef.where('googleId', '==', identifier).get();

    if (userSnapshot.empty) {
      userSnapshot = await userRef.where('email', '==', identifier).get();
    }

    if (!userSnapshot.empty) {
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      userData.id = userDoc.id; // Add the document ID to the user object
      done(null, userData);
    } else {
      done(new Error('User not found'), null);
    }
  } catch (err) {
    done(err, null);
  }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      const userRef = firebaseAdmin.firestore().collection('users');
      let userSnapshot = await userRef.where('googleId', '==', profile.id).get();

      let user;
      if (!userSnapshot.empty) {
        user = userSnapshot.docs[0].data();
      } else {
        userSnapshot = await userRef.where('email', '==', profile.emails[0].value).get();
        if (!userSnapshot.empty) {
          user = userSnapshot.docs[0].data();
          await userRef.doc(userSnapshot.docs[0].id).update({
            googleId: profile.id
          });
        } else {
          const baseUsername = profile.emails[0].value.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
          const username = baseUsername + Math.floor(1000 + Math.random() * 9000);
          
          user = {
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            displayName: profile.displayName,
            username: username,
            avatar: profile.photos[0]?.value || null,
            photoURL: profile.photos[0]?.value || null, 
            createdAt: Date.now(),
            isNewUser: true
          };
          await userRef.add(user);
        }
      }

      return done(null, user);
    } catch (err) {
      console.error('Error in Google Strategy:', err);
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

      const userRef = firebaseAdmin.firestore().collection('users');
      let userSnapshot = await userRef.where('githubId', '==', profile.id).get();

      let user;
      if (!userSnapshot.empty) {
        user = userSnapshot.docs[0].data();
      } else {
        userSnapshot = await userRef.where('email', '==', email).get();
        if (!userSnapshot.empty) {
          user = userSnapshot.docs[0].data();
          await userRef.doc(userSnapshot.docs[0].id).update({
            githubId: profile.id
          });
        } else {
          user = {
            githubId: profile.id,
            username: profile.username || `user_${Date.now()}`,
            email: email, // Use fallback email
            displayName: profile.displayName || profile.username,
            photoURL: profile.photos && profile.photos[0] ? profile.photos[0].value : null,
            createdAt: new Date().toISOString(),
            isNewUser: true
          };
          await userRef.add(user);
        }
      }

      return done(null, user);
    } catch (err) {
      return done(err);
    }
  }
));

const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: './public/uploads/',
  filename: (req, file, cb) => {
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10000000 }, 
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

// Auth check
function checkAuth(req, res, next) {
  if (!req.session.user && !req.isAuthenticated()) {
    // Not logged in, redirect to login page
    return res.redirect('/login');
  }
  
  // Sync passport user with session if needed
  if (req.isAuthenticated() && !req.session.user) {
    req.session.user = req.user;
  }
  
  // Check if profile completion is required
  let currentUser = req.session.user || req.user;
  if (currentUser && currentUser.isNewUser) {
    return res.redirect('/complete-profile');
  }
  
  // User is authenticated and profile is complete
  next();
}

// Update the home route to redirect to /dashboard
app.get('/', function(req, res) {
  res.redirect('/dashboard');
});

app.get('/login', function(req, res) {
  var message = req.query.message;
  var error = req.query.error;
  res.render('login', { message, error });
});

app.get('/dashboard', checkAuth, async (req, res) => {
  const userId = req.session?.user?.uid || "guest";
  const user = req.session.user || req.user;
  
  try {
    console.log('Dashboard - User:', user ? user.email : 'User not available');
    
    if (!user || !user.email) {
      console.error('Dashboard - No valid user email available');
      return res.render('dashboard', {
        user, 
        uploads: [],
        totalUploads: 0,
        totalFireVotes: 0,
        profileViews: 0,
        error: 'Invalid user session. Please log in again.'
      });
    }
    
    // First, find the user document to get the correct Firestore ID
    const userCollection = firebaseAdmin.firestore().collection('users');
    console.log('Dashboard - Querying for user with email:', user.email);
    const userQuery = await userCollection.where('email', '==', user.email).get();
    
    if (userQuery.empty) {
      console.error('User not found in Firestore in dashboard:', user.email);
      return res.render('dashboard', { 
        user, 
        uploads: [],
        totalUploads: 0,
        totalFireVotes: 0,
        profileViews: 0,
        error: 'Could not find your account. Please try logging in again.'
      });
    }
    
    // Get the user document ID from Firestore
    const userId = userQuery.docs[0].id;
    console.log('Found user ID for dashboard:', userId);
    
    // Get user's uploads
    console.log('Querying uploads for user ID:', userId);
    
    // Debug: Check what outfits exist in the collection
    const allOutfitsQuery = await firebaseAdmin.firestore()
      .collection('outfits')
      .get();
    console.log('DEBUG: Total outfits in collection:', allOutfitsQuery.size);
    allOutfitsQuery.docs.forEach(doc => {
      const data = doc.data();
      console.log('DEBUG: Outfit in collection:', { id: doc.id, userId: data.userId, imageUrl: data.imageUrl });
    });
    
    try {
      const uploadsQuery = await firebaseAdmin.firestore()
        .collection('outfits')
        .where('userId', '==', userId)
        .orderBy('uploadedAt', 'desc')
        .get();
      
      console.log('Upload query returned:', uploadsQuery.size, 'documents');
      
      const uploads = uploadsQuery.docs.map(doc => {
        const data = doc.data();
        console.log('Outfit data:', { id: doc.id, userId: data.userId, imageUrl: data.imageUrl });
        return {
          id: doc.id,
          ...data
        };
      });
      
      // Calculate total fire votes received
      const totalFireVotes = uploads.reduce((total, outfit) => total + (outfit.fireVotes || 0), 0);
    
      // Get message from query params if exists
      const msg = req.query.msg || null;
      
      res.render('dashboard', { 
        user,
        uploads,
        totalUploads: uploads.length,
        totalFireVotes,
        profileViews: 0, // For future implementation
        msg
      });
    } catch (error) {
      console.error('Error in inner try block:', error);
      throw error; // Throw to outer catch block
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    
    // Make sure we still have userId from the outer scope
    if (!userId && user && user.email) {
      try {
        console.log('Trying to recover userId in catch block for:', user.email);
        const userQueryInCatch = await firebaseAdmin.firestore().collection('users').where('email', '==', user.email).get();
        if (!userQueryInCatch.empty) {
          userId = userQueryInCatch.docs[0].id;
          console.log('Recovered userId in catch block:', userId);
        }
      } catch (err) {
        console.error('Failed to recover userId in catch block:', err);
      }
    }
    
    if (!userId) {
      return res.render('dashboard', { 
        user, 
        uploads: [],
        totalUploads: 0,
        totalFireVotes: 0,
        profileViews: 0,
        error: 'Could not identify your user account'
      });
    }
    
    // Try to get at least some uploads without the ordering
    try {
      const simpleQuery = await firebaseAdmin.firestore()
        .collection('outfits')
        .where('userId', '==', userId)
        .get();
      
      console.log('Simple query returned:', simpleQuery.size, 'documents');
      
      if (simpleQuery.size > 0) {
        const uploads = simpleQuery.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        const totalFireVotes = uploads.reduce((total, outfit) => total + (outfit.fireVotes || 0), 0);
        
        return res.render('dashboard', {
          user,
          uploads,
          totalUploads: uploads.length,
          totalFireVotes,
          profileViews: 0,
          msg: 'Some data loaded with limited functionality'
        });
      }
    } catch (fallbackError) {
      console.error('Fallback query also failed:', fallbackError);
    }
    
    res.render('dashboard', { 
      user, 
      uploads: [],
      totalUploads: 0,
      totalFireVotes: 0,
      profileViews: 0,
      error: 'Could not load dashboard data'
    });
  }
});

app.get('/profile', checkAuth, async (req, res) => {
  const sessionUser = req.session.user || req.user;
  
  try {
    const userCollection = firebaseAdmin.firestore().collection('users');
    const userQuery = await userCollection.where('email', '==', sessionUser.email).get();
    
    if (userQuery.empty) {
      return res.render('profile', { 
        user: sessionUser,
        error: 'User not found in database'
      });
    }
    
    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    
    const user = { 
      id: userDoc.id, 
      ...userData,
      photoURL: userData.photoURL || userData.avatar,
      displayName: userData.displayName || userData.name,
      username: userData.username || userData.email.split('@')[0],
    };
    
    res.render('profile', { user });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.render('profile', { 
      user: sessionUser,
      error: 'Could not load profile data. Please try again.'
    });
  }
});

app.post('/profile', checkAuth, async (req, res) => {
  const { displayName, bio, username } = req.body;
  const user = req.session.user || req.user;
  
  try {
    // Make sure we have a valid user ID
    if (!user || !user.email) {
      return res.render('profile', { 
        user: user,
        error: 'Invalid user session. Please log in again.'
      });
    }
    
    // First, find user by email
    const userCollection = firebaseAdmin.firestore().collection('users');
    const userQuery = await userCollection.where('email', '==', user.email).get();
    
    if (userQuery.empty) {
      return res.render('profile', { 
        user: user,
        error: 'User not found'
      });
    }
    
    // Get the first document (should be only one with this email)
    const userDoc = userQuery.docs[0];
    const userId = userDoc.id;
    
    // Make sure we have a valid document ID
    if (!userId) {
      return res.render('profile', {
        user: user,
        error: 'Invalid user document. Please try logging in again.'
      });
    }
    
    const userRef = userCollection.doc(userId);
    
    // Check if username is taken by another user
    if (username && username !== user.username) {
      const usernameQuery = await userCollection.where('username', '==', username).get();
      if (!usernameQuery.empty && usernameQuery.docs[0].id !== userId) {
        return res.render('profile', {
          user: user,
          error: 'Username already taken'
        });
      }
    }
    
    // Update user data
    const updateData = { displayName, bio };
    if (username) updateData.username = username;
    
    await userRef.update(updateData);
    
    // Update session
    if (req.session.user) {
      req.session.user.displayName = displayName;
      req.session.user.bio = bio;
      if (username) req.session.user.username = username;
    }
    
    // Get updated user data to render the page
    const updatedUserDoc = await userRef.get();
    const updatedUser = { id: userId, ...updatedUserDoc.data() };
    
    res.render('profile', { 
      user: updatedUser,
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

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    req.logout(function(err) {
      if (err) { 
        console.error("Error during logout:", err);
      }
      res.redirect('/login');
    });
  });
});
app.post('/upload', checkAuth, upload, async (req, res) => {
  // Quick check if file exists
  if (!req.file) {
    return res.render('index', { msg: 'No file uploaded!', file: null });
  }
  
  try {
    // Get current user
    var user = req.session.user || req.user;
    
    // Find the user in Firebase
    var userCollection = firebaseAdmin.firestore().collection('users');
    var userQuery = await userCollection.where('email', '==', user.email).get();
    
    if (userQuery.empty) {
      console.error('User not found in Firestore when uploading:', user.email);
      return res.render('index', { 
        msg: 'Error finding user account. Please try logging in again.', 
        file: null 
      });
    }
    
    var userDocId = userQuery.docs[0].id;
    console.log('Found user ID for upload:', userDocId);
    
    // Prepare outfit data for Firebase
    var outfitData = {
      userId: userDocId,
      username: user.username || user.email.split('@')[0],
      imageUrl: `/uploads/${req.file.filename}`,
      fireVotes: 0,
      nopeVotes: 0,
      uploadedAt: new Date().toISOString()
    };
    
    console.log('Saving outfit with user ID:', outfitData.userId);
    
    await firebaseAdmin.firestore().collection('outfits').add(outfitData);
    
    // Redirect to the dashboard instead of just rendering
    res.redirect('/dashboard?msg=File+uploaded+successfully!');
  } catch (error) {
    console.error('Upload error:', error);
    res.render('index', { 
      msg: 'Error saving your upload. Please try again.', 
      file: null 
    });
  }
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
    const userRef = firebaseAdmin.firestore().collection('users');

    // Check if req.user.id exists
    if (!req.user.id) {
      console.error('User ID is missing in the request.');
      return res.render('complete-profile', {
        user: req.user,
        error: 'User ID is missing. Please log in again.'
      });
    }

    const userSnapshot = await userRef.where('username', '==', username).get();

    if (!userSnapshot.empty && userSnapshot.docs[0].id !== req.user.id) {
      return res.render('complete-profile', { 
        user: req.user, 
        error: 'Username already taken' 
      });
    }

    const userDocRef = userRef.doc(req.user.id);
    const userDoc = await userDocRef.get();

    if (!userDoc.exists) {
      return res.render('complete-profile', { 
        user: req.user, 
        error: 'User not found' 
      });
    }

    // Update username, displayName and remove isNewUser flag
    await userDocRef.update({
      username,
      displayName: displayName || username,
      isNewUser: false
    });

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

// Trending Route
app.get('/trending', async (req, res) => {
  try {
    // Get message and error from query params
    const { msg, error } = req.query;
    
    // Get all outfits for trending page
    const outfitsSnapshot = await firebaseAdmin.firestore().collection('outfits').orderBy('fireVotes', 'desc').limit(10).get();
    const outfits = outfitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${outfits.length} outfits for trending page`);
    
    // Get current user's Firestore ID if logged in
    let userId = null;
    if (req.session.user || req.isAuthenticated()) {
      const user = req.session.user || req.user;
      
      try {
        const userQuery = await firebaseAdmin.firestore().collection('users').where('email', '==', user.email).get();
        if (!userQuery.empty) {
          userId = userQuery.docs[0].id;
        }
      } catch (err) {
        console.error('Error getting user ID for trending page:', err);
      }
    }

    res.render('trending', { 
      outfits, 
      user: req.session.user || req.user, 
      userId,
      msg,
      error,
      currentPath: '/trending'
    });
  } catch (error) {
    console.error('Error fetching trending outfits:', error);
    res.status(500).send('Error fetching trending outfits');
  }
});

// Vote route
app.post('/vote', checkAuth, async (req, res) => {
  try {
    const { outfitId, voteType } = req.body;
    const user = req.session.user || req.user;
    
    // Validate required fields
    if (!outfitId || !voteType || !user) {
      return res.redirect('/trending?error=Invalid+vote+data');
    }
    
    // Get the outfit document
    const outfitRef = firebaseAdmin.firestore().collection('outfits').doc(outfitId);
    const outfitDoc = await outfitRef.get();
    
    if (!outfitDoc.exists) {
      return res.redirect('/trending?error=Outfit+not+found');
    }
    
    if (voteType === 'fire') {
      await outfitRef.update({
        fireVotes: firebaseAdmin.firestore.FieldValue.increment(1)
      });
    } else if (voteType === 'nope') {
      await outfitRef.update({
        nopeVotes: firebaseAdmin.firestore.FieldValue.increment(1)
      });
    }
    
    res.redirect('/trending?msg=Vote+recorded!');
  } catch (error) {
    console.error('Vote error:', error);
    res.redirect('/trending?error=Failed+to+record+vote');
  }
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));