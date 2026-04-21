import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function initAdminApp() {
  if (getApps().length) {
    return getApps()[0]!;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccount) {
    return initializeApp({ credential: cert(JSON.parse(serviceAccount)) });
  }

  return initializeApp({ credential: applicationDefault() });
}

const app = initAdminApp();

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
export const adminStorage = getStorage(app);

