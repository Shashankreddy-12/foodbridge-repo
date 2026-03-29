import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { getHourlyForecast, getPeakHours } from '../services/surplusPredictor.js';
import FoodListing from '../models/FoodListing.js';
import { ImpactStats } from '../models/ImpactStats.js';

const router = express.Router();

// GET /surplus-prediction (protected with auth middleware)
router.get('/surplus-prediction', verifyToken, async (req, res) => {
    try {
        const forecast = await getHourlyForecast();
        const top3 = await getPeakHours();
        const peakHours = top3.map(t => t.label);
        
        return res.json({ forecast, peakHours });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// GET /impact-summary (no auth — public)
router.get('/impact-summary', async (req, res) => {
    try {
        // Aggregate FoodListing to count documents by status
        const counts = await FoodListing.aggregate([
            {
                $group: {
                    _id: "$status",
                    count: { $sum: 1 }
                }
            }
        ]);

        let delivered = 0;
        let claimed = 0;
        let available = 0;
        let expired = 0;
        
        let totalListings = 0;

        counts.forEach(item => {
            if (item._id === 'delivered') delivered = item.count;
            if (item._id === 'claimed') claimed = item.count;
            if (item._id === 'available') available = item.count;
            if (item._id === 'expired') expired = item.count;
            totalListings += item.count;
        });

        // Also fetch the single ImpactStats document
        const impactStats = await ImpactStats.findOne({}) || null;

        return res.json({
            delivered,
            claimed,
            available,
            expired,
            totalListings,
            impactStats
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

export default router;
