import mongoose from 'mongoose';
const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const listingSchema = new mongoose.Schema({
  donor:       { type: ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true },
  description: { type: String },
  foodType:    { type: String, enum: ['cooked','raw','packaged','bakery','produce','dairy','other'] },
  quantity:    { type: String, required: true },   // e.g. '5 kg', '20 meals'
  expiresAt:   { type: Date, required: true },
  condition:   { type: String, required: true },   // Free-text, fed to NLP scorer later
  safetyScore: { type: Number },                   // 0-100, filled by ML in Phase 5
  urgent:      { type: Boolean, default: false },  // Set by expiry watcher in Phase 4
  status:      { type: String, enum: ['available','claimed','delivered','expired'], default: 'available' },
  claimedBy:   { type: ObjectId, ref: 'User' },
  volunteer:   { type: ObjectId, ref: 'User' },
  travelMode:  { type: String, enum: ['walking','2-wheeler','4-wheeler'], default: '2-wheeler' },
  deliveredAt: { type: Date },
  kgFood:      { type: Number, default: 1 }, // for impact calculation
  location: {
    type:        { type: String, default: 'Point' },
    coordinates: { type: [Number] }                // [longitude, latitude]
  },
  address:  { type: String, required: true },
  images:   [{ type: String }],
}, { timestamps: true });

listingSchema.index({ location: '2dsphere' });
listingSchema.index({ expiresAt: 1 });

export default mongoose.model('FoodListing', listingSchema);
