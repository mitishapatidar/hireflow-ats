import { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import crypto from 'crypto';
import { SESSION_COOKIE_NAME } from '@hireflow/shared';

export const CSRF_COOKIE_NAME = 'hireflow_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

function getAllowedOrigins(): string[] {
  const allowed = new Set<string>();

  if (process.env.APP_BASE_URL) {
    try {
      const u = new URL(process.env.APP_BASE_URL);
      allowed.add(u.origin);
    } catch {
      allowed.add(process.env.APP_BASE_URL);
    }
  }

  // Development & test allowed origins
  if (process.env.NODE_ENV !== 'production') {
    allowed.add('http://localhost:3000');
    allowed.add('http://127.0.0.1:3000');
    allowed.add('http://localhost:4000');
    allowed.add('http://127.0.0.1:4000');
  }

  return Array.from(allowed);
}

function extractOrigin(urlStr?: string): string | null {
  if (!urlStr) return null;
  try {
    const u = new URL(urlStr);
    return u.origin;
  } catch {
    return null;
  }
}

const csrfPlugin: FastifyPluginAsync = async (server) => {
  // 1. Endpoint to generate a CSRF token for browser clients
  server.get('/api/auth/csrf', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = crypto.randomBytes(32).toString('hex');
    const isProduction = process.env.NODE_ENV === 'production';

    reply.setCookie(CSRF_COOKIE_NAME, token, {
      path: '/',
      httpOnly: false, // Accessible to client-side JS to read and attach as header
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 3600, // 1 hour
    });

    return reply.status(200).send({
      success: true,
      data: { csrfToken: token },
    });
  });

  // 2. PreHandler Hook: Enforce CSRF protection on state-changing methods
  server.addHook('preValidation', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase();

    // Safe methods do not modify server state
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return;
    }

    // Bearer token clients (APIs / mobile apps) are immune to ambient credential CSRF
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return;
    }

    const allowedOrigins = getAllowedOrigins();
    const originHeader = request.headers.origin as string | undefined;
    const refererHeader = request.headers.referer as string | undefined;

    // Check Origin header if present
    if (originHeader) {
      const normalizedOrigin = extractOrigin(originHeader);
      if (normalizedOrigin && !allowedOrigins.includes(normalizedOrigin)) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'CSRF_INVALID_ORIGIN',
            message: `Cross-site request forgery blocked: Origin '${originHeader}' is not allowed.`,
          },
        });
      }
    }

    // If Origin is missing, check Referer header if present
    if (!originHeader && refererHeader) {
      const refererOrigin = extractOrigin(refererHeader);
      if (refererOrigin && !allowedOrigins.includes(refererOrigin)) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'CSRF_INVALID_REFERER',
            message: `Cross-site request forgery blocked: Referer '${refererHeader}' is not allowed.`,
          },
        });
      }
    }

    // Double-submit token validation for cookie-authenticated browser requests
    const sessionCookie = request.cookies[SESSION_COOKIE_NAME];
    const csrfCookie = request.cookies[CSRF_COOKIE_NAME];
    const csrfHeader = request.headers[CSRF_HEADER_NAME] as string | undefined;

    // If a CSRF cookie was issued to the browser session, enforce matching token
    if (sessionCookie && csrfCookie) {
      if (!csrfHeader || csrfHeader !== csrfCookie) {
        return reply.status(403).send({
          success: false,
          error: {
            code: 'CSRF_TOKEN_MISMATCH',
            message: 'Cross-site request forgery blocked: Invalid or missing CSRF token.',
          },
        });
      }
    }
  });
};

export default fp(csrfPlugin, { name: 'hireflow-csrf' });
