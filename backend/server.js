require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const seedAdmin = require('./utils/seedAdmin');

const app = express();
const uploadsRoot = path.join(__dirname, 'uploads');

// Middleware
app.set('trust proxy', true);
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use('/uploads', express.static(uploadsRoot));
app.use('/uploads', (req, res) => {
  res.status(404).json({ status: false, message: 'Upload file not found', data: null });
});

// Routes
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/boards', require('./routes/board'));
app.use('/api/v1/languages', require('./routes/language'));
app.use('/api/v1/classes', require('./routes/class'));
app.use('/api/v1/subjects', require('./routes/subject'));
app.use('/api/v1/chapters', require('./routes/chapter'));
app.use('/api/v1/topics', require('./routes/topic'));
app.use('/api/v1/questions', require('./routes/question'));
app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/subscriptions', require('./routes/subscription'));
app.use('/api/v1/evaluations', require('./routes/evaluation'));
app.use('/api/v1/app', require('./routes/app'));

// Health check
app.get('/health', (req, res) => res.json({ status: true, message: 'DAMINI+ Admin API Running' }));

app.use('/api', (err, req, res, next) => {
  console.error('API error:', err);
  if (res.headersSent) return next(err);
  return res.status(err.statusCode || err.status || 500).json({
    status: false,
    message: err.message || 'Internal server error',
    data: null,
  });
});

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

const PORT = process.env.PORT || 5000;

process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err);
});

process.on('uncaughtException', err => {
  console.error('Uncaught exception:', err);
});

connectDB().then(async () => {
  await seedAdmin();
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Admin Panel: http://localhost:${PORT}`);
  });
  server.requestTimeout = 120000;
  server.headersTimeout = 125000;
});
