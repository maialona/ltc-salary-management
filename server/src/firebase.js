import admin from 'firebase-admin';
import fs from 'fs';

let initialized = false;

export function getFirebaseAdmin() {
  if (!initialized) {
    let credential;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      credential = admin.credential.cert(parsed);
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const raw = fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
      credential = admin.credential.cert(JSON.parse(raw));
    } else {
      throw new Error('Firebase service account not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH.');
    }
    admin.initializeApp({ credential });
    initialized = true;
  }
  return admin;
}

export async function verifyIdToken(idToken) {
  const firebaseAdmin = getFirebaseAdmin();
  return firebaseAdmin.auth().verifyIdToken(idToken);
}
