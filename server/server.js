// Load environment variables
require('dotenv').config();

const { initFirebase } = require('./firebase');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const { uploadFromBase64, deleteFile } = require('./cloudinary');

const admin = initFirebase();
if (!admin) {
  console.error('Firebase admin not initialized. Provide serviceAccountKey.json or set GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

const app = express();
app.use(cors());

// Optimized payload limits for 5MB file uploads (fast processing)
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

app.use(express.static(path.join(__dirname, '..'))); // Serve static files from parent directory

// Serve pages directly
app.get('/pages/:file', (req, res) => {
  const file = req.params.file;
  
  // Handle undefined or empty file parameter
  if (!file || file === 'undefined') {
    console.log('Invalid file parameter:', file);
    return res.status(400).send('Invalid file parameter');
  }
  
  res.sendFile(path.join(__dirname, `../pages/${file}`));
});

// Serve index.html from pages folder as default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../pages/index.html'));
});

// Redirect old dashboard URLs to new pages folder (only if not already in pages folder)
app.get('/admin-dashboard.html', (req, res) => {
  if (!req.path.startsWith('/pages/')) {
    res.redirect('/pages/admin-dashboard.html');
  } else {
    res.sendFile(path.join(__dirname, '../pages/admin-dashboard.html'));
  }
});

app.get('/customer-dashboard.html', (req, res) => {
  if (!req.path.startsWith('/pages/')) {
    res.redirect('/pages/customer-dashboard.html');
  } else {
    res.sendFile(path.join(__dirname, '../pages/customer-dashboard.html'));
  }
});

app.get('/staff-dashboard.html', (req, res) => {
  if (!req.path.startsWith('/pages/')) {
    res.redirect('/pages/staff-dashboard.html');
  } else {
    res.sendFile(path.join(__dirname, '../pages/staff-dashboard.html'));
  }
});

