const fs = require('fs');
const path = require('path');

function findKeyPath() {
  const rootPath = path.join(__dirname, 'serviceAccountKey.json');
  if (fs.existsSync(rootPath)) return rootPath;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS && fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) return process.env.GOOGLE_APPLICATION_CREDENTIALS;
  return null;
}

const keyPath = findKeyPath();
if (!keyPath) {
  console.error('No credentials found. Put serviceAccountKey.json in server folder or set GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

try {
  const raw = fs.readFileSync(keyPath, 'utf8');
  const json = JSON.parse(raw);
  if (json.client_email) {
    console.log('Found service account file:', keyPath);
    console.log('service account client_email:', json.client_email);
    process.exit(0);
  }
  console.error('File parsed but missing client_email field. Is this a valid service account JSON?');
  process.exit(2);
} catch (err) {
  console.error('Failed to read/parse credential file:', err.message || err);
  process.exit(3);
}
