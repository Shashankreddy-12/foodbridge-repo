import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import Review from '../models/Review.js';
import FoodListing from '../models/FoodListing.js';
import User from '../models/User.js';

const router = express.Router();

// POST /api/deliveries/:id/rate (auth required)
router.post('/:id/rate', verifyToken, async (req, res) => {
    try {
        const { rating, comment, ratedUserId } = req.body;
        const deliveryId = req.params.id;
        const reviewerId = req.user.id;

        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }
        if (!ratedUserId) {
            return res.status(400).json({ error: 'Rated user ID is required' });
        }

        // Check if listing exists and is delivered
        const listing = await FoodListing.findById(deliveryId);
        if (!listing) {
            return res.status(404).json({ error: 'Delivery not found' });
        }
        if (listing.status !== 'delivered') {
            return res.status(400).json({ error: 'Cannot rate a delivery that is not yet completed' });
        }

        // Check for duplicates
        const existingReview = await Review.findOne({ reviewer: reviewerId, delivery: deliveryId });
        if (existingReview) {
            return res.status(409).json({ error: 'You have already rated this delivery' });
        }

        // Determine reviewer's role in this context
        let role = null;
        if (listing.donor.toString() === reviewerId) role = 'donor';
        else if (listing.claimedBy?.toString() === reviewerId) role = 'recipient';
        else if (listing.volunteer?.toString() === reviewerId) role = 'volunteer';

        // Create the review
        const newReview = new Review({
            reviewer: reviewerId,
            reviewee: ratedUserId,
            delivery: deliveryId,
            rating,
            comment,
            role
        });
        await newReview.save();

        // Recalculate average rating for the reviewee
        const reviews = await Review.find({ reviewee: ratedUserId });
        const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
        
        await User.findByIdAndUpdate(ratedUserId, { 
            rating: parseFloat(avg.toFixed(1)) 
        });

        return res.json({ message: 'Rating submitted', newAvgRating: avg });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'Duplicate review' });
        }
        return res.status(500).json({ error: err.message });
    }
});

// GET /api/deliveries/:id/reviews (no auth required)
router.get('/:id/reviews', async (req, res) => {
    try {
        const reviews = await Review.find({ delivery: req.params.id })
            .populate('reviewer', 'name')
            .sort({ createdAt: -1 });
        return res.json(reviews);
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;
