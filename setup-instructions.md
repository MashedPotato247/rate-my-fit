# Setup Instructions for Rate My Fit App

## Email Configuration

To enable email functionality, update the `.env` file with your Gmail credentials:

1. Use your Gmail account or create a new one for your app
2. If you have 2FA enabled on your Google account (recommended), you'll need to generate an "App Password"
   - Go to https://myaccount.google.com/security
   - Under "Signing in to Google", select "App passwords" 
   - Generate a new app password for "Mail" and "Other (Custom name)"
   - Use this generated password in the EMAIL_PASS field below

3. Update the .env file with your credentials:
```
EMAIL_USER=your.gmail.account@gmail.com
EMAIL_PASS=your-app-password-from-google
```

## Firebase Configuration

To enable Firebase Authentication, update the `.env` file with your Firebase API key:

1. Go to your Firebase Console: https://console.firebase.google.com/project/rate-my-fit-bf625/settings/general/
2. Under "Your apps", find the Web app configuration 
3. Look for "apiKey" value in the Firebase config object
4. Update the .env file with this key:
```
FIREBASE_API_KEY=your-firebase-api-key-here
```

## Running the App

Once you've set up the .env file, run the app with:
```
node server.js
```

The app will be available at http://localhost:3000
