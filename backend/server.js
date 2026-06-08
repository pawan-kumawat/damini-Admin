require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const seedAdmin = require('./utils/seedAdmin');

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  await seedAdmin();
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Admin Panel: http://localhost:${PORT}`);
  });
});
