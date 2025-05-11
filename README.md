# Rate My Fit

A web application where users can upload and rate outfits.

## Features

- User authentication with both traditional username/password and social login (Google, Microsoft)
- Profile management
- Image uploading
- Rating system for outfits

## Authentication System

The application uses a hybrid authentication system:

### Traditional Authentication
- Username/password login with bcrypt password hashing
- Session-based authentication
- Data stored in local JSON database

### Social Authentication
- Google OAuth using Passport.js
- Microsoft OAuth using Passport.js
- New social users directed to complete their profile

## Project Structure

```
rate-my-fit/
├── data/                  # JSON database files
│   └── users.json         # User data
├── public/                # Static assets
│   ├── css/               # Stylesheets
│   ├── images/            # Images
│   ├── js/                # Client-side JavaScript
│   └── uploads/           # User uploaded images
├── views/                 # EJS templates
│   ├── complete-profile.ejs  # Profile completion page
│   ├── dashboard.ejs      # User dashboard
│   ├── index.ejs          # Landing page
│   ├── login.ejs          # Login page
│   ├── profile.ejs        # Profile management
│   └── register.ejs       # Registration page
├── .env                   # Environment variables
├── server.js              # Main application file
├── setup-instructions.md  # OAuth setup guide
├── test-auth.js           # Authentication test guide
└── package.json           # Dependencies
```

## Authentication Flow

1. **Traditional Login**:
   - User enters username and password
   - Server validates credentials and creates session
   - User is redirected to dashboard

2. **Social Login**:
   - User clicks on social login button (Google or Microsoft)
   - User is redirected to OAuth provider login
   - After successful OAuth, server checks if user exists:
     - If new user: redirected to complete profile page
     - If existing user: redirected to dashboard

3. **Profile Completion** (for new social login users):
   - User enters preferred username
   - User can update display name
   - User is redirected to dashboard after completion

## Account Linking

If a user logs in with social auth using an email that already exists in the system:
- The accounts are linked automatically
- User can login with either method

## Setup Instructions

See [setup-instructions.md](setup-instructions.md) for details on how to configure the application, especially OAuth credentials.

## Development

1. Install dependencies:
```
npm install
```

2. Set up environment variables (see setup instructions)

3. Run the development server:
```
npm run dev
```

4. For testing authentication flows:
```
node test-auth.js
```

## License

MIT

---

Created by MashedPotato247

"Let's make it to America! 🇺🇸"
