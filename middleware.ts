import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/login', '/approve', '/api/estimate-pdf', '/api/signed-pdf'];
const COOKIE_NAME = 'cc_auth';

// Edge-compatible HMAC check using Web Crypto API
async function isValidSession(token: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const [payload, sig] = parts;

    const secret = process.env.SESSION_SECRET || 'crystal-clear-secret-32-chars-min';
    const keyData = new TextEncoder().encode(secret);
    const key = await crypto.subtle.importKey(
      'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );

    const sigBytes = hexToBytes(sig);
    if (!sigBytes) return false;

    const payloadBytes = new TextEncoder().encode(payload);
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, payloadBytes);
    if (!valid) return false;

    const data = JSON.parse(atob(payload));
    if (!data.authenticated || !data.exp) return false;
    if (Date.now() > data.exp) return false;
    return true;
  } catch {
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array | null {
  try {
    if (hex.length % 2 !== 0) return null;
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }
    return bytes;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Allow static files, images, and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/fonts/') ||
    /\.(png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf)$/.test(pathname) ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }

  // Check authentication
  const cookie = request.cookies.get(COOKIE_NAME);
  const authenticated = cookie ? await isValidSession(cookie.value) : false;

  if (!authenticated) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
