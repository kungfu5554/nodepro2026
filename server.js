// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, initializeDatabase } = require('./config/database');
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

// Body parsing middlewares with 10MB limit for base64 canvas signatures
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static frontend assets and user uploaded files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try {
    await pool.query('SELECT 1');
    dbStatus = 'connected';
  } catch (e) {
    dbStatus = 'error: ' + e.message;
  }

  res.status(200).json({
    status: 'success',
    message: 'Personnel Evaluation System API is running.',
    version: '1.0.0',
    database: dbStatus
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

// Start HTTP server after triggering database initialization
async function startServer() {
  const dbOk = await initializeDatabase();
  const server = app.listen(port, () => {
    console.log(`[Server] Running at http://localhost:${port}/ (Database: ${dbOk ? 'Ready' : 'Pending'})`);
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    console.log(`\n[Server] Received ${signal}. Closing gracefully...`);
    server.close(async () => {
      try {
        await pool.end();
        console.log('[Server] Database pool closed.');
      } catch (err) {}
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
