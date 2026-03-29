import { Router } from 'express';
import authRoutes from './auth.js';
import listingsRoutes from './listings.js';
import userRoutes from './users.js';
import volunteerRoutes from './volunteer.js';
import analyticsRoutes from './analytics.js';
import deliveryRoutes from './deliveries.js';
import routeBatchingRoutes from './routeBatching.js';
import { ImpactStats } from '../models/ImpactStats.js';


const router = Router();

router.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        message: 'FoodBridge API running'
    });
});

router.use('/auth', authRoutes);
router.use('/listings', listingsRoutes);
router.use('/users', userRoutes);
router.use('/volunteer', volunteerRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/deliveries', deliveryRoutes);
router.use('/route', routeBatchingRoutes);

router.get('/impact', async (req, res) => {
  try {
    const stats = await ImpactStats.findOne({}) || {
      totalMealsSaved: 0,
      totalKgFoodSaved: 0,
      totalCO2Saved: 0,
      totalDeliveries: 0,
    };
    res.json({
      totalMealsSaved:  Math.round(stats.totalMealsSaved  || 0),
      totalKgFoodSaved: parseFloat((stats.totalKgFoodSaved || 0).toFixed(1)),
      totalCO2Saved:    parseFloat((stats.totalCO2Saved    || 0).toFixed(1)),
      totalDeliveries:  Math.round(stats.totalDeliveries   || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/seed-impact', async (req, res) => {
  try {
    await ImpactStats.findOneAndUpdate(
      {},
      {
        totalMealsSaved:  127,
        totalKgFoodSaved: 42.3,
        totalCO2Saved:    105.8,
        totalDeliveries:  14,
      },
      { upsert: true }
    );
    res.json({ message: 'Impact stats seeded successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
