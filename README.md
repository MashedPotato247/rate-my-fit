# Rate My Fit

A social platform for fashion enthusiasts to upload and rate each other's outfits.

## Features

- User authentication via Google and GitHub OAuth
- Upload outfit images
- Rate outfits with "Fire" or "Nope" votes
- User profiles
- Trending page for top-rated outfits
- Mobile-responsive design

## Tech Stack

- Node.js with Express
- Firebase Admin SDK for data storage
- EJS for server-side templating
- Passport for authentication
- Multer for file uploads
- Express-validator for input validation
- CSRF protection
- Helmet for security headers
- Rate limiting

## Authentication System

The application uses a hybrid authentication system:

### Social Authentication
- Google OAuth using Passport.js
- GitHub OAuth using Passport.js
- New social users directed to complete their profile
- Account linking for users with the same email

## Project Structure

```
rate-my-fit/
├── data/                  # Local data storage (when Firebase is unavailable)
├── logs/                  # Application logs
├── public/                # Static assets
│   ├── css/               # Stylesheets
│   ├── js/                # Client-side JavaScript
│   └── uploads/           # User uploaded images
├── utils/                 # Utility functions
│   └── logger.js          # Logging utility
├── views/                 # EJS templates
│   ├── 404.ejs            # 404 error page
│   ├── 500.ejs            # 500 error page
│   ├── complete-profile.ejs  # Profile completion page
│   ├── dashboard.ejs      # User dashboard
│   ├── index.ejs          # Landing page
│   ├── login.ejs          # Login page
│   ├── profile.ejs        # Profile management
│   └── trending.ejs       # Trending outfits page
├── .env                   # Environment variables
├── config.js              # Configuration validation
├── sample.env             # Sample environment variables
├── server.js              # Main application file
└── package.json           # Dependencies
```

## Authentication Flow

1. **Social Login**:
   - User clicks on social login button (Google or GitHub)
   - User is redirected to OAuth provider login
   - After successful OAuth, server checks if user exists:
     - If new user: redirected to complete profile page
     - If existing user: redirected to dashboard

2. **Profile Completion** (for new social login users):
   - User enters preferred username
   - User can update display name
   - User is redirected to dashboard after completion

## Installation

1. Clone the repository:
   ```
   git clone https://github.com/your-username/rate-my-fit.git
   cd rate-my-fit
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Copy the sample environment file and fill in your values:
   ```
   cp sample.env .env
   ```

4. Set up Firebase:
   - Create a Firebase project
   - Set up Firestore
   - Generate a Firebase Admin SDK service account key
   - Save the key file in your project
   - Set the `GOOGLE_APPLICATION_CREDENTIALS` env var to the path of your key file

5. Set up OAuth providers:
   - Create Google and GitHub OAuth applications
   - Add the client IDs and secrets to your `.env` file

## Running the Application

Development mode:
```
npm run dev
```

Production mode:
```
npm start
```

Visit `http://localhost:3000` in your browser to see the app.

## License

MIT

---

Created by Anush

"Let's make it to America! 🇺🇸"

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
