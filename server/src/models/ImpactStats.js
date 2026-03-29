import mongoose from 'mongoose';

const impactSchema = new mongoose.Schema({
  totalMealsSaved:  { type: Number, default: 0 },
  totalKgFoodSaved: { type: Number, default: 0 },
  totalCO2Saved:    { type: Number, default: 0 },
  totalDeliveries:  { type: Number, default: 0 },
});

export const ImpactStats = mongoose.model('ImpactStats', impactSchema);

export async function recordImpact(kgFood = 1) {
  const CO2_PER_KG  = 2.5; // WRAP methodology
  const MEALS_PER_KG = 3;  // avg 333g per meal
  try {
    await ImpactStats.findOneAndUpdate(
      {},
      {
        $inc: {
          totalKgFoodSaved: kgFood,
          totalMealsSaved:  kgFood * MEALS_PER_KG,
          totalCO2Saved:    kgFood * CO2_PER_KG,
          totalDeliveries:  1,
        }
      },
      { upsert: true }
    );
  } catch (err) {
    console.error('[ImpactStats] recordImpact failed:', err.message);
  }
}
