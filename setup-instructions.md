# Setup Instructions for Rate My Fit App

## OAuth Configuration

### Google OAuth 

1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create a project or select your existing project
3. Navigate to "APIs & Services" > "Credentials"
4. Create an OAuth 2.0 Client ID
5. Set up the consent screen if prompted
6. Add authorized JavaScript origins: `http://localhost:3000`
7. Add authorized redirect URIs: `http://localhost:3000/auth/google/callback`
8. Copy the Client ID and Client Secret
9. Update the `.env` file:
```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Microsoft OAuth

1. Go to Microsoft Azure Portal: https://portal.azure.com/
2. Navigate to "Azure Active Directory" > "App registrations"
3. Register a new application
4. Set redirect URI: `http://localhost:3000/auth/microsoft/callback`
5. Copy the Application (client) ID and create a client secret
6. Update the `.env` file:
```
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret
```

## Session Secret

For better security, update the session secret in your .env file:
```
SESSION_SECRET=your-random-secret-key
```

You can generate a random string for this purpose using this command in your terminal:
```
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Firebase Configuration (Optional)

If you want to still use Firebase for storing data, update the `.env` file with your Firebase credentials. You'll need a Firebase Admin SDK service account JSON file.

## Development Setup

1. Install dependencies:
```
npm install
```

2. Run the app in development mode:
```
npm run dev
```

3. For production:
```
npm start
```

The app will be available at http://localhost:3000

## Project Structure

- `/views`: EJS templates for the front-end
- `/public`: Static assets like CSS, JS, and uploads
- `/data`: Local JSON database storage
- `server.js`: Main application file

## How Authentication Works

The app supports both traditional username/password login and social login (Google, Microsoft).

- Traditional login uses bcrypt for password hashing and stores user data in a JSON file
- Social login uses Passport.js and the respective strategies to authenticate users
- New social login users will be redirected to complete their profile by choosing a username
