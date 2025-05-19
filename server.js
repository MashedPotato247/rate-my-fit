const config = require('./config');
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
const logger = require('./utils/logger');
const { ensureUserAvatar } = require('./utils/user-photo-helpers');

const helmet = require('helmet');
const csrf = require('csurf');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = config.PORT;

try {
  const serviceAccount = require('./rate-my-fit-bf625-firebase-adminsdk-fbsvc-393c53b96f.json');
  
  firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
    databaseURL: config.FIREBASE_DATABASE_URL || undefined
  });
  logger.info('Firebase Admin SDK initialized successfully');
} catch (error) {
  logger.error('Error initializing Firebase Admin SDK:', error);
}

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

const sessionConfig = {
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: config.IS_PRODUCTION,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  }
};

if (config.IS_PRODUCTION) {
  app.set('trust proxy', 1);
}

app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

const csrfProtection = csrf({ cookie: false });

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later'
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts from this IP, please try again after an hour'
});

app.use('/api/', apiLimiter);
app.use('/auth/', authLimiter);
app.use('/login', authLimiter);

app.use((req, res, next) => {
  res.locals.user = req.session.user || req.user || null;
  res.locals.currentPath = req.path;
  
  if (process.env.NODE_ENV !== 'production') {
    logger.debug(`${req.method} ${req.path}`);
  }
  
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
      userData.id = userDoc.id;
      done(null, userData);
    } else {
      done(new Error('User not found'), null);
    }
  } catch (err) {
    done(err, null);
  }
});

