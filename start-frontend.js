const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// Default route - serve admin dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'admin-dashboard.html'));
});

// Serve pages directly
app.get('/pages/:file', (req, res) => {
  const file = req.params.file;
  res.sendFile(path.join(__dirname, 'pages', file));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Frontend server running at http://localhost:${PORT}`);
  console.log(`📱 Admin Dashboard: http://localhost:${PORT}/`);
  console.log(`📄 Other pages: http://localhost:${PORT}/pages/[filename].html`);
});
