import { createMiddleware } from 'hono/factory';
import { verify } from 'hono/jwt';
import type { D1Database } from '@cloudflare/workers-types';

export type AuthRole = 'admin_utama' | 'admin' | 'petugas';

export type AuthUser = {
    userId: string;
    email: string;
    role: AuthRole;
    name: string | null;
};

type AuthEnv = {
    Bindings: {
        DB: D1Database;
        JWT_SECRET: string;
        [key: string]: unknown;
    };
    Variables: { user: AuthUser };
};

/**
 * Validates JWT token and injects user to context
 */
// Public paths that don't require authentication
const PUBLIC_PATHS = ['/api/login', '/api/health', '/api/forgot-password', '/api/reset-password'];

export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
    // Skip auth for preflight requests
    if (c.req.method === 'OPTIONS') {
        return next();
    }

    // Skip auth for public endpoints
    const path = new URL(c.req.url).pathname;
    if (PUBLIC_PATHS.includes(path)) {
        return next();
    }

    // Allows skipping auth for local development if desired, but here we require token
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authentication header' } }, 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = c.env.JWT_SECRET || 'fallback-secret-for-dev';

    try {
        const payload = await verify(token, secret, "HS256");

        // Also verify the user is still active in DB
        const row = await c.env.DB.prepare(
            'SELECT id, email, name, role, is_active FROM users WHERE id = ?'
        )
            .bind(payload.sub)
            .first<{ id: string; email: string; name: string | null; role: string; is_active: number }>();

        if (!row || !row.is_active) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User account is inactive or not found' } }, 403);
        }

        c.set('user', {
            userId: row.id,
            email: row.email,
            role: row.role as AuthRole,
            name: row.name,
        });

        await next();
    } catch (err) {
        return c.json({ error: { code: 'UNAUTHORIZED', message: 'Token is invalid or expired' } }, 401);
    }
});

/**
 * Role guard factory
 */
export function requireRole(...roles: AuthRole[]) {
    return createMiddleware<AuthEnv>(async (c, next) => {
        const user = c.get('user');
        if (!roles.includes(user.role)) {
            return c.json(
                { error: { code: 'FORBIDDEN', message: `Requires role: ${roles.join(' or ')}` } },
                403
            );
        }
        await next();
    });
}

/**
 * Minimal hash utility for password (PBKDF2)
 */
export async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: 'PBKDF2',
            salt: encoder.encode("kost-annisa-salt-v1"), // static salt for simplicity
            iterations: 100000,
            hash: 'SHA-256'
        },
        key,
        256
    );
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}
