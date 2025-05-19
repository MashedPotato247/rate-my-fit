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

    // Update the user in the session
    user.photoURL = avatarUrl;
    user.avatar = avatarUrl;

    if (req.session.user) {
      req.session.user = user;
    }

    return res.json({ success: true, message: 'Avatar updated successfully' });
  } catch (error) {
    logger.error('Error updating avatar:', error);
    return res.status(500).json({ error: 'Error updating avatar' });
  }
});
