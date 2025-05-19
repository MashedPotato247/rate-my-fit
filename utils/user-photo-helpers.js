const axios = require('axios');
const firebaseAdmin = require('firebase-admin');
const logger = require('./logger');

async function updateUserPhotoFromGoogle(googleId, accessToken) {
  try {
    if (!googleId) {
      logger.warn('No googleId provided to updateUserPhotoFromGoogle');
      return null;
    }

    const response = await axios.get(`https://people.googleapis.com/v1/people/${googleId}?personFields=photos`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const photoUrl = response.data.photos[0]?.url;
    if (photoUrl) {
      logger.info(`Photo URL found: ${photoUrl}`);
      return photoUrl;
    }

    return null;
  } catch (error) {
    logger.error('Error fetching photo from Google:', error);
    return null;
  }
}

function ensureUserAvatar(user) {
  if (user && (user.photoURL || user.avatar)) {
    return user.photoURL || user.avatar;
  }

  let initials = 'U';
  let bgColor = 'FF4D4D';

  if (user) {
    if (user.displayName) {
      initials = user.displayName
        .split(' ')
        .map(name => name.charAt(0))
        .join('')
        .toUpperCase();
    } else if (user.username) {
      initials = user.username.charAt(0).toUpperCase();
    } else if (user.email) {
      initials = user.email.charAt(0).toUpperCase();
    }
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${bgColor}&color=fff&size=200`;
}

module.exports = {
  updateUserPhotoFromGoogle,
  ensureUserAvatar
};
