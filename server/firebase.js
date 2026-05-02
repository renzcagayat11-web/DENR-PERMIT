const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let initialized = false;

function initFirebase() {
  if (initialized) return admin;
  const keyPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(keyPath)) {
    const serviceAccount = require(keyPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    initialized = true;
    console.log('Firebase initialized using serviceAccountKey.json');
    return admin;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp();
    initialized = true;
    console.log('Firebase initialized using GOOGLE_APPLICATION_CREDENTIALS');
    return admin;
  }

  console.error('No Firebase credentials found. Place serviceAccountKey.json in the server folder or set the GOOGLE_APPLICATION_CREDENTIALS environment variable.');
  return null;
}

module.exports = { initFirebase };
