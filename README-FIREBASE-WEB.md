# Firebase Web setup (DENR PERMIT)

Steps to connect your project to Firebase Web:

1. Create a Firebase project at https://console.firebase.google.com/
2. In the project, click the gear → Project settings → "Your apps" and register a new Web app.
3. Copy the Firebase config object shown (apiKey, authDomain, projectId, etc.).
4. Open `index.html` in the project root and replace the `firebaseConfig` placeholder with your values.
5. Enable Firestore in the Firebase console (Build → Firestore Database) and choose a mode.

Running locally:

- Quick (no install): use a simple static server. Example using `npx`:
```bash
cd "C:\Users\renzc\OneDrive\Desktop\DENR PERMIT"
npx http-server -c-1 .
# then open http://localhost:8080 in your browser (or the port shown)
```

- Or install VS Code extension "Live Server" and open `index.html` with Live Server.

Security note:
- The web config contains public keys and is safe to include in client code, but secure server operations still require Firebase security rules or server-side credentials.
