/**
 * Seed script: Generate password hash and insert admin_utama user
 * Run with: node scripts/seed-admin.mjs
 */
const crypto = globalThis.crypto || (await import('crypto')).webcrypto;

async function hashPassword(password) {
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
            salt: encoder.encode("kost-annisa-salt-v1"),
            iterations: 100000,
            hash: 'SHA-256'
        },
        key,
        256
    );
    return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const password = process.argv[2] || 'admin123456';
const hash = await hashPassword(password);
console.log(`Password: ${password}`);
console.log(`Hash: ${hash}`);
console.log('');
console.log('Run this SQL in your D1 database:');
console.log(`UPDATE users SET password_hash = '${hash}' WHERE email = 'fikriabdulloh31@gmail.com';`);
console.log('');
console.log('Or if no user exists yet:');
console.log(`INSERT INTO users (id, email, name, role, is_active, password_hash) VALUES ('usr_admin_utama', 'fikriabdulloh31@gmail.com', 'Fikri', 'admin_utama', 1, '${hash}');`);
