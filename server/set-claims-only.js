const { initFirebase } = require('./firebase');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node set-claims-only.js user@example.com');
  process.exit(1);
}

const admin = initFirebase();
if (!admin) {
  console.error('Firebase admin not initialized. Provide serviceAccountKey.json or set GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

(async () => {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { role: 'admin' });
    console.log('Set custom claim role=admin for user:', user.uid);
    process.exit(0);
  } catch (err) {
    console.error('Failed to set claims:');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
})();
