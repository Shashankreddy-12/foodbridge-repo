import { Router } from 'express';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.js';

const router = Router();

// PUT /api/users/profile (auth required)
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { name, phone, orgName } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (phone && !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, phone, orgName },
      { new: true }
    ).select('-password -resetToken -resetTokenExpiry');
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/users/profile (auth required)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -resetToken -resetTokenExpiry');
    if (!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ user });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