app.get('/index.html', (req, res) => {
  if (!req.path.startsWith('/pages/')) {
    res.redirect('/pages/index.html');
  } else {
    res.sendFile(path.join(__dirname, '../pages/index.html'));
  }
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

// Admin endpoint: create a Staff account (only Admin role allowed)
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

// Admin analytics: detailed dashboard statistics
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

// Staff endpoint: update application status
app.post('/staff/updateApplicationStatus', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'staff' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: staff/admin only' });
    }

    const { applicationId, status, rejectionReason } = req.body;
    if (!applicationId || !status) {
      return res.status(400).json({ error: 'applicationId and status required' });
    }

    const validStatuses = ['pending', 'under review', 'approved', 'rejected'];
    if (!validStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const db = admin.firestore();
    const appRef = db.collection('applications').doc(applicationId);
    
    const updateData = {
      status: status.toLowerCase(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      reviewedBy: req.user.email,
      reviewedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (status.toLowerCase() === 'rejected' && rejectionReason) {
      updateData.rejectionReason = rejectionReason;
    }

    await appRef.update(updateData);

    res.json({ success: true, message: `Application ${status} successfully` });
  } catch (err) {
    console.error('updateApplicationStatus error', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: get all users
app.get('/admin/users', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }

    const { userType } = req.query;
    const db = admin.firestore();
    let query = db.collection('users');

    if (userType && userType !== 'all') {
      query = query.where('role', '==', userType);
    }

    const snapshot = await query.get();
    const users = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(users);
  } catch (err) {
    console.error('getUsers error', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: update user status
app.post('/admin/users/:userId/status', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }

    const { userId } = req.params;
    const { status } = req.body;

    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);

    await userRef.update({
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: req.user.email
    });

    res.json({ success: true, message: 'User status updated' });
  } catch (err) {
    console.error('updateUserStatus error', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: log audit action
app.post('/admin/audit-log', verifyToken, async (req, res) => {
  try {
    const { action, details } = req.body;

    const db = admin.firestore();
    await db.collection('auditLogs').add({
      userId: req.user.uid,
      userEmail: req.user.email,
      role: req.user.role,
      action,
      details,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true });
  } catch (err) {
    console.error('auditLog error', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin endpoint: get audit logs
app.get('/admin/audit-logs', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: admin only' });
    }

    const db = admin.firestore();
    const snapshot = await db.collection('auditLogs')
      .orderBy('timestamp', 'desc')
      .limit(100)
      .get();

    const logs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(logs);
  } catch (err) {
    console.error('getAuditLogs error', err);
    res.status(500).json({ error: err.message });
  }
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

// Direct file upload route (preferred method)
app.post('/upload-file-to-cloudinary', upload.single('file'), async (req, res) => {
  try {
    // Check if Cloudinary is configured
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ 
        error: 'Cloudinary not configured',
        details: 'Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file'
      });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { folder = 'denr-permits' } = req.body;
    
    // Convert buffer to base64 for Cloudinary
    const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    
    const result = await uploadFromBase64(base64Data, req.file.originalname, folder);
    
    res.json({
      success: true,
      url: result.url,
      public_id: result.public_id,
      format: result.format,
      size: result.size,
      original_filename: result.original_filename
    });
    
  } catch (error) {
    console.error('Direct file upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload file to Cloudinary',
      details: error.message 
    });
  }
});

// Cloudinary upload route (fallback for small files)
app.post('/upload-to-cloudinary', async (req, res) => {
  try {
    const { base64Data, fileName, folder = 'denr-permits' } = req.body;
    
    if (!base64Data || !fileName) {
      return res.status(400).json({ error: 'Base64 data and filename are required' });
    }
    
    const result = await uploadFromBase64(base64Data, fileName, folder);
    
    res.json({
      success: true,
      url: result.url,
      public_id: result.public_id,
      format: result.format,
      size: result.size,
      original_filename: result.original_filename
    });
    
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload file to Cloudinary',
      details: error.message 
    });
  }
});

// Cloudinary delete route
app.delete('/delete-from-cloudinary/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    
    if (!publicId) {
      return res.status(400).json({ error: 'Public ID is required' });
    }
    
    const result = await deleteFile(publicId);
    
    res.json({
      success: true,
      result: result
    });
    
  } catch (error) {
    console.error('Cloudinary delete error:', error);
    res.status(500).json({ 
      error: 'Failed to delete file from Cloudinary',
      details: error.message 
    });
  }
});

// Download original file from Cloudinary
app.get('/download-file/:publicId/:filename', async (req, res) => {
  // Set CORS headers for this endpoint
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  try {
    const { publicId, filename } = req.params;
    
    // Decode the URL-encoded publicId and filename
    const decodedPublicId = decodeURIComponent(publicId);
    const decodedFilename = decodeURIComponent(filename);
    
    if (!decodedPublicId || !decodedFilename) {
      return res.status(400).json({ error: 'Public ID and filename are required' });
    }
    
    // Import Cloudinary v2 and fetch for file download
    const cloudinary = require('cloudinary').v2;
    const https = require('https');
    const http = require('http');
    
    // Set proper headers for file download
    const fileExtension = decodedFilename.split('.').pop().toLowerCase();
    const mimeTypes = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif'
    };
    
    const contentType = mimeTypes[fileExtension] || 'application/octet-stream';
    
    // Determine resource type based on file extension
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
    const resourceType = isImage ? 'image' : 'raw';
    
    try {
      // Generate the correct download URL directly without API call
      const downloadUrl = cloudinary.url(decodedPublicId, {
        resource_type: resourceType,
        secure: true,
        // For raw files, add attachment flag
        ...(resourceType === 'raw' && { flags: 'attachment' })
      });
      
      console.log('Downloading from:', downloadUrl);
      
      // Set headers for file download
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(decodedFilename)}"`);
      res.setHeader('Cache-Control', 'no-cache');
      
      // Fetch the file from Cloudinary and collect chunks for proper binary handling
      const urlModule = downloadUrl.startsWith('https:') ? https : http;
      
      const fileRequest = urlModule.get(downloadUrl, (fileRes) => {
        // If Cloudinary returns an error
        if (fileRes.statusCode === 404 || fileRes.statusCode === 400) {
          return res.status(404).json({ error: 'File not found on Cloudinary' });
        }
        
        if (fileRes.statusCode >= 400) {
          return res.status(fileRes.statusCode).json({ 
            error: 'Cloudinary error', 
            status: fileRes.statusCode 
          });
        }
        
        // Collect data chunks to ensure proper binary handling
        const chunks = [];
        fileRes.on('data', (chunk) => {
          chunks.push(chunk);
        });
        
        fileRes.on('end', () => {
          const buffer = Buffer.concat(chunks);
          res.end(buffer);
        });
        
        fileRes.on('error', (err) => {
          console.error('File stream error:', err);
          if (!res.headersSent) {
            res.status(500).json({ 
              error: 'Failed to stream file',
              details: err.message 
            });
          }
        });
      });
      
    } catch (apiError) {
      console.error('Cloudinary API error:', apiError);
      return res.status(404).json({ 
        error: 'File not found',
        details: apiError.message 
      });
    }
    
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ 
      error: 'Failed to download file',
      details: error.message 
    });
  }
});

// Test endpoint to check Cloudinary URLs
app.get('/test-cloudinary/:publicId', async (req, res) => {
  try {
    const { publicId } = req.params;
    const cloudinary = require('cloudinary').v2;
    
    // Try both image and raw resource types
    let result = null;
    let resourceType = null;
    
    try {
      result = await cloudinary.api.resource(publicId, {
        resource_type: 'raw',
        type: 'upload'
      });
      resourceType = 'raw';
    } catch (rawError) {
      try {
        result = await cloudinary.api.resource(publicId, {
          resource_type: 'image',
          type: 'upload'
        });
        resourceType = 'image';
      } catch (imageError) {
        return res.json({
          error: 'File not found',
          rawError: rawError.message,
          imageError: imageError.message
        });
      }
    }
    
    const downloadUrl = cloudinary.url(publicId, {
      resource_type: resourceType,
      secure: true
    });
    
    res.json({
      found: true,
      resourceType: resourceType,
      publicId: result.public_id,
      format: result.format,
      size: result.bytes,
      url: result.secure_url,
      downloadUrl: downloadUrl
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
