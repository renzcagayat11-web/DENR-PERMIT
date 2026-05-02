// Load environment variables
require('dotenv').config();

const { initFirebase } = require('./server/firebase');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const { uploadFromBase64, deleteFile } = require('./server/cloudinary');

const admin = initFirebase();
if (!admin) {
  console.error('Firebase admin not initialized. Provide serviceAccountKey.json or set GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

const app = express();
const PORT = 3003;

// Enhanced CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

// Body parsing middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname)));

// Serve pages directly
app.get('/pages/:file', (req, res) => {
  const file = req.params.file;
  if (!file || file === 'undefined') {
    return res.status(400).send('Invalid file parameter');
  }
  res.sendFile(path.join(__dirname, `pages/${file}`));
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'admin-dashboard.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'Backend server running', 
    port: PORT,
    firebase: admin ? 'connected' : 'disconnected'
  });
});

// middleware: verify Firebase ID token
async function verifyToken(req, res, next) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing Bearer token' });
  const idToken = auth.split('Bearer ')[1];
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Token verify error', err);
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Admin endpoint: create a Staff account
app.post('/admin/createStaff', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden: admin only' });
    const { email, password, displayName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    const newUser = await admin.auth().createUser({ email, password, displayName });
    await admin.auth().setCustomUserClaims(newUser.uid, { role: 'staff' });
    const db = admin.firestore();
    await db.collection('users').doc(newUser.uid).set({
      email,
      displayName: displayName || null,
      role: 'staff',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ uid: newUser.uid, email: newUser.email });
  } catch (err) {
    console.error('createStaff error', err);
    res.status(500).json({ error: err.message });
  }
});

// Verify user role endpoint
app.get('/admin/verify-role', verifyToken, async (req, res) => {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(req.user.uid).get();
    const role = userDoc.exists ? userDoc.data().role : 'customer';
    res.json({ uid: req.user.uid, email: req.user.email, role });
  } catch (err) {
    console.error('verify-role error', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin analytics endpoint
app.get('/admin/analytics', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'staff') {
      return res.status(403).json({ error: 'Forbidden: admin/staff only' });
    }
    const db = admin.firestore();
    const appsSnap = await db.collection('applications').get();
    
    let totalApplications = 0;
    let pending = 0;
    let underReview = 0;
    let approved = 0;
    let rejected = 0;
    
    appsSnap.forEach(doc => {
      const data = doc.data();
      totalApplications++;
      const status = (data.status || '').toLowerCase();
      if (status === 'pending') pending++;
      else if (status === 'under review') underReview++;
      else if (status === 'approved') approved++;
      else if (status === 'rejected') rejected++;
    });
    
    const counts = {
      totalApplications,
      pending,
      underReview,
      approved,
      rejected,
      approvalRate: totalApplications > 0 ? ((approved / totalApplications) * 100).toFixed(1) : 0,
      rejectionRate: totalApplications > 0 ? ((rejected / totalApplications) * 100).toFixed(1) : 0
    };
    res.json(counts);
  } catch (err) {
    console.error('analytics error', err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Full Backend server running at http://localhost:${PORT}`);
  console.log(`🔧 Firebase: ${admin ? 'Connected' : 'Disconnected'}`);
  console.log(`📱 Admin Dashboard: http://localhost:${PORT}/`);
  console.log(`💊 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔗 CORS enabled for: http://localhost:3000`);
});
