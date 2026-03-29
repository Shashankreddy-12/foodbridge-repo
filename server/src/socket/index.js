import jwt from 'jsonwebtoken';
import FoodListing from '../models/FoodListing.js';

export default function setupSocket(io) {
  // Authenticate every socket connection with JWT
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('No token'));
      
      const user = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = user.id;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    // Join personal room for targeted events
    socket.join(`user_${socket.userId}`);
    console.log(`User ${socket.userId} connected`);

    socket.on('location_update', ({ deliveryId, lat, lng }) => {
      // Relay volunteer location to recipient in real-time
      FoodListing.findById(deliveryId).then(listing => {
        if (listing && listing.claimedBy) {
          io.to(`user_${listing.claimedBy}`).emit('volunteer_location', {
            lat, lng, deliveryId
          });
        }
      }).catch(err => console.error('location_update error:', err.message));
    });

    socket.on('disconnect', () => {
      console.log(`User ${socket.userId} disconnected`);
    });
  });
}
