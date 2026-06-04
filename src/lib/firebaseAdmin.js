import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

const certPath = path.join(process.cwd(), 'certs/google-service-account.json');

if (!admin.apps.length) {
  try {
    if (fs.existsSync(certPath)) {
      const creds = JSON.parse(fs.readFileSync(certPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(creds),
        projectId: creds.project_id
      });
      console.log("✅ Firebase Admin initialized with service account file.");
    } else if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
      const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      admin.initializeApp({
        credential: admin.credential.cert(creds),
        projectId: creds.project_id
      });
      console.log("✅ Firebase Admin initialized with GOOGLE_SERVICE_ACCOUNT_JSON env var.");
    } else {
      admin.initializeApp();
      console.log("✅ Firebase Admin initialized with default credentials.");
    }
  } catch (error) {
    console.error("❌ Firebase Admin Initialization error:", error.message);
  }
}

export const adminDb = admin.firestore();
export { admin };
