require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { pool, initializeDatabase } = require('./config/database');
const apiRoutes = require('./routes');
const { authenticateToken } = require('./middleware/auth.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

const app = express();
const port = process.env.PORT || 2000;
const allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean) : true;

app.use(cors({ origin: allowedOrigins, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', authenticateToken, express.static(path.join(__dirname, 'uploads')));

app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  try { await pool.query('SELECT 1'); dbStatus = 'connected'; } catch (e) { dbStatus = 'error: ' + e.message; }
  res.json({ status: 'success', message: 'Personnel Evaluation System API is running.', version: '1.1.0', allowQuickLogin: process.env.NODE_ENV !== 'production', database: dbStatus });
});

app.get('/online', (req, res) => res.json({ status: 'success', message: 'System online.', timestamp: new Date().toISOString() }));
app.use('/api', apiRoutes);
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  const dbOk = await initializeDatabase();
  const server = app.listen(port, () => console.log(`[Server] Running at http://localhost:${port}/ (Database: ${dbOk ? 'Ready' : 'Pending'})`));
  const shutdown = async () => server.close(async () => { try { await pool.end(); } catch {} process.exit(0); });
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

startServer();
