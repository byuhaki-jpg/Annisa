/**
 * Telegram Bot Polling script for local development
 * Forwards updates from Telegram to local worker
 */
const BOT_TOKEN = '8362061761:AAEIAxdwuI4NW9PUeY_FDwNrVW0V-MEVCDg';
const WORKER_URL = 'http://localhost:8787/api/telegram/webhook';

let offset = 0;

async function poll() {
    console.log('🤖 Telegram polling started... Waiting for messages.');
    while (true) {
        try {
            const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=${offset}&timeout=30`);
            const data = await res.json();

            if (data.ok && data.result.length > 0) {
                for (const update of data.result) {
                    offset = update.update_id + 1;
                    console.log(`📨 Update #${update.update_id}:`,
                        update.message?.text || update.message?.photo ? '[photo]' : update.callback_query?.data || '???');

                    // Forward to local worker
                    const fwd = await fetch(WORKER_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(update),
                    });
                    const fwdData = await fwd.json();
                    console.log('  → Worker response:', JSON.stringify(fwdData));
                }
            }
        } catch (err) {
            console.error('Poll error:', err.message);
            await new Promise(r => setTimeout(r, 3000));
        }
    }
}

// Delete any existing webhook first
async function clearWebhook() {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/deleteWebhook`);
    const data = await res.json();
    console.log('Webhook cleared:', data.ok);
}

clearWebhook().then(poll);
