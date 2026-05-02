const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3003;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Default route - serve admin dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'admin-dashboard.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Backend server running', port: PORT });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend server running at http://localhost:${PORT}`);
  console.log(`📱 Admin Dashboard: http://localhost:${PORT}/`);
  console.log(`🔧 Health Check: http://localhost:${PORT}/health`);
});
