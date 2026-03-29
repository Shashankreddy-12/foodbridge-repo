import { Router } from 'express';
import FoodListing from '../models/FoodListing.js';
import User from '../models/User.js';
import { verifyToken } from '../middleware/auth.js';
import { optimizeVolunteerRoute } from '../services/routeOptimizer.js';
import { ImpactStats, recordImpact } from '../models/ImpactStats.js';

const router = Router();

// POST /api/volunteer/accept/:listingId
router.post('/accept/:listingId', verifyToken, async (req, res) => {
  try {
    const listingId = req.params.listingId;
    const listing = await FoodListing.findOne({
      _id: listingId,
      status: 'claimed',
      volunteer: null
    }).populate('donor').populate('claimedBy');

    if (!listing) {
      return res.status(409).json({ error: 'Already assigned or not available' });
    }

    listing.volunteer = req.user.id;
    listing.travelMode = req.body.travelMode || '2-wheeler';
    await listing.save();

    await User.findByIdAndUpdate(req.user.id, { role: 'volunteer' });
    
    const volunteerUser = await User.findById(req.user.id);
    const donorUser = listing.donor;
    const recipientUser = listing.claimedBy;

    const io = req.app.get('io');
    let routeResult = null;

    if (volunteerUser.location && volunteerUser.location.coordinates.length === 2 && donorUser.location && recipientUser.location) {
        const volunteerLoc = {
          lat: volunteerUser.location.coordinates[1],
          lng: volunteerUser.location.coordinates[0],
        };

        const stops = [
          {
            id: listing._id.toString(),
            type: 'donor',
            lat: donorUser.location.coordinates[1],
            lng: donorUser.location.coordinates[0],
            label: listing.address,
          },
          {
            id: recipientUser._id.toString(),
            type: 'recipient',
            lat: recipientUser.location.coordinates[1],
            lng: recipientUser.location.coordinates[0],
            label: 'Recipient location',
          },
        ];

        try {
            routeResult = await optimizeVolunteerRoute(
              volunteerLoc, 
              stops, 
              listing.travelMode
            );
        } catch (err) {
            console.error('ORS API error:', err.message);
        }
    }

    if (io) {
        const emitData = {
            listingId: listing._id,
            volunteerName: volunteerUser.name,
            volunteerPhone: volunteerUser.phone,
            distanceKm: routeResult?.distanceKm || null,
            durationMin: routeResult?.durationMin || null,
        };
        io.to(`user_${donorUser._id}`).emit('volunteer_assigned', emitData);
        io.to(`user_${recipientUser._id}`).emit('volunteer_assigned', emitData);
    }

    return res.json({ listing, route: routeResult });
  } catch (err) {
    console.error('Accept Volunteer Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// POST /api/volunteer/complete/:listingId
router.post('/complete/:listingId', verifyToken, async (req, res) => {
  try {
    const listingId = req.params.listingId;
    const listing = await FoodListing.findOne({
      _id: listingId,
      volunteer: req.user.id,
      status: 'claimed'
    });

    if (!listing) {
      return res.status(403).json({ error: 'Not your delivery' });
    }

    listing.status = 'delivered';
    listing.deliveredAt = new Date();
    await listing.save();

    await recordImpact(listing.kgFood);

    const io = req.app.get('io');
    if (io) {
        io.to(`user_${listing.donor}`).emit('delivery_complete', { listingId: listing._id });
        io.to(`user_${listing.claimedBy}`).emit('delivery_complete', { listingId: listing._id });
        
        try {
            const updatedStats = await ImpactStats.findOne({});
            if (updatedStats) {
                 io.emit('impact_updated', {
                   totalMealsSaved:  Math.round(updatedStats.totalMealsSaved  || 0),
                   totalKgFoodSaved: parseFloat((updatedStats.totalKgFoodSaved || 0).toFixed(1)),
                   totalCO2Saved:    parseFloat((updatedStats.totalCO2Saved    || 0).toFixed(1)),
                   totalDeliveries:  Math.round(updatedStats.totalDeliveries   || 0),
                 });
            }
        } catch (err) {
            console.error('Impact IO Error:', err.message);
        }
    }

    return res.json(listing);
  } catch (err) {
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

// GET /api/volunteer/pickups
router.get('/pickups', verifyToken, async (req, res) => {
  try {
    const volunteerUser = await User.findById(req.user.id);
    
    // Build query — find claimed listings with no volunteer assigned
    let query = {
      status: 'claimed',
      volunteer: null,
    };

    // Only add location filter if volunteer has saved coordinates
    if (
      volunteerUser?.location?.coordinates?.length === 2 &&
      volunteerUser.location.coordinates[0] !== 0
    ) {
      query.location = {
        $near: {
          $geometry: volunteerUser.location,
          $maxDistance: 10000,
        },
      };
    }
    // If no location: return ALL claimed listings with no volunteer
    // so volunteer can still see and accept pickups

    const listings = await FoodListing.find(query)
      .populate('donor', 'name phone orgName')
      .populate('claimedBy', 'name phone')
      .sort({ expiresAt: 1 })
      .limit(20);

    return res.json({ listings });
  } catch (err) {
    console.error('GET /pickups error:', err.message);
    // If $near fails (no index), fallback without location filter
    try {
      const listings = await FoodListing.find({
        status: 'claimed',
        volunteer: null,
      })
        .populate('donor', 'name phone orgName')
        .populate('claimedBy', 'name phone')
        .sort({ expiresAt: 1 })
        .limit(20);
      return res.json({ listings });
    } catch (err2) {
      return res.status(500).json({ error: err2.message });
    }
  }
});

// GET /api/volunteer/my-deliveries
router.get('/my-deliveries', verifyToken, async (req, res) => {
  try {
    const listings = await FoodListing.find({ 
      volunteer: req.user.id 
    })
      .populate('donor', 'name phone orgName')
      .populate('claimedBy', 'name phone')
      .sort({ updatedAt: -1 });
    return res.json({ listings });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
