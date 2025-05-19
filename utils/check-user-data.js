const firebaseAdmin = require('firebase-admin');
const dotenv = require('dotenv');

dotenv.config();

const userEmail = process.argv[2];
if (!userEmail) {
  console.error('Please provide an email address as an argument.');
  process.exit(1);
}

// Initialize Firebase Admin SDK
try {
  if (!firebaseAdmin.apps.length) {
    const serviceAccount = require('../rate-my-fit-bf625-firebase-adminsdk-fbsvc-393c53b96f.json');
    
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount)
    });
  }
  console.log('Firebase Admin SDK initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
  process.exit(1);
}

async function checkUserData() {
  try {
    console.log('Connecting to Firestore...');
    const db = firebaseAdmin.firestore();
    console.log('Connected to Firestore!');
    
    const userRef = db.collection('users');
    console.log(`Searching for user with email: ${userEmail}`);
    
    // Find user by email
    const userQuery = await userRef.where('email', '==', userEmail).get();
    
    if (userQuery.empty) {
      console.log(`No user found with email: ${userEmail}`);
      return;
    }
    
    console.log(`Found ${userQuery.size} matching users`);
    const userDoc = userQuery.docs[0];
    const user = userDoc.data();
    
    console.log('User Data:');
    console.log('-----------------');
    console.log(`ID: ${userDoc.id}`);
    console.log(`Email: ${user.email}`);
    console.log(`Display Name: ${user.displayName || 'Not set'}`);
    console.log(`Username: ${user.username || 'Not set'}`);
    console.log(`Google ID: ${user.googleId || 'Not linked'}`);
    console.log(`Avatar URL: ${user.avatar || 'Not set'}`);
    console.log(`Photo URL: ${user.photoURL || 'Not set'}`);
    console.log('-----------------');
    
    // Check for issue with photo URLs
    if (!user.photoURL && !user.avatar) {
      console.log('ISSUE: This user has no profile picture URLs set.');
      console.log('Try running: node utils/update-my-avatar.js ' + userEmail);
    } else if (!user.photoURL && user.avatar) {
      console.log('ISSUE: This user has avatar but no photoURL.');
      console.log('Try running: node utils/fix-google-avatar.js');
    } else if (user.photoURL && !user.avatar) {
      console.log('ISSUE: This user has photoURL but no avatar.');
      console.log('Try running: node utils/fix-google-avatar.js');
    } else {
      console.log('Profile picture URLs seem to be set correctly.');
    }
  } catch (error) {
    console.error('Error checking user data:', error);
  } finally {
    process.exit(0);
  }
}

// Run the check function
checkUserData();
