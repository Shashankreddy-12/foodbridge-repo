import { Router } from 'express';
import FoodListing from '../models/FoodListing.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.js';
import { runSafetyScore, runMatching } from '../services/mlClient.js';

const router = Router();

// POST /api/listings
router.post('/', verifyToken, async (req, res) => {
  try {
    // Validate required fields (from Phase 2 fix)
    if (!req.body.address || !req.body.condition) {
      return res.status(400).json({ error: 'Address and condition are required' });
    }

    const listing = await FoodListing.create({
      ...req.body,
      donor: req.user.id,
      location: { type: 'Point', coordinates: [req.body.lng, req.body.lat] }
    });

    // Update donor role
    await User.findByIdAndUpdate(req.user.id, { role: 'donor' });

    // Run AI tasks async — never block the response
    (async () => {
      try {
        // Step 1: Safety score
        const safetyResult = await runSafetyScore(listing);
        if (safetyResult.score !== null) {
          await FoodListing.findByIdAndUpdate(listing._id, {
            safetyScore: safetyResult.score
          });
        }

        const io = req.app.get('io');
        
        // Step 2: Find nearby recipients for matching
        const nearbyRecipients = await User.find({
          role: 'recipient',
          location: {
            $near: {
              $geometry: listing.location,
              $maxDistance: 10000
            }
          }
        });

        // Step 3: Run matching engine
        if (nearbyRecipients.length > 0) {
          const matchResult = await runMatching(listing, nearbyRecipients);

          // Notify top matched recipients first with higher priority
          const topMatchIds = new Set(
            (matchResult.matches || []).slice(0, 5).map(m => m.recipientId)
          );

          nearbyRecipients.forEach(r => {
            const isTopMatch = topMatchIds.has(r._id.toString());
            io.to(`user_${r._id}`).emit('new_listing', {
              listing: { ...listing.toObject(), safetyScore: safetyResult.score },
              isTopMatch,
            });
            // Emit safety update strictly so Feed catches it instantly
            io.to(`user_${r._id}`).emit('listing_updated', {
              listingId: listing._id,
              safetyScore: safetyResult.score,
            });
          });
        }
      } catch (aiErr) {
        console.error('[AI Background] Error:', aiErr.message);
      }
    })();

    // Return immediately — don't wait for AI
    res.status(201).json(listing);

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/listings
router.get('/', async (req, res) => {
    try {
        const { lat, lng, radius } = req.query;

        if (!lat || !lng) {
            return res.status(400).json({ error: 'Latitude and Longitude are required' });
        }

        const maxDistance = radius ? parseInt(radius) : 10000;

        const listings = await FoodListing.find({
            status: 'available',
            location: {
                $near: {
                    $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
                    $maxDistance: maxDistance
                }
            }
        })
        .sort({ expiresAt: 1 })
        .populate('donor', 'name orgName');

        res.json(listings);
    } catch (err) {
        console.error('Listings GET Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// GET /api/listings/my
router.get('/my', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [donated, claimed, volunteer] = await Promise.all([
      FoodListing.find({ donor: userId })
        .populate('donor', 'name orgName')
        .sort({ createdAt: -1 }),
      FoodListing.find({ claimedBy: userId })
        .populate('donor', 'name orgName')
        .sort({ createdAt: -1 }),
      FoodListing.find({ volunteer: userId })
        .populate('donor', 'name orgName')
        .sort({ createdAt: -1 }),
    ]);
    return res.json({ donated, claimed, volunteer });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/listings/safety-check
router.post('/safety-check', verifyToken, async (req, res) => {
  try {
    const { description, condition, foodType } = req.body;
    // We mock a listing object for the local mlClient logic
    const mockListing = {
      description,
      condition,
      foodType,
    };
    const result = await runSafetyScore(mockListing);
    // ensure fallback never crashes 
    return res.json(result);
  } catch (err) {
    console.error('Safety Check API error:', err.message);
    const badge = { color: 'amber', label: 'Use caution', icon: 'warning', blocked: false, reason: 'AI Check unavailable' };
    return res.json({ score: null, verdict: 'Caution', badge });
  }
});

// GET /api/listings/:id
router.get('/:id', async (req, res) => {
    try {
        const listing = await FoodListing.findById(req.params.id)
            .populate('donor', 'name orgName rating');
        
        if (!listing) return res.status(404).json({ error: 'Listing not found' });
        res.json(listing);
    } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// POST /api/listings/:id/claim
router.post('/:id/claim', verifyToken, async (req, res) => {
    try {
        const listing = await FoodListing.findOneAndUpdate(
            { _id: req.params.id, status: 'available' },
            { status: 'claimed', claimedBy: req.user.id },
            { new: true }
        ).populate('donor', 'name');

        if (!listing) return res.status(409).json({ error: 'Already claimed or unavailable' });

        await User.findByIdAndUpdate(req.user.id, { role: 'recipient' });

        const io = req.app.get('io');
        if (io) {
            io.to(`user_${listing.donor._id}`).emit('listing_claimed', { listingId: listing._id, claimedBy: req.user.id });

            const volunteers = await User.find({ 
                role: 'volunteer', 
                location: { $near: { $geometry: listing.location, $maxDistance: 5000 } } 
            }).limit(5);

            volunteers.forEach(v => {
                io.to(`user_${v._id}`).emit('pickup_request', { listing });
            });
        }

        res.json(listing);
    } catch (err) {
        console.error('Claim POST Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// DELETE /api/listings/:id/claim
router.delete('/:id/claim', verifyToken, async (req, res) => {
    try {
        const listing = await FoodListing.findOneAndUpdate(
            { _id: req.params.id, status: 'claimed', claimedBy: req.user.id },
            { status: 'available', claimedBy: null },
            { new: true }
        );
        if (!listing) return res.status(403).json({ error: 'Not your claim or listing not claimed' });

        const io = req.app.get('io');
        if (io) {
            // listing.donor might not be populated here, but it's an ObjectId reference
            io.to(`user_${listing.donor}`).emit('listing_unclaimed', { listingId: listing._id });
        }

        res.json(listing);
    } catch (err) {
        console.error('Claim DELETE Error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
