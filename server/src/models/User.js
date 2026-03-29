import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const userSchema = new mongoose.Schema({
  name:       { type: String, required: true, trim: true, minlength: 2 },
  email:      { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:   { type: String, required: true },
  role:       { type: String, enum: ['donor','recipient','volunteer'], default: 'recipient' },
  phone:      { type: String, required: true },
  orgName:    { type: String },       // For NGOs / restaurants
  resetToken:       { type: String },
  resetTokenExpiry: { type: Date },
  location: {
    type:        { type: String, enum: ['Point'] },
    coordinates: { type: [Number] }   // [longitude, latitude]
  },
  rating:     { type: Number, default: 5 },
  isVerified: { type: Boolean, default: false },
}, { timestamps: true });

userSchema.index({ location: '2dsphere' });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

export default mongoose.model('User', userSchema);
