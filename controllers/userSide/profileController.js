import * as profileService from '../../services/userSide/profileService.js';
import logger from '../../utils/logger.js';

export const upsertProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const {
      name,
      department,
      newPassword,
      phone,
      designation,
      contacts // <- contacts comes as JSON string from FormData
    } = req.body;

    const photo = req.file?.filename || null;

    // ✅ Only name is required (department may already be set from Excel import)
    if (!name) {
      return res.status(400).json({ message: 'Name is required.' });
    }

    const updatedProfile = await profileService.upsertUserProfile(userId, role, {
      name,
      department, // can be undefined or empty
      photo,
      newPassword,
      phone,
      designation,
      contacts: contacts ? JSON.parse(contacts) : []
    });

    res.status(200).json({ message: 'Profile updated successfully', profile: updatedProfile });
  } catch (error) {
    logger.error('Profile update failed', { error: error.message });
    res.status(500).json({ message: 'Server error during profile update' });
  }
};

export const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const profile = await profileService.getUserProfile(userId, role);

    if (!profile) return res.status(404).json({ message: 'Profile not found' });

    // ✅ Parse contacts if it's a string
    if (profile.contacts && typeof profile.contacts === 'string') {
      try {
        profile.contacts = JSON.parse(profile.contacts);
      } catch (e) {
        profile.contacts = [];
      }
    }

    // ✅ Add full image URL
    if (profile.photo) {
      profile.photoUrl = `http://localhost:4000/uploads/profile_photos/${profile.photo}`;
    }

    res.status(200).json(profile);
  } catch (error) {
    logger.error('Profile fetch failed', { error: error.message });
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};
