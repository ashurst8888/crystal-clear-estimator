import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const COOKIE_NAME = 'cc_auth';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecret(): string {
  return process.env.SESSION_SECRET || 'crystal-clear-secret-32-chars-min';
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function encodeSession(data: { authenticated: boolean; exp: number }): string {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64');
  const sig = sign(payload, getSecret());
  return `${payload}.${sig}`;
}

function decodeSession(
  token: string,
): { authenticated: boolean; exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expectedSig = sign(payload, getSecret());

    // Timing-safe comparison
    const sigBuf = Buffer.from(sig, 'hex');
    const expectedBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expectedBuf)) return null;

    const data = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    if (!data.authenticated || !data.exp) return null;
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function createSessionCookie(): string {
  const data = {
    authenticated: true,
    exp: Date.now() + SESSION_TTL_MS,
  };
  return encodeSession(data);
}

export function isAuthenticated(req: NextRequest): boolean {
  const cookie = req.cookies.get(COOKIE_NAME);
  if (!cookie) return false;
  const session = decodeSession(cookie.value);
  return session !== null && session.authenticated === true;
}

export async function isAuthenticatedFromCookies(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(COOKIE_NAME);
    if (!cookie) return false;
    const session = decodeSession(cookie.value);
    return session !== null && session.authenticated === true;
  } catch {
    return false;
  }
}

export function setAuthCookie(response: NextResponse): NextResponse {
  const token = createSessionCookie();
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS / 1000,
    path: '/',
  });
  return response;
}

export function clearAuthCookie(response: NextResponse): NextResponse {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
  return response;
}

export function checkPassword(password: string): boolean {
  const appPassword = process.env.APP_PASSWORD;
  if (!appPassword) return false;
  try {
    const a = Buffer.from(password);
    const b = Buffer.from(appPassword);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