passport.use(new GoogleStrategy({
    clientID: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback',
    scope: ['profile', 'email']
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      logger.info('Google auth profile received with ID: ' + profile.id);
      logger.info('Google profile photos:', profile.photos ? JSON.stringify(profile.photos) : 'No photos');
      
      const userRef = firebaseAdmin.firestore().collection('users');
      let userSnapshot = await userRef.where('googleId', '==', profile.id).get();

      let user;
      let profilePhotoUrl = null;
      
      if (profile.photos && profile.photos.length > 0) {
        profilePhotoUrl = profile.photos[0].value;
        
        if (profilePhotoUrl.includes('=s')) {
          profilePhotoUrl = profilePhotoUrl.replace(/=s\d+(-c)?/, '=s400-c');
        }
        
        logger.info(`Using Google profile photo: ${profilePhotoUrl}`);
      } else {
        logger.warn(`No profile photo available for Google user: ${profile.id}`);
        profilePhotoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName || 'G')}&background=FF4D4D&color=fff&size=200`;
      }
      
      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        user = userDoc.data();
        
        if (profilePhotoUrl) {
          logger.info(`Updating photo for user ${profile.id} with URL: ${profilePhotoUrl}`);
          await userRef.doc(userDoc.id).update({
            photoURL: profilePhotoUrl,
            avatar: profilePhotoUrl
          });
          user.photoURL = profilePhotoUrl;
          user.avatar = profilePhotoUrl;
        }
      } else {
        userSnapshot = await userRef.where('email', '==', profile.emails[0].value).get();
        if (!userSnapshot.empty) {
          const userDoc = userSnapshot.docs[0];
          user = userDoc.data();
          await userRef.doc(userDoc.id).update({
            googleId: profile.id,
            photoURL: profilePhotoUrl || user.photoURL,
            avatar: profilePhotoUrl || user.avatar
          });
          user.googleId = profile.id;
          user.photoURL = profilePhotoUrl || user.photoURL;
          user.avatar = profilePhotoUrl || user.avatar;
        } else {
          const baseUsername = profile.emails[0].value.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
          const username = baseUsername + Math.floor(1000 + Math.random() * 9000);
          
          user = {
            googleId: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            displayName: profile.displayName,
            username: username,
            avatar: profilePhotoUrl,
            photoURL: profilePhotoUrl,
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
    clientID: config.GITHUB_CLIENT_ID,
    clientSecret: config.GITHUB_CLIENT_SECRET,
    callbackURL: '/auth/github/callback'
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
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
            email: email,
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

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function checkAuth(req, res, next) {
  if (!req.session.user && !req.isAuthenticated()) {
    return res.redirect('/login');
  }
  
  if (req.isAuthenticated() && !req.session.user) {
    req.session.user = req.user;
  }
  
  let currentUser = req.session.user || req.user;
  if (currentUser && currentUser.isNewUser) {
    return res.redirect('/complete-profile');
  }
  
  next();
}

app.get('/', function(req, res) {
  res.redirect('/dashboard');
});

app.get('/login', function(req, res) {
  var message = req.query.message;
  var error = req.query.error;
  res.render('login', { message, error });
});

app.get('/update-my-avatar', checkAuth, async (req, res) => {
  const avatarUrl = req.query.url;
  const user = req.session.user || req.user;
  
  if (!user || !user.email) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  
  if (!avatarUrl) {
    return res.status(400).json({ error: 'No URL provided' });
  }
  
  try {
    const userRef = firebaseAdmin.firestore().collection('users');
    const userQuery = await userRef.where('email', '==', user.email).get();
    
    if (userQuery.empty) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userDoc = userQuery.docs[0];
    await userRef.doc(userDoc.id).update({
      photoURL: avatarUrl,
      avatar: avatarUrl
    });
    
    user.photoURL = avatarUrl;
    user.avatar = avatarUrl;
    
    if (req.session.user) {
      req.session.user = user;
    }
    
    return res.redirect('/dashboard?msg=Avatar+updated+successfully');
  } catch (error) {
    logger.error('Error updating avatar:', error);
    return res.redirect('/dashboard?error=Error+updating+avatar');
  }
});

app.get('/dashboard', csrfProtection, checkAuth, async (req, res) => {
  const userId = req.session?.user?.uid || "guest";
  const user = req.session.user || req.user;
  
  try {
    logger.debug('Dashboard - User:', user ? user.email : 'User not available');
    if (user) {
      logger.debug('User photo data - photoURL:', user.photoURL);
      logger.debug('User photo data - avatar:', user.avatar);
      
      const userCopy = {...user};
      if (userCopy.photoURL) {
        logger.debug('User has photoURL field set to:', userCopy.photoURL);
      }
      if (userCopy.avatar) {
        logger.debug('User has avatar field set to:', userCopy.avatar);
      }
      if (!userCopy.photoURL && !userCopy.avatar) {
        logger.warn('User has no profile picture URLs set');
      }
    }
    
    if (!user || !user.email) {
      logger.error('Dashboard - No valid user email available');
      return res.render('dashboard', {
        user, 
        uploads: [],
        totalUploads: 0,
        totalFireVotes: 0,
        profileViews: 0,
        error: 'Invalid user session. Please log in again.',
        csrfToken: req.csrfToken()
      });
    }
    
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
        error: 'Could not find your account. Please try logging in again.',
        csrfToken: req.csrfToken()
      });
    }
    
    const userId = userQuery.docs[0].id;
    console.log('Found user ID for dashboard:', userId);
    
    const userData = userQuery.docs[0].data();
    
    if (userData.photoURL || userData.avatar) {
      user.photoURL = userData.photoURL || userData.avatar;
      user.avatar = userData.avatar || userData.photoURL;
      req.session.user = {
        ...req.session.user, 
        photoURL: userData.photoURL || userData.avatar,
        avatar: userData.avatar || userData.photoURL
      };
    }
    
    console.log('Querying uploads for user ID:', userId);
    
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
      
      logger.debug('Upload query returned:', uploadsQuery.size, 'documents');
      
      const uploads = uploadsQuery.docs.map(doc => {
        const data = doc.data();
        logger.debug('Outfit data:', { id: doc.id, userId: data.userId, imageUrl: data.imageUrl });
        return {
          id: doc.id,
          ...data
        };
      });
      
      const totalFireVotes = uploads.reduce((total, outfit) => total + (outfit.fireVotes || 0), 0);
    
      const msg = req.query.msg || null;
      
      res.render('dashboard', { 
        user,
        uploads,
        totalUploads: uploads.length,
        totalFireVotes,
        profileViews: 0,
        msg,
        csrfToken: req.csrfToken()
      });
    } catch (error) {
      logger.error('Error in inner try block:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    logger.error('Error details:', error.message);
    logger.error('Error stack:', error.stack);
    
    if (!userId && user && user.email) {
      try {
        logger.debug('Trying to recover userId in catch block for:', user.email);
        const userQueryInCatch = await firebaseAdmin.firestore().collection('users').where('email', '==', user.email).get();
        if (!userQueryInCatch.empty) {
          userId = userQueryInCatch.docs[0].id;
          logger.debug('Recovered userId in catch block:', userId);
        }
      } catch (err) {
        logger.error('Failed to recover userId in catch block:', err);
      }
    }
    
    if (!userId) {
      return res.render('dashboard', { 
        user, 
        uploads: [],
        totalUploads: 0,
        totalFireVotes: 0,
        profileViews: 0,
        error: 'Could not identify your user account',
        csrfToken: req.csrfToken()
      });
    }
    
    try {
      const simpleQuery = await firebaseAdmin.firestore()
        .collection('outfits')
        .where('userId', '==', userId)
        .get();
      
      logger.debug('Simple query returned:', simpleQuery.size, 'documents');
      
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
          msg: 'Some data loaded with limited functionality',
          csrfToken: req.csrfToken()
        });
      }
    } catch (fallbackError) {
      logger.error('Fallback query also failed:', fallbackError);
    }
    
    res.render('dashboard', { 
      user, 
      uploads: [],
      totalUploads: 0,
      totalFireVotes: 0,
      profileViews: 0,
      error: 'Could not load dashboard data',
      csrfToken: req.csrfToken()
    });
  }
});

app.get('/profile', csrfProtection, checkAuth, async (req, res) => {
  const sessionUser = req.session.user || req.user;
  
  try {
    const userCollection = firebaseAdmin.firestore().collection('users');
    const userQuery = await userCollection.where('email', '==', sessionUser.email).get();
    
    if (userQuery.empty) {
      return res.render('profile', { 
        user: sessionUser,
        error: 'User not found in database',
        csrfToken: req.csrfToken()
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
    
    res.render('profile', { user, csrfToken: req.csrfToken() });
  } catch (error) {
    logger.error('Error fetching profile:', error);
    res.render('profile', { 
      user: sessionUser,
      error: 'Could not load profile data. Please try again.',
      csrfToken: req.csrfToken()
    });
  }
});

app.post('/profile', csrfProtection, checkAuth, [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .isAlphanumeric('en-US', { ignore: '_' })
    .withMessage('Username can only contain letters, numbers, and underscores')
    .escape(),
  body('displayName')
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Display name is required')
    .escape(),
  body('bio')
    .trim()
    .optional()
    .isLength({ max: 500 })
    .withMessage('Bio must be less than 500 characters')
    .escape()
], async (req, res) => {
  const { displayName, bio, username } = req.body;
  const user = req.session.user || req.user;
  
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('profile', { 
      user: user,
      error: errors.array()[0].msg,
      csrfToken: req.csrfToken()
    });
  }
  
  try {
    if (!user || !user.email) {
      return res.render('profile', { 
        user: user,
        error: 'Invalid user session. Please log in again.',
        csrfToken: req.csrfToken()
      });
    }
    
    const userCollection = firebaseAdmin.firestore().collection('users');
    const userQuery = await userCollection.where('email', '==', user.email).get();
    
    if (userQuery.empty) {
      return res.render('profile', { 
        user: user,
        error: 'User not found',
        csrfToken: req.csrfToken()
      });
    }
    
    const userDoc = userQuery.docs[0];
    const userId = userDoc.id;
    
    if (!userId) {
      return res.render('profile', {
        user: user,
        error: 'Invalid user document. Please try logging in again.',
        csrfToken: req.csrfToken()
      });
    }
    
    const userRef = userCollection.doc(userId);
    
    if (username && username !== user.username) {
      const usernameQuery = await userCollection.where('username', '==', username).get();
      if (!usernameQuery.empty && usernameQuery.docs[0].id !== userId) {
        return res.render('profile', {
          user: user,
          error: 'Username already taken',
          csrfToken: req.csrfToken()
        });
      }
    }
    
    const updateData = { displayName, bio };
    if (username) updateData.username = username;
    
    await userRef.update(updateData);
    
    if (req.session.user) {
      req.session.user.displayName = displayName;
      req.session.user.bio = bio;
      if (username) req.session.user.username = username;
    }
    
    const updatedUserDoc = await userRef.get();
    const updatedUser = { id: userId, ...updatedUserDoc.data() };
    
    res.render('profile', { 
      user: updatedUser,
      message: 'Profile updated successfully!',
      csrfToken: req.csrfToken()
    });
    
  } catch (error) {
    console.error('Profile update error:', error);
    res.render('profile', { 
      user: req.session.user,
      error: 'Something went wrong. Please try again.',
      csrfToken: req.csrfToken()
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
app.post('/upload', csrfProtection, checkAuth, upload, async (req, res) => {
  if (!req.file) {
    return res.render('index', { msg: 'No file uploaded!', file: null });
  }
  
  try {
    var user = req.session.user || req.user;
    
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
    
    res.redirect('/dashboard?msg=File+uploaded+successfully!');
  } catch (error) {
    console.error('Upload error:', error);
    res.render('index', { 
      msg: 'Error saving your upload. Please try again.', 
      file: null 
    });
  }
});

app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login?error=Google+authentication+failed' }),
  async function(req, res) {
    if (req.user.isNewUser) {
      return res.redirect('/complete-profile');
    }
    
    try {
      const userRef = firebaseAdmin.firestore().collection('users');
      
      let userSnapshot = await userRef.where('googleId', '==', req.user.googleId).get();
      
      if (userSnapshot.empty && req.user.email) {
        userSnapshot = await userRef.where('email', '==', req.user.email).get();
      }
      
      if (!userSnapshot.empty) {
        const userDoc = userSnapshot.docs[0];
        const userData = userDoc.data();
        
        const sessionUser = {
          ...req.user,
          ...userData,
          photoURL: userData.photoURL || userData.avatar || req.user.photoURL || req.user.avatar,
          avatar: userData.avatar || userData.photoURL || req.user.avatar || req.user.photoURL,
        };
        
        console.log('Storing user in session with photo data:', {
          id: userDoc.id,
          photoURL: sessionUser.photoURL,
          avatar: sessionUser.avatar
        });
        
        req.session.user = sessionUser;
      } else {
        console.error('User not found in Firestore during Google callback');
        req.session.user = {
          ...req.user,
          photoURL: req.user.photoURL || req.user.avatar,
          avatar: req.user.avatar || req.user.photoURL
        };
      }
      
      res.redirect('/dashboard');
    } catch (error) {
      console.error('Error in Google auth callback:', error);
      
      req.session.user = {
        ...req.user,
        photoURL: req.user.photoURL || req.user.avatar,
        avatar: req.user.avatar || req.user.photoURL
      };
      
      res.redirect('/dashboard');
    }
  }
);

app.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login?error=GitHub+authentication+failed' }),
  function(req, res) {
    if (req.user.isNewUser) {
      return res.redirect('/complete-profile');
    }
    
    const sessionUser = {
      ...req.user,
      photoURL: req.user.photoURL || req.user.avatar,
      avatar: req.user.avatar || req.user.photoURL
    };
    
    req.session.user = sessionUser;
    res.redirect('/dashboard');
  }
);

app.get('/complete-profile', csrfProtection, (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }
  res.render('complete-profile', { user: req.user });
});

app.post('/complete-profile', csrfProtection, [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 })
    .withMessage('Username must be between 3 and 20 characters')
    .isAlphanumeric('en-US', { ignore: '_' })
    .withMessage('Username can only contain letters, numbers, and underscores')
    .escape(),
  body('displayName')
    .trim()
    .isLength({ min: 1, max: 30 })
    .withMessage('Display name is required')
    .escape()
], async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.redirect('/login');
  }

  const { username, displayName } = req.body;

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('complete-profile', { 
      user: req.user, 
      error: errors.array()[0].msg,
      csrfToken: req.csrfToken()
    });
  }

  try {
    const userRef = firebaseAdmin.firestore().collection('users');

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

    await userDocRef.update({
      username,
      displayName: displayName || username,
      isNewUser: false
    });

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

app.get('/trending', csrfProtection, async (req, res) => {
  try {
    const { msg, error } = req.query;
    
    const outfitsSnapshot = await firebaseAdmin.firestore().collection('outfits').orderBy('fireVotes', 'desc').limit(10).get();
    const outfits = outfitsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`Found ${outfits.length} outfits for trending page`);
    
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
      currentPath: '/trending',
      csrfToken: req.csrfToken()
    });
  } catch (error) {
    console.error('Error fetching trending outfits:', error);
    res.status(500).send('Error fetching trending outfits');
  }
});

app.post('/vote', csrfProtection, checkAuth, [
  body('outfitId')
    .trim()
    .notEmpty()
    .withMessage('Outfit ID is required')
    .escape(),
  body('voteType')
    .trim()
    .isIn(['fire', 'nope'])
    .withMessage('Invalid vote type')
    .escape()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.redirect('/trending?error=Invalid+vote+data');
    }
    
    const { outfitId, voteType } = req.body;
    const user = req.session.user || req.user;
    
    if (!outfitId || !voteType || !user) {
      return res.redirect('/trending?error=Invalid+vote+data');
    }
    
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

app.use((req, res, next) => {
  res.status(404).render('404');
});

app.use((err, req, res, next) => {
  console.error('Global error handler caught:', err);
  res.status(500).render('500');
});