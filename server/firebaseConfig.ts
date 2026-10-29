import path from "path";
import fs from "fs";

export interface FirebaseServerConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  databaseURL?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
  isExampleConfig: boolean;
}

/**
 * Resolves Firebase configuration securely:
 * 1. Prioritizes environment variables (e.g. from .env, Cloud Run, Secret Manager).
 * 2. Falls back to firebase-applet-config.json only if values are non-placeholder.
 * 3. Never requires or exposes real credentials committed to git.
 */
export function getServerFirebaseConfig(): FirebaseServerConfig {
  let fileConfig: any = {};
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      fileConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
  } catch {}

  const isReal = (val?: string) =>
    Boolean(
      val &&
      typeof val === "string" &&
      val.trim().length > 0 &&
      !val.includes("example") &&
      !val.includes("Placeholder") &&
      !val.includes("0000000000")
    );

  const apiKey = process.env.FIREBASE_API_KEY || (isReal(fileConfig.apiKey) ? fileConfig.apiKey : "");
  const projectId = process.env.FIREBASE_PROJECT_ID || (isReal(fileConfig.projectId) ? fileConfig.projectId : "");
  const appId = process.env.FIREBASE_APP_ID || (isReal(fileConfig.appId) ? fileConfig.appId : "");
  const authDomain = process.env.FIREBASE_AUTH_DOMAIN || (isReal(fileConfig.authDomain) ? fileConfig.authDomain : (projectId ? `${projectId}.firebaseapp.com` : ""));
  const firestoreDatabaseId = process.env.FIRESTORE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || (isReal(fileConfig.firestoreDatabaseId) ? fileConfig.firestoreDatabaseId : "(default)");
  const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || (isReal(fileConfig.storageBucket) ? fileConfig.storageBucket : (projectId ? `${projectId}.firebasestorage.app` : ""));
  const messagingSenderId = process.env.FIREBASE_MESSAGING_SENDER_ID || (isReal(fileConfig.messagingSenderId) ? fileConfig.messagingSenderId : "");
  const databaseURL = process.env.FIREBASE_DATABASE_URL || fileConfig.databaseURL;
  const oAuthClientId = process.env.FIREBASE_OAUTH_CLIENT_ID || (isReal(fileConfig.oAuthClientId) ? fileConfig.oAuthClientId : "");
  const recaptchaSiteKey = process.env.FIREBASE_RECAPTCHA_SITE_KEY || fileConfig.recaptchaSiteKey;

  const isExampleConfig = !isReal(apiKey) || !isReal(projectId);

  return {
    projectId: projectId || "example-prople-store",
    appId: appId || "1:000000000000:web:0000000000000000000000",
    apiKey: apiKey || "AIzaSyExamplePlaceholderApiKey0000000000",
    authDomain: authDomain || "example-prople-store.firebaseapp.com",
    firestoreDatabaseId: firestoreDatabaseId || "example-firestore-database-id",
    storageBucket: storageBucket || "example-prople-store.firebasestorage.app",
    messagingSenderId: messagingSenderId || "000000000000",
    databaseURL,
    oAuthClientId,
    recaptchaSiteKey,
    isExampleConfig,
  };
}
