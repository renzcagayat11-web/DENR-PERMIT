const { initFirebase } = require('./firebase');

async function runTest() {
  const admin = initFirebase();
  if (!admin) {
    console.error('Firebase not initialized. See README instructions.');
    process.exit(1);
  }

  const db = admin.firestore();
  const docRef = db.collection('denr_test').doc('sample');
  await docRef.set({
    message: 'hello from node',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log('Wrote test document to denr_test/sample');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
