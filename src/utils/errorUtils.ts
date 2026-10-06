/**
 * Error Sanitization Utility for Prople Store
 * Strips raw SDK assertions, internal tokens, stack traces, and database configuration
 * to present clean, professional, human-friendly error messages to users.
 */

export function sanitizeErrorMessage(
  err: unknown,
  fallback = 'Something went wrong. Please check your connection and try again.'
): string {
  if (!err) return fallback;

  let raw = '';
  if (typeof err === 'string') {
    raw = err;
  } else if (err instanceof Error) {
    raw = err.message || '';
  } else if (typeof err === 'object' && err !== null) {
    raw = (err as any).message || (err as any).error || JSON.stringify(err);
  } else {
    raw = String(err);
  }

  const lower = raw.toLowerCase();

  // 1. Filter internal Firestore SDK assertions & persistence exclusive lock errors
  if (
    lower.includes('internal assertion failed') ||
    lower.includes('failed to obtain exclusive access to the persistence layer') ||
    lower.includes('experimentalforceowningtab') ||
    lower.includes('firestore') ||
    lower.includes('firebaseerror') ||
    lower.includes('unexpected state') ||
    lower.includes('b815') ||
    lower.includes('context:')
  ) {
    return 'Database synchronization error. Please retry or refresh the page.';
  }

  // 2. Authentication errors
  if (lower.includes('auth/invalid-credential') || lower.includes('auth/wrong-password') || lower.includes('invalid email or password')) {
    return 'Invalid email or password. Please verify your credentials and try again.';
  }

  if (lower.includes('auth/user-not-found')) {
    return 'No account found with this email address. Please sign up or verify your email.';
  }

  if (lower.includes('auth/too-many-requests') || lower.includes('frequency limit') || lower.includes('rate limit')) {
    return 'Too many attempts. Please wait a few moments before trying again.';
  }

  if (lower.includes('auth/ip-locked') || lower.includes('access denied: your ip address has been locked')) {
    return 'Access temporarily restricted due to security verification policy. Please try again later.';
  }

  if (lower.includes('auth/popup-closed-by-user') || lower.includes('popup was closed')) {
    return 'Sign-in cancelled. Please select your account to continue.';
  }

  if (lower.includes('auth/popup-blocked')) {
    return 'Sign-in popup was blocked by your browser. Please allow popups to continue.';
  }

  if (lower.includes('auth/network-request-failed') || lower.includes('failed to fetch') || lower.includes('network error')) {
    return 'Network connection issue. Please check your internet connection and try again.';
  }

  // Filter provider names and API key leakages
  if (lower.includes('resend') || lower.includes('api key') || lower.includes('apikey') || lower.includes('smtp') || lower.includes('provider')) {
    return 'Unable to deliver verification email at this moment. Please check your email or try signing in with Google.';
  }

  // 3. Serverless invocation & infrastructure failure shielding
  if (
    lower.includes('function_invocation_failed') ||
    lower.includes('bom1::') ||
    lower.includes('iad1::') ||
    lower.includes('sfo1::') ||
    lower.includes('err_module_not_found') ||
    lower.includes('cannot find module') ||
    lower.includes('server returned http 500') ||
    lower.includes('server error has occurred') ||
    lower.includes('internal server error')
  ) {
    return 'Unable to reach the authentication service at this moment. Please try again or continue with Google.';
  }

  if (lower.includes('unauthorized') || lower.includes('permission denied') || lower.includes('forbidden')) {
    return 'Permission denied: You do not have authority to modify this application.';
  }

  // Clean technical prefixes like "Error: ", "Publishing failed: ", etc.
  let cleaned = raw
    .replace(/^Error:\s*/i, '')
    .replace(/^FirebaseError:\s*/i, '')
    .trim();

  // If the error message is a raw JSON payload, replace with fallback
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    return fallback;
  }

  // Cap maximum length of user-facing message to prevent UI stretching
  if (cleaned.length > 150) {
    cleaned = cleaned.slice(0, 150).trim() + '...';
  }

  return cleaned || fallback;
}
