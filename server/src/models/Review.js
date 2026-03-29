import mongoose from 'mongoose';
const { Schema } = mongoose;
const ObjectId = Schema.Types.ObjectId;

const reviewSchema = new mongoose.Schema({
  reviewer:  { type: ObjectId, ref: 'User', required: true },
  reviewee:  { type: ObjectId, ref: 'User', required: true },
  delivery:  { type: ObjectId, ref: 'FoodListing', required: true },
  rating:    { type: Number, required: true, min: 1, max: 5 },
  comment:   { type: String, maxlength: 300 },
  role:      { type: String, enum: ['donor','recipient','volunteer'] },
}, { timestamps: true });

// Prevent duplicate reviews on same delivery by same reviewer
reviewSchema.index({ reviewer: 1, delivery: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);
