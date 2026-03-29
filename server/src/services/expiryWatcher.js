import cron from 'node-cron';
import FoodListing from '../models/FoodListing.js';
import User from '../models/User.js';
import { getPeakHours } from './surplusPredictor.js';

export function startExpiryWatcher(io) {
  cron.schedule('*/5 * * * *', async () => {
    try {
      // Step 1: Find listings expiring within 1 hour, not yet marked urgent
      const soonExpiring = await FoodListing.find({
        status: 'available',
        urgent: false,
        expiresAt: {
          $gte: new Date(),
          $lte: new Date(Date.now() + 60 * 60 * 1000)
        }
      }).populate('donor', 'name');

      for (const listing of soonExpiring) {
        // Mark as urgent
        await FoodListing.findByIdAndUpdate(listing._id, { urgent: true });

        // Notify nearby recipients within 15km (wider radius for urgency)
        const nearby = await User.find({
          role: 'recipient',
          location: { $near: { $geometry: listing.location, $maxDistance: 15000 } }
        }).select('_id');

        nearby.forEach(r => {
          io.to(`user_${r._id}`).emit('urgent_listing', { listing });
        });
      }

      // Step 2: Auto-expire listings past their expiry time
      const expired = await FoodListing.updateMany(
        { status: 'available', expiresAt: { $lt: new Date() } },
        { status: 'expired' }
      );

      if (expired.modifiedCount > 0) {
        console.log(`[ExpiryWatcher] Auto-expired ${expired.modifiedCount} listings`);
      }

    } catch (err) {
      // Never crash the cron — just log
      console.error('[ExpiryWatcher] Error:', err.message);
    }
  });

  cron.schedule('*/30 * * * *', async () => {
    try {
      const peakHours = await getPeakHours();
      const currentHour = new Date().getHours();
      const nextHour = (currentHour + 1) % 24;

      const peakMatch = peakHours.find(p => p.hour === nextHour);

      if (peakMatch) {
         const recipients = await User.find({ role: 'recipient' }).select('_id');
         recipients.forEach(r => {
             io.to('user_' + r._id).emit('upcoming_surplus', {
                 message: 'Surplus food peak expected in the next hour!', 
                 peakHour: peakMatch.label
             });
         });
      }
    } catch (err) {
      console.error('[ExpiryWatcher] Peak check error:', err.message);
    }
  });

  console.log('[ExpiryWatcher] Started — checking every 5 minutes');
}
