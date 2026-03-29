import express from 'express';
import http from 'http';
import cors from 'cors';
import 'dotenv/config';
import mongoose from 'mongoose';
import { Server } from 'socket.io';

import routes from './src/routes/index.js';
import setupSocket from './src/socket/index.js';
import { startExpiryWatcher } from './src/services/expiryWatcher.js';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

// dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
}));
app.use(express.json());

// Security headers
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false, // disabled to allow Leaflet maps
}));

// Sanitize MongoDB queries — prevents NoSQL injection
app.use(mongoSanitize());

// General rate limiter — all routes
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
}));

// Strict rate limiter — auth routes only
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // only 10 login/register attempts per 15 mins
  message: { error: 'Too many auth attempts, please try again in 15 minutes' },
});
app.use('/api/auth', authLimiter);

// Socket.io
const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL || 'http://localhost:5173',
        methods: ["GET", "POST"]
    }
});
setupSocket(io);

// Expose io to routes
app.set('io', io);

// Routes
app.use('/api', routes);


// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('Connected to MongoDB');
        startExpiryWatcher(io);
    })
    .catch((err) => console.error('Failed to connect to MongoDB:', err.message));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
