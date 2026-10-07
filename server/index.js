const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./db/database');
const { generalApiLimiter } = require('./middleware/rateLimiter');

// Prevent unhandled worker or async errors from crashing the Node.js server
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL] Uncaught exception prevented from crashing server:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[CRITICAL] Unhandled promise rejection prevented from crashing server:', reason);
});

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Parsing Middlewares
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/api/', generalApiLimiter);

// Static directories for uploads and generated reports
const uploadsDir = path.join(__dirname, 'uploads');
const downloadsDir = path.join(__dirname, 'downloads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(downloadsDir)) fs.mkdirSync(downloadsDir, { recursive: true });

app.use('/uploads', express.static(uploadsDir));
app.use('/downloads', express.static(downloadsDir));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/verify', require('./routes/verify'));
app.use('/api/employees', require('./routes/employees'));
app.use('/api/queue', require('./routes/queue'));
app.use('/api/review', require('./routes/review'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/downloads', require('./routes/downloadArea'));
app.use('/api/masters', require('./routes/masters'));
app.use('/api/users', require('./routes/users'));
app.use('/api/audit', require('./routes/audit'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    appName: 'COLLMAN SERVICES ADDRESS VERIFICATION',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Serve frontend in production build if present
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/') && !req.path.startsWith('/uploads/') && !req.path.startsWith('/downloads/')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
}

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'An internal server error occurred.'
  });
});

const os = require('os');

function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

async function startServer() {
  try {
    await initDatabase();
    app.listen(PORT, '0.0.0.0', () => {
      const localIp = getLocalIpAddress();
      console.log(`=======================================================`);
      console.log(` COLLMAN SERVICES ADDRESS VERIFICATION BACKEND STARTED `);
      console.log(` Local:        http://localhost:${PORT}`);
      console.log(` Network (LAN): http://${localIp}:${PORT}`);
      console.log(` Common Link:  http://${localIp}:${PORT}/verify`);
      console.log(` HR / Admin:   http://${localIp}:${PORT}/admin`);
      console.log(`=======================================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();

module.exports = app;
