/**
 * Configuration validation for Rate My Fit application
 * This ensures all required environment variables are present and valid
 */

// Load environment variables
require('dotenv').config();

// Define required environment variables
const requiredEnvVars = [
  'SESSION_SECRET',
  // FIREBASE_DATABASE_URL is not required when using service account JSON
  // Add other required variables here
];

// Validate environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: Environment variable ${envVar} is required but not set.`);
    console.error('Please check your .env file or environment configuration.');
    process.exit(1);
  }
}

// Define defaults for optional variables
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Validate session secret in production
if (NODE_ENV === 'production' && 
    (process.env.SESSION_SECRET === 'a3f8c9e7d6b5a4f3c2e1d0f9b8a7c6d5e4f3a2b1c0d9e8' || 
     process.env.SESSION_SECRET.length < 32)) {
  console.warn('Warning: Using default or short SESSION_SECRET in production is not secure.');
  console.warn('Please set a strong unique SESSION_SECRET for production environments.');
}

// Export validated config
module.exports = {
  PORT,
  NODE_ENV,
  SESSION_SECRET: process.env.SESSION_SECRET,
  FIREBASE_DATABASE_URL: process.env.FIREBASE_DATABASE_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  IS_PRODUCTION: NODE_ENV === 'production',
  
  // Email config (optional)
  EMAIL: {
    HOST: process.env.EMAIL_HOST,
    PORT: process.env.EMAIL_PORT,
    USER: process.env.EMAIL_USER,
    PASSWORD: process.env.EMAIL_PASSWORD,
    FROM: process.env.EMAIL_FROM
  }
};
