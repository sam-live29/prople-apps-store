/**
 * Safe JSON Network & Response Parsing Utility
 * 
 * Prevents unhandled "Unexpected token 'T', 'The page c'... is not valid JSON" crashes
 * when network endpoints, proxies, or serverless platforms return HTML or plain-text
 * error messages (such as Vercel "The page could not be found" 404s, Cloudflare pages,
 * or nginx error pages).
 */

export interface SafeFetchResult<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  isHtmlOrTextError?: boolean;
}

/**
 * Safely parse a JSON string with a guaranteed fallback, never throwing syntax errors.
 */
export function safeParseJson<T = any>(raw: string | null | undefined, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  try {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('<') || trimmed.startsWith('The page')) {
      return fallback;
    }
    return JSON.parse(trimmed) as T;
  } catch {
    return fallback;
  }
}

/**
 * Executes a network fetch and safely parses the JSON response.
 * If the response is an HTML error page, plain-text error, 404, or empty string,
 * it returns a structured result without throwing a SyntaxError.
 */
export async function safeFetchJson<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<SafeFetchResult<T>> {
  try {
    const res = await fetch(input, init);
    const status = res.status;
    const contentType = res.headers.get('content-type') || '';
    
    // Read raw response as text first to safely inspect content before parsing
    const rawText = await res.text().catch(() => '');
    const trimmed = (rawText || '').trim();

    // Check if the response is an empty body
    if (!trimmed) {
      return {
        ok: res.ok,
        status,
        data: null,
        error: res.ok ? undefined : `Server returned HTTP ${status} with empty response`,
      };
    }

    // Detect HTML or plain-text error pages (e.g. "The page could not be found", "<!doctype html>", "404:")
    const looksLikeHtml = trimmed.startsWith('<') || trimmed.endsWith('>');
    const looksLikePlainTextError = 
      trimmed.startsWith('The page') || 
      trimmed.startsWith('404:') || 
      trimmed.startsWith('502 ') || 
      trimmed.startsWith('503 ') ||
      trimmed.startsWith('Error:');

    if (looksLikeHtml || looksLikePlainTextError || (!contentType.includes('application/json') && !trimmed.startsWith('{') && !trimmed.startsWith('['))) {
      // Clean up the text message for error reporting
      let cleanSnippet = trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const lowerSnippet = cleanSnippet.toLowerCase();

      // Mask infrastructure, Vercel serverless function crashes, or gateway error tokens
      if (
        lowerSnippet.includes('function_invocation_failed') ||
        lowerSnippet.includes('bom1::') ||
        lowerSnippet.includes('iad1::') ||
        lowerSnippet.includes('sfo1::') ||
        lowerSnippet.includes('err_module_not_found') ||
        lowerSnippet.includes('cannot find module') ||
        lowerSnippet.includes('server error') ||
        lowerSnippet.includes('internal server error') ||
        lowerSnippet.includes('500 internal server error') ||
        lowerSnippet.includes('server returned http 500') ||
        lowerSnippet.includes('an error occurred with this application')
      ) {
        cleanSnippet = 'Unable to reach the authentication service at this moment. Please check your connection or continue with Google.';
      } else if (cleanSnippet.length > 120) {
        cleanSnippet = cleanSnippet.slice(0, 120).trim();
      }

      return {
        ok: false,
        status,
        data: null,
        error: cleanSnippet || `Unable to reach the service at this moment. (HTTP ${status})`,
        isHtmlOrTextError: true,
      };
    }

    // Attempt to parse JSON safely
    try {
      const data = JSON.parse(trimmed) as T;
      let parsedError: string | undefined = undefined;

      if (!res.ok) {
        const rawErr = (data as any)?.error || (data as any)?.message || `Server returned HTTP ${status}`;
        const strErr = typeof rawErr === 'string' ? rawErr : JSON.stringify(rawErr);
        const lowerErr = strErr.toLowerCase();

        if (
          lowerErr.includes('function_invocation_failed') ||
          lowerErr.includes('bom1::') ||
          lowerErr.includes('iad1::') ||
          lowerErr.includes('sfo1::') ||
          lowerErr.includes('err_module_not_found') ||
          lowerErr.includes('cannot find module') ||
          lowerErr.includes('server error') ||
          lowerErr.includes('internal server error') ||
          lowerErr.includes('http 500')
        ) {
          parsedError = 'Unable to reach the authentication service at this moment. Please check your connection or continue with Google.';
        } else {
          parsedError = strErr;
        }
      }

      return {
        ok: res.ok,
        status,
        data,
        error: parsedError,
      };
    } catch {
      return {
        ok: false,
        status,
        data: null,
        error: `Unable to process server response (HTTP ${status})`,
        isHtmlOrTextError: true,
      };
    }
  } catch (netErr: any) {
    const rawMsg = netErr?.message || 'Network connection failed';
    const friendlyMsg = rawMsg.toLowerCase().includes('failed to fetch')
      ? 'Unable to connect to authentication service. Please check your internet connection or try again.'
      : rawMsg;
    return {
      ok: false,
      status: 0,
      data: null,
      error: friendlyMsg,
    };
  }
}
