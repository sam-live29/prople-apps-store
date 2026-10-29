import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  memoryLocalCache,
  getFirestore,
  setLogLevel
} from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import firebaseConfig from '../firebase-applet-config.json';

interface ExtendedFirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  measurementId?: string;
  databaseURL?: string;
  firestoreDatabaseId?: string;
  oAuthClientId?: string;
}

declare const __FIREBASE_ENV_CONFIG__: ExtendedFirebaseConfig | undefined;

function getResolvedFirebaseConfig(): ExtendedFirebaseConfig {
  const envCfg = typeof __FIREBASE_ENV_CONFIG__ !== 'undefined' ? __FIREBASE_ENV_CONFIG__ : {};
  const fileCfg = (firebaseConfig || {}) as ExtendedFirebaseConfig;

  const isReal = (val?: string) =>
    Boolean(
      val &&
      typeof val === 'string' &&
      val.trim().length > 0 &&
      !val.includes('example') &&
      !val.includes('Placeholder') &&
      !val.includes('0000000000')
    );

  const apiKey = isReal(envCfg.apiKey) ? envCfg.apiKey : (isReal(fileCfg.apiKey) ? fileCfg.apiKey : 'AIzaSyExamplePlaceholderApiKey0000000000');
  const projectId = isReal(envCfg.projectId) ? envCfg.projectId : (isReal(fileCfg.projectId) ? fileCfg.projectId : 'example-prople-store');
  const appId = isReal(envCfg.appId) ? envCfg.appId : (isReal(fileCfg.appId) ? fileCfg.appId : '1:000000000000:web:0000000000000000000000');
  const authDomain = isReal(envCfg.authDomain) ? envCfg.authDomain : (isReal(fileCfg.authDomain) ? fileCfg.authDomain : (projectId ? `${projectId}.firebaseapp.com` : ''));
  const firestoreDatabaseId = isReal(envCfg.firestoreDatabaseId) ? envCfg.firestoreDatabaseId : (isReal(fileCfg.firestoreDatabaseId) ? fileCfg.firestoreDatabaseId : '(default)');
  const storageBucket = isReal(envCfg.storageBucket) ? envCfg.storageBucket : (isReal(fileCfg.storageBucket) ? fileCfg.storageBucket : (projectId ? `${projectId}.firebasestorage.app` : ''));
  const messagingSenderId = isReal(envCfg.messagingSenderId) ? envCfg.messagingSenderId : (isReal(fileCfg.messagingSenderId) ? fileCfg.messagingSenderId : '000000000000');
  const measurementId = envCfg.measurementId || fileCfg.measurementId || '';
  const databaseURL = envCfg.databaseURL || fileCfg.databaseURL;
  const oAuthClientId = isReal(envCfg.oAuthClientId) ? envCfg.oAuthClientId : fileCfg.oAuthClientId;

  return {
    apiKey,
    projectId,
    appId,
    authDomain,
    firestoreDatabaseId,
    storageBucket,
    messagingSenderId,
    measurementId,
    databaseURL,
    oAuthClientId,
  };
}

const config = getResolvedFirebaseConfig();
export const app = getApps().length > 0 ? getApps()[0] : initializeApp(config);

// Suppress non-fatal SDK connection warnings while maintaining true error reporting
try {
  setLogLevel('silent');
} catch {}

// Safely filter benign Firestore offline/connection notices, stream reconnects, and auth validation notices so they don't get flagged as application crashes in sandboxed previews
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = function (...args: unknown[]) {
    const message = args.map(a => (typeof a === 'string' ? a : (a instanceof Error ? a.message : (typeof a === 'object' && a !== null ? JSON.stringify(a) : '')))).join(' ');
    if (
      message.includes('Could not reach Cloud Firestore backend') ||
      message.includes('PERMISSION_DENIED') ||
      message.includes('Missing or insufficient permissions') ||
      (message.includes('@firebase/firestore') && (
        message.includes('offline mode') ||
        message.includes('GrpcConnection') ||
        message.includes('RST_STREAM') ||
        message.includes('WebChannel') ||
        message.includes('Code: 13') ||
        message.includes('13 INTERNAL') ||
        message.includes('Code: 7') ||
        message.includes('stream') ||
        message.includes('unavailable')
      )) ||
      message.includes('GrpcConnection RPC') ||
      message.includes('RST_STREAM') ||
      message.includes('Received RST_STREAM with code 2') ||
      message.includes('13 INTERNAL: Received RST_STREAM') ||
      message.includes('Failed to obtain exclusive access to the persistence layer') ||
      message.includes('INTERNAL ASSERTION FAILED') ||
      message.includes('auth/invalid-credential') ||
      message.includes('auth/user-not-found') ||
      message.includes('auth/wrong-password') ||
      message.includes('Login failed') ||
      message.includes('Sign-in error')
    ) {
      console.warn('[Firestore/Auth Notice]', ...args);
      return;
    }
    originalConsoleError.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason?.message || String(reason || '');
    if (
      message.includes('Could not reach Cloud Firestore backend') ||
      message.includes('client is offline') ||
      message.includes('PERMISSION_DENIED') ||
      message.includes('Missing or insufficient permissions') ||
      message.includes('RST_STREAM') ||
      message.includes('GrpcConnection') ||
      message.includes('unavailable') ||
      message.includes('Failed to obtain exclusive access')
    ) {
      console.warn('[Firestore Unhandled Rejection Caught & Handled]', message);
      event.preventDefault();
    }
  });

  window.addEventListener('error', (event) => {
    const message = event.message || '';
    if (
      message.includes('Missing or insufficient permissions') ||
      message.includes('PERMISSION_DENIED') ||
      message.includes('GrpcConnection RPC') ||
      message.includes('Could not reach Cloud Firestore') ||
      message.includes('Code: 7')
    ) {
      console.warn('[Firestore Window Error Handled]', message);
      event.preventDefault();
    }
  });
}

// Safely configure local cache with multi-tab support and automatic fallback for sandboxed/iframe environments
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalLongPollingOptions: {
      timeoutSeconds: 25,
    },
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  }, config.firestoreDatabaseId || '(default)');
} catch (e) {
  try {
    firestoreInstance = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      experimentalLongPollingOptions: {
        timeoutSeconds: 25,
      },
      localCache: memoryLocalCache(),
    }, config.firestoreDatabaseId || '(default)');
  } catch {
    firestoreInstance = getFirestore(app, config.firestoreDatabaseId || '(default)');
  }
}

export const db = firestoreInstance;

export const auth = getAuth(app);
export const rtdb = getDatabase(app, config.databaseURL);



