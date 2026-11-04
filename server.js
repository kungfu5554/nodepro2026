// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./config/database');
const apiRoutes = require('./routes');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();
const port = process.env.PORT || 2000;

// Enable Cross-Origin Resource Sharing (CORS)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets and user uploaded files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Personnel Evaluation System API is running.',
    version: '1.0.0'
  });
});

// Legacy online check
app.get('/online', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'System online.',
    timestamp: new Date().toISOString()
  });
});

// Mount RESTful API routes under /api
app.use('/api', apiRoutes);

// Serve main Single Page Application (UI) for root and frontend routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Centralized error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start HTTP server and trigger database initialization with retry
app.listen(port, async () => {
  console.log(`[Server] Running at http://localhost:${port}/`);
  await initializeDatabase();
});
