const { initFirebase } = require('./firebase');
const readline = require('readline');

const admin = initFirebase();
if (!admin) {
  console.error('Firebase admin not initialized. Place serviceAccountKey.json in project root or set GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

async function createAdmin(email, password, displayName) {
  try {
    // Check if user exists
    let userRecord;
    try { userRecord = await admin.auth().getUserByEmail(email); } catch(e) { }

    if (userRecord) {
      console.log('User already exists. Updating custom claims...');
      await admin.auth().setCustomUserClaims(userRecord.uid, { role: 'admin' });
      const db = admin.firestore();
      await db.collection('users').doc(userRecord.uid).set({ email, displayName, role: 'admin', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      console.log('Existing user promoted to admin:', userRecord.uid);
      return;
    }

    const newUser = await admin.auth().createUser({ email, password, displayName });
    await admin.auth().setCustomUserClaims(newUser.uid, { role: 'admin' });

    const db = admin.firestore();
    await db.collection('users').doc(newUser.uid).set({ email, displayName: displayName || null, role: 'admin', createdAt: admin.firestore.FieldValue.serverTimestamp() });

    console.log('Admin created:', newUser.uid);
  } catch (err) {
    console.error('Failed to create admin:');
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
  }
}

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans); }));
}

(async () => {
  const email = process.argv[2] || await prompt('Admin email: ');
  const password = process.argv[3] || await prompt('Admin password (min 6 chars): ');
  const displayName = process.argv[4] || await prompt('Display name (optional): ');
  if (!email || !password) {
    console.error('email and password are required');
    process.exit(1);
  }
  await createAdmin(email, password, displayName);
  process.exit(0);
})();
