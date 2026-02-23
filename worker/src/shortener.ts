/**
 * URL Shortener for Kost Annisa
 * 
 * Generates short codes and stores mappings in D1.
 * Short URLs: https://s.kosannisa.my.id/{code}
 */

const SHORT_DOMAIN = 'https://s.kosannisa.my.id';
const CODE_LENGTH = 6;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'; // no ambiguous chars

function generateCode(): string {
    const arr = new Uint8Array(CODE_LENGTH);
    crypto.getRandomValues(arr);
    return Array.from(arr, (b) => CHARS[b % CHARS.length]).join('');
}

/**
 * Shorten a URL. If the URL was already shortened, return the existing short URL.
 */
export async function shortenUrl(db: D1Database, longUrl: string): Promise<string> {
    // Check if this URL was already shortened
    const existing = await db
        .prepare('SELECT code FROM short_links WHERE url = ?')
        .bind(longUrl)
        .first<{ code: string }>();

    if (existing) {
        return `${SHORT_DOMAIN}/${existing.code}`;
    }

    // Generate a new unique code
    let code = generateCode();
    let attempts = 0;
    while (attempts < 5) {
        try {
            await db
                .prepare('INSERT INTO short_links (code, url) VALUES (?, ?)')
                .bind(code, longUrl)
                .run();
            return `${SHORT_DOMAIN}/${code}`;
        } catch {
            // Code collision, try again
            code = generateCode();
            attempts++;
        }
    }

    // Fallback: return original URL if shortening fails
    return longUrl;
}

/**
 * Resolve a short code to the original URL.
 */
export async function resolveShortCode(db: D1Database, code: string): Promise<string | null> {
    const row = await db
        .prepare('SELECT url FROM short_links WHERE code = ?')
        .bind(code)
        .first<{ url: string }>();

    return row?.url ?? null;
}
