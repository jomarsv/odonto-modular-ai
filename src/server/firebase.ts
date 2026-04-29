import admin from "firebase-admin";

function credentialFromEnv() {
  const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (serviceAccountBase64) {
    const json = Buffer.from(serviceAccountBase64, "base64").toString("utf8");
    return admin.credential.cert(JSON.parse(json));
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return admin.credential.applicationDefault();
  }

  throw new Error(
    "Firebase Admin nao configurado. Defina FIREBASE_SERVICE_ACCOUNT_BASE64 ou FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL e FIREBASE_PRIVATE_KEY."
  );
}

export function getFirebaseAdmin() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: credentialFromEnv(),
      projectId: process.env.FIREBASE_PROJECT_ID
    });
  }
  return admin;
}

export function getFirestore() {
  return getFirebaseAdmin().firestore();
}
