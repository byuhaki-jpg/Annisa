/**
 * Telegram Bot Handler for Kost Annisa
 * 
 * Features:
 * - Photo receipt analysis via Gemini AI
 * - Text-based expense/income input
 * - /saldo, /laporan commands
 * - Inline confirm/cancel buttons
 */

const CATEGORY_MAP: Record<string, string> = {
    listrik: 'listrik',
    pln: 'listrik',
    air: 'air',
    pdam: 'air',
    wifi: 'wifi',
    internet: 'wifi',
    kebersihan: 'kebersihan',
    sampah: 'kebersihan',
    perbaikan: 'perbaikan',
    maintenance: 'perbaikan',
    renovasi: 'perbaikan',
    lainnya: 'lainnya',
    gaji: 'gaji',
    sewa: 'lainnya',
    modal: 'modal',
};

// ── Telegram API helpers ─────────────────────────

async function tgApi(token: string, method: string, body?: any) {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
    return res.json() as Promise<any>;
}

async function sendMessage(token: string, chatId: number, text: string, replyMarkup?: any) {
    return tgApi(token, 'sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
    });
}

async function answerCallback(token: string, callbackId: string, text?: string) {
    return tgApi(token, 'answerCallbackQuery', {
        callback_query_id: callbackId,
        text,
    });
}

async function editMessage(token: string, chatId: number, messageId: number, text: string) {
    return tgApi(token, 'editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
    });
}

// ── AI helpers (Groq primary, Gemini fallback) ───

const RECEIPT_PROMPT = `Kamu adalah asisten keuangan kos-kosan di Indonesia. Analisa foto nota/struk/kwitansi ini dan ekstrak SEMUA item yang tertulis di nota.

Kembalikan dalam format JSON:
{
  "type": "expense" atau "income",
  "category": salah satu dari: listrik, air, wifi, kebersihan, perbaikan, gaji, modal, lainnya,
  "amount": total keseluruhan (angka tanpa titik/koma, contoh: 150000),
  "store": nama toko/penjual (jika terlihat),
  "date": tanggal di nota format YYYY-MM-DD (jika terlihat),
  "items": [
    { "name": "nama barang", "qty": jumlah, "unit": "satuan (kg/pcs/ltr/dll)", "price": harga satuan, "subtotal": harga total item }
  ],
  "confidence": "high" atau "low"
}

PENTING:
- Tulis SEMUA item yang ada di nota, jangan diringkas
- Jika harga satuan tidak tertulis tapi subtotal ada, isi price = subtotal / qty
- Jika hanya ada 1 item tanpa qty, isi qty = 1
- Pastikan jumlah semua subtotal = amount (total)

Jika tidak bisa membaca nota, kembalikan: {"error": "Tidak bisa membaca nota"}
Jawab HANYA dengan JSON, tanpa teks lain.`;

function buildTextPrompt(text: string): string {
    return `Kamu adalah asisten keuangan kos-kosan di Indonesia. Parse pesan berikut menjadi transaksi keuangan dalam format JSON:
{
  "type": "expense" atau "income",
  "category": salah satu dari: listrik, air, wifi, kebersihan, perbaikan, gaji, modal, lainnya,
  "amount": angka (contoh: 150000. "150rb" = 150000, "1.5jt" = 1500000),
  "notes": deskripsi singkat
}
Pesan: "${text}"
Petunjuk: "pengeluaran"/"keluar"/"bayar" = expense, "pemasukan"/"masuk"/"terima" = income.
Jawab HANYA dengan JSON.`;
}

function extractTransaction(responseText: string, originalText?: string): ParsedTransaction {
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI tidak bisa membaca');
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.error) throw new Error(parsed.error);

    // Build detailed notes from items array
    let notes = parsed.notes || originalText || '';
    const items: ReceiptItem[] = [];

    if (Array.isArray(parsed.items) && parsed.items.length > 0) {
        for (const item of parsed.items) {
            items.push({
                name: item.name || 'Item',
                qty: Number(item.qty) || 1,
                unit: item.unit || 'pcs',
                price: Number(item.price) || 0,
                subtotal: Number(item.subtotal) || Number(item.price) || 0,
            });
        }
        // Build notes from items: "1kg No Drop (Rp 67.000), 3 Serat @Rp 5.000 (Rp 15.000)"
        notes = items.map(i => {
            const qtyStr = i.qty > 1 ? `${i.qty}${i.unit !== 'pcs' ? i.unit : 'x'}` : '';
            const priceStr = i.qty > 1 ? ` @Rp ${i.price.toLocaleString('id-ID')}` : '';
            return `${qtyStr} ${i.name}${priceStr} (Rp ${i.subtotal.toLocaleString('id-ID')})`;
        }).join(', ').trim();
    }

    return {
        type: parsed.type === 'income' ? 'income' : 'expense',
        category: parsed.category || 'lainnya',
        amount: Number(parsed.amount) || 0,
        notes,
        confidence: parsed.confidence || 'low',
        items: items.length > 0 ? items : undefined,
        store: parsed.store || undefined,
    };
}

// ── Groq API ─────────────────────────────────────

async function groqChat(apiKey: string, messages: any[], model = 'meta-llama/llama-4-scout-17b-16e-instruct'): Promise<string> {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: 500,
            temperature: 0.1,
        }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Groq error: ${err}`);
    }
    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content || '';
}

async function parseTextWithGroq(apiKey: string, text: string): Promise<ParsedTransaction> {
    const content = await groqChat(apiKey, [
        { role: 'user', content: buildTextPrompt(text) },
    ]);
    return extractTransaction(content, text);
}

// ── Groq Vision (receipt image analysis) ─────────

async function analyzeWithGroqVision(apiKey: string, imageBase64: string): Promise<ParsedTransaction> {
    const content = await groqChat(apiKey, [
        {
            role: 'user',
            content: [
                { type: 'text', text: RECEIPT_PROMPT },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ],
        },
    ], 'meta-llama/llama-4-scout-17b-16e-instruct');
    return extractTransaction(content);
}

export interface ReceiptItem {
    name: string;
    qty: number;
    unit: string;
    price: number;
    subtotal: number;
}

export interface ParsedTransaction {
    type: 'expense' | 'income';
    category: string;
    amount: number;
    notes: string;
    confidence?: string;
    items?: ReceiptItem[];
    store?: string;
    receipt_key?: string;
}

export async function analyzeReceiptImage(groqKey: string, imageBase64: string): Promise<ParsedTransaction> {
    if (groqKey) {
        return await analyzeWithGroqVision(groqKey, imageBase64);
    }
    throw new Error('Groq API key belum dikonfigurasi. Atur di menu Pengaturan.');
}

async function parseTextMessage(groqKey: string, text: string): Promise<ParsedTransaction> {
    if (groqKey) {
        return await parseTextWithGroq(groqKey, text);
    }
    throw new Error('Groq API key belum dikonfigurasi');
}

// ── Types ────────────────────────────────────────


interface TelegramDeps {
    botToken: string;
    groqKey: string;
    db: D1Database;
    propertyId: string;
    appsScriptUrl?: string;
    workerUrl?: string;
    sheetsSync?: (type: string, category: string, amount: number, method: string, notes: string, createdBy: string, receiptUrl?: string) => Promise<void>;
}


// ── Pending transactions store (in-memory per request, stored in D1) ──

async function storePending(db: D1Database, chatId: number, tx: ParsedTransaction) {
    const id = `pending_${chatId}_${Date.now()}`;
    await db.prepare(
        `INSERT OR REPLACE INTO kv_store (key, value, expires_at) VALUES (?, ?, datetime('now', '+10 minutes'))`
    ).bind(id, JSON.stringify(tx)).run().catch(() => { });
    return id;
}

async function getPending(db: D1Database, pendingId: string): Promise<ParsedTransaction | null> {
    const row: any = await db.prepare(
        `SELECT value FROM kv_store WHERE key = ? AND expires_at > datetime('now')`
    ).bind(pendingId).first().catch(() => null);
    if (!row?.value) return null;
    return JSON.parse(row.value);
}

async function deletePending(db: D1Database, pendingId: string) {
    await db.prepare(`DELETE FROM kv_store WHERE key = ?`).bind(pendingId).run().catch(() => { });
}

// ── Edit mode helpers ────────────────────────────

interface EditMode {
    pendingId: string;
    field: 'category' | 'amount' | 'notes';
}

async function storeEditMode(db: D1Database, chatId: number, mode: EditMode) {
    const key = `editmode_${chatId}`;
    await db.prepare(
        `INSERT OR REPLACE INTO kv_store (key, value, expires_at) VALUES (?, ?, datetime('now', '+5 minutes'))`
    ).bind(key, JSON.stringify(mode)).run().catch(() => { });
}

async function getEditMode(db: D1Database, chatId: number): Promise<EditMode | null> {
    const key = `editmode_${chatId}`;
    const row: any = await db.prepare(
        `SELECT value FROM kv_store WHERE key = ? AND expires_at > datetime('now')`
    ).bind(key).first().catch(() => null);
    if (!row?.value) return null;
    return JSON.parse(row.value);
}

async function clearEditMode(db: D1Database, chatId: number) {
    const key = `editmode_${chatId}`;
    await db.prepare(`DELETE FROM kv_store WHERE key = ?`).bind(key).run().catch(() => { });
}

async function updatePendingField(db: D1Database, pendingId: string, field: string, value: any): Promise<ParsedTransaction | null> {
    const tx = await getPending(db, pendingId);
    if (!tx) return null;
    (tx as any)[field] = value;
    // Rebuild notes if editing notes (clear items since user manually wrote notes)
    if (field === 'notes') {
        tx.items = undefined;
    }
    await db.prepare(
        `INSERT OR REPLACE INTO kv_store (key, value, expires_at) VALUES (?, ?, datetime('now', '+10 minutes'))`
    ).bind(pendingId, JSON.stringify(tx)).run().catch(() => { });
    return tx;
}

// ── Main handler ─────────────────────────────────

export async function handleTelegramUpdate(update: any, deps: TelegramDeps) {
    try {
        if (update.callback_query) {
            await handleCallback(update.callback_query, deps);
            return;
        }

        const msg = update.message;
        if (!msg) return;

        const chatId = msg.chat.id;
        const text = msg.text || '';

        // Check if user is in edit mode (waiting for typed input)
        if (text.trim() && !text.startsWith('/')) {
            const editMode = await getEditMode(deps.db, chatId);
            if (editMode) {
                await handleEditInput(chatId, text, editMode, deps);
                return;
            }
        }

        // Commands
        if (text.startsWith('/')) {
            await handleCommand(chatId, text, deps);
            return;
        }

        // Photo
        if (msg.photo && msg.photo.length > 0) {
            await handlePhoto(chatId, msg, deps);
            return;
        }

        // Text message
        if (text.trim()) {
            await handleText(chatId, text, deps);
            return;
        }

        await sendMessage(deps.botToken, chatId, '🤔 Kirim foto nota atau ketik transaksi. Contoh:\n<code>pengeluaran listrik 150rb</code>');
    } catch (err: any) {
        console.error('[Telegram Error]', err.message || err);
    }
}

// ── Command handler ──────────────────────────────

async function handleCommand(chatId: number, text: string, deps: TelegramDeps) {
    const cmd = text.split(' ')[0].toLowerCase().replace('@', '');

    switch (cmd) {
        case '/start':
            await sendMessage(deps.botToken, chatId,
                `🏠 <b>Kost Annisa Bot</b>\n\n` +
                `Saya membantu mencatat keuangan kos Anda.\n\n` +
                `<b>📸 Kirim Foto</b> — Foto nota/struk untuk analisa otomatis\n` +
                `<b>✍️ Ketik Manual</b> — Contoh:\n` +
                `<code>pengeluaran listrik 150rb</code>\n` +
                `<code>pemasukan sewa 500rb</code>\n\n` +
                `<b>📊 Perintah:</b>\n` +
                `/saldo — Lihat saldo kas\n` +
                `/laporan — Ringkasan bulan ini\n` +
                `/bantuan — Panduan lengkap`
            );
            break;

        case '/saldo':
            await handleSaldo(chatId, deps);
            break;

        case '/laporan':
            await handleLaporan(chatId, deps);
            break;

        case '/bantuan':
        case '/help':
            await sendMessage(deps.botToken, chatId,
                `📖 <b>Panduan Penggunaan</b>\n\n` +
                `<b>1. Catat Pengeluaran</b>\n` +
                `Ketik: <code>pengeluaran [kategori] [jumlah] [catatan]</code>\n` +
                `Contoh: <code>pengeluaran listrik 285000</code>\n\n` +
                `<b>2. Catat Pemasukan</b>\n` +
                `Ketik: <code>pemasukan [kategori] [jumlah]</code>\n` +
                `Contoh: <code>pemasukan modal 1jt</code>\n\n` +
                `<b>3. Kirim Foto Nota</b>\n` +
                `Kirim foto struk/nota/kwitansi → AI akan analisa otomatis\n\n` +
                `<b>Kategori:</b> listrik, air, wifi, kebersihan, perbaikan, gaji, modal, lainnya\n\n` +
                `<b>Format Jumlah:</b>\n` +
                `• 150000 atau 150rb atau 150k\n` +
                `• 1500000 atau 1.5jt atau 1,5jt`
            );
            break;

        default:
            await sendMessage(deps.botToken, chatId, '❓ Perintah tidak dikenal. Ketik /bantuan untuk panduan.');
    }
}

// ── Saldo handler ────────────────────────────────

async function handleSaldo(chatId: number, deps: TelegramDeps) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const income: any = await deps.db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE property_id = ? AND expense_date LIKE ? AND status = 'confirmed' AND type = 'income'`
    ).bind(deps.propertyId, `${period}%`).first();

    const expense: any = await deps.db.prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE property_id = ? AND expense_date LIKE ? AND status = 'confirmed' AND type = 'expense'`
    ).bind(deps.propertyId, `${period}%`).first();

    const incomeTotal = income?.total || 0;
    const expenseTotal = expense?.total || 0;
    const saldo = incomeTotal - expenseTotal;

    const emoji = saldo >= 0 ? '💚' : '🔴';

    await sendMessage(deps.botToken, chatId,
        `📊 <b>Saldo Kas — ${period}</b>\n\n` +
        `💰 Pemasukan: <b>Rp ${incomeTotal.toLocaleString('id-ID')}</b>\n` +
        `💸 Pengeluaran: <b>Rp ${expenseTotal.toLocaleString('id-ID')}</b>\n` +
        `${emoji} Saldo: <b>Rp ${saldo.toLocaleString('id-ID')}</b>`
    );
}

// ── Laporan handler ──────────────────────────────

async function handleLaporan(chatId: number, deps: TelegramDeps) {
    const now = new Date();
    const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const breakdown: any = await deps.db.prepare(
        `SELECT category, type, SUM(amount) AS total, COUNT(*) AS cnt FROM expenses
         WHERE property_id = ? AND expense_date LIKE ? AND status = 'confirmed'
         GROUP BY category, type ORDER BY type, total DESC`
    ).bind(deps.propertyId, `${period}%`).all();

    const rows = breakdown?.results || [];
    if (rows.length === 0) {
        await sendMessage(deps.botToken, chatId, `📋 Belum ada transaksi bulan ini (${period}).`);
        return;
    }

    let incomeLines = '';
    let expenseLines = '';
    let totalIncome = 0;
    let totalExpense = 0;

    for (const r of rows) {
        const line = `  • ${r.category}: Rp ${Number(r.total).toLocaleString('id-ID')} (${r.cnt}x)\n`;
        if (r.type === 'income') {
            incomeLines += line;
            totalIncome += Number(r.total);
        } else {
            expenseLines += line;
            totalExpense += Number(r.total);
        }
    }

    let msg = `📋 <b>Laporan Bulan ${period}</b>\n\n`;
    if (incomeLines) msg += `💰 <b>Pemasukan</b>\n${incomeLines}\n`;
    if (expenseLines) msg += `💸 <b>Pengeluaran</b>\n${expenseLines}\n`;
    msg += `━━━━━━━━━━━━━━━━\n`;
    msg += `💰 Total Masuk: <b>Rp ${totalIncome.toLocaleString('id-ID')}</b>\n`;
    msg += `💸 Total Keluar: <b>Rp ${totalExpense.toLocaleString('id-ID')}</b>\n`;
    msg += `📊 Saldo: <b>Rp ${(totalIncome - totalExpense).toLocaleString('id-ID')}</b>`;

    await sendMessage(deps.botToken, chatId, msg);
}

// ── Photo handler ────────────────────────────────

async function handlePhoto(chatId: number, msg: any, deps: TelegramDeps) {
    await sendMessage(deps.botToken, chatId, '🔍 Menganalisa foto nota...');

    // Get largest photo
    const photo = msg.photo[msg.photo.length - 1];
    const fileInfo = await tgApi(deps.botToken, 'getFile', { file_id: photo.file_id });
    const filePath = fileInfo?.result?.file_path;
    if (!filePath) {
        await sendMessage(deps.botToken, chatId, '❌ Gagal mengunduh foto.');
        return;
    }

    // Download file
    const fileUrl = `https://api.telegram.org/file/bot${deps.botToken}/${filePath}`;
    const fileRes = await fetch(fileUrl);
    const fileBuffer = await fileRes.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

    // Upload photo to Google Drive
    let receiptKey: string | undefined;
    if (deps.appsScriptUrl) {
        try {
            const ext = filePath.endsWith('.png') ? 'png' : 'jpg';
            const filename = `tg_${Date.now().toString(36)}.${ext}`;
            const contentType = `image/${ext === 'png' ? 'png' : 'jpeg'}`;

            const params = new URLSearchParams();
            params.append('fileData', base64);
            params.append('mimeType', contentType);
            params.append('fileName', filename);

            const response = await fetch(deps.appsScriptUrl, {
                method: 'POST',
                body: params.toString(),
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const resultText = await response.text();
            let resultData: any = {};
            try {
                resultData = JSON.parse(resultText);
            } catch {
                throw new Error(`Apps Script invalid response: ${resultText}`);
            }

            if (resultData.status === 'success') {
                receiptKey = resultData.url;
            } else {
                console.error('[Drive Upload Error]', resultData.message);
            }
        } catch (err) {
            console.error('[Drive Upload Error]', err);
            receiptKey = undefined;
        }
    }

    try {
        const tx = await analyzeReceiptImage(deps.groqKey, base64);

        if (tx.amount <= 0) {
            await sendMessage(deps.botToken, chatId, '❌ Tidak bisa mendeteksi jumlah dari nota. Coba ketik manual.');
            return;
        }

        // Attach receipt key to transaction
        tx.receipt_key = receiptKey;

        // Store pending and show confirmation
        const pendingId = await storePending(deps.db, chatId, tx);
        await showConfirmation(chatId, tx, pendingId, deps);
    } catch (err: any) {
        console.error('[TG Photo Error]', err.message || err);
        const userMsg = err.message?.includes('API key')
            ? err.message
            : 'Gagal membaca nota. Coba foto lebih jelas atau ketik manual.';
        await sendMessage(deps.botToken, chatId, `❌ ${userMsg}`);
    }
}

// ── Regex-based text parser (no AI needed) ───────

function parseAmountString(s: string): number {
    s = s.toLowerCase().replace(/\./g, '').replace(/,/g, '.').trim();
    // Handle "150rb", "150k"
    let match = s.match(/^(\d+(?:\.\d+)?)\s*(rb|ribu|k)$/i);
    if (match) return Math.round(parseFloat(match[1]) * 1000);
    // Handle "1.5jt", "1jt", "1,5jt"
    match = s.match(/^(\d+(?:\.\d+)?)\s*(jt|juta)$/i);
    if (match) return Math.round(parseFloat(match[1]) * 1000000);
    // Plain number
    const num = parseInt(s.replace(/\D/g, ''), 10);
    return isNaN(num) ? 0 : num;
}

function regexParseText(text: string): ParsedTransaction | null {
    const lower = text.toLowerCase().trim();

    // Determine type
    let type: 'income' | 'expense' = 'expense';
    if (/^(pemasukan|masuk|terima|income)/i.test(lower)) type = 'income';

    // Find amount — look for numbers with optional rb/jt suffix
    const amountMatch = lower.match(/(\d[\d.,]*\s*(?:rb|ribu|k|jt|juta)?)/i);
    if (!amountMatch) return null;
    const amount = parseAmountString(amountMatch[1]);
    if (amount <= 0) return null;

    // Find category
    let category = 'lainnya';
    const words = lower.split(/\s+/);
    for (const w of words) {
        if (CATEGORY_MAP[w]) {
            category = CATEGORY_MAP[w];
            break;
        }
    }

    // Notes — everything after type keyword, minus amount
    const notes = text.replace(/^(pengeluaran|pemasukan|masuk|keluar|bayar|terima)\s*/i, '')
        .replace(amountMatch[0], '')
        .replace(category, '')
        .trim() || `${category} ${amount}`;

    return { type, category, amount, notes: notes || category };
}

// ── Text handler ─────────────────────────────────

async function handleText(chatId: number, text: string, deps: TelegramDeps) {
    // Try regex parser first (instant, no API call)
    const regexResult = regexParseText(text);
    if (regexResult && regexResult.amount > 0) {
        const pendingId = await storePending(deps.db, chatId, regexResult);
        await showConfirmation(chatId, regexResult, pendingId, deps);
        return;
    }

    // Fall back to AI parser
    try {
        const tx = await parseTextMessage(deps.groqKey, text);

        if (tx.amount <= 0) {
            await sendMessage(deps.botToken, chatId, '❌ Jumlah tidak terdeteksi. Contoh: <code>pengeluaran listrik 150rb</code>');
            return;
        }

        const pendingId = await storePending(deps.db, chatId, tx);
        await showConfirmation(chatId, tx, pendingId, deps);
    } catch (err: any) {
        console.error('[TG Text Error]', err.message || err);
        await sendMessage(deps.botToken, chatId,
            `❌ Tidak bisa memahami pesan.\n\nContoh format:\n<code>pengeluaran listrik 150rb</code>\n<code>pemasukan modal 1jt</code>`
        );
    }
}

// ── Show confirmation ────────────────────────────

async function showConfirmation(chatId: number, tx: ParsedTransaction, pendingId: string, deps: TelegramDeps) {
    const typeEmoji = tx.type === 'income' ? '💰' : '💸';
    const typeLabel = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
    const confidenceNote = tx.confidence === 'low' ? '\n⚠️ <i>Confidence rendah, periksa data</i>' : '';

    let msg =
        `${typeEmoji} <b>Transaksi Terdeteksi</b>\n\n` +
        `📋 Jenis: <b>${typeLabel}</b>\n` +
        `📁 Kategori: <b>${tx.category}</b>\n`;

    if (tx.store) {
        msg += `🏪 Toko: <b>${tx.store}</b>\n`;
    }

    if (tx.receipt_key) {
        msg += `📎 Bukti nota tersimpan\n`;
    }

    msg += `💰 Total: <b>Rp ${tx.amount.toLocaleString('id-ID')}</b>\n`;

    // Show itemized breakdown if available
    if (tx.items && tx.items.length > 0) {
        msg += `\n📦 <b>Rincian:</b>\n`;
        for (const item of tx.items) {
            const qtyStr = item.qty > 1
                ? `${item.qty}${item.unit !== 'pcs' ? ' ' + item.unit : 'x'}`
                : '';
            const priceStr = item.qty > 1
                ? ` @Rp ${item.price.toLocaleString('id-ID')}`
                : '';
            msg += `  • ${qtyStr} ${item.name}${priceStr} — <b>Rp ${item.subtotal.toLocaleString('id-ID')}</b>\n`;
        }
    } else {
        msg += `📝 Catatan: ${tx.notes}\n`;
    }

    msg += `${confidenceNote}\n\nSimpan transaksi ini?`;

    await sendMessage(deps.botToken, chatId, msg, {
        inline_keyboard: [
            [
                { text: '✅ Simpan', callback_data: `save:${pendingId}` },
                { text: '✏️ Edit', callback_data: `edit:${pendingId}` },
                { text: '❌ Batal', callback_data: `cancel:${pendingId}` },
            ],
        ],
    });
}

// ── Callback handler (button clicks) ─────────────

async function handleCallback(query: any, deps: TelegramDeps) {
    const chatId = query.message.chat.id;
    const messageId = query.message.message_id;
    const data = query.data || '';

    // Parse callback data — format: action:pendingId or action:pendingId:extra
    const parts = data.split(':');
    const action = parts[0];
    const pendingId = parts[1] || '';
    const extra = parts[2] || '';

    if (action === 'cancel') {
        await deletePending(deps.db, pendingId);
        await clearEditMode(deps.db, chatId);
        await answerCallback(deps.botToken, query.id, 'Dibatalkan');
        await editMessage(deps.botToken, chatId, messageId, '❌ Transaksi dibatalkan.');
        return;
    }

    // ── Edit: show field selection ────────────────
    if (action === 'edit') {
        const tx = await getPending(deps.db, pendingId);
        if (!tx) {
            await answerCallback(deps.botToken, query.id, 'Data kedaluwarsa');
            return;
        }
        await answerCallback(deps.botToken, query.id);
        await sendMessage(deps.botToken, chatId, '✏️ <b>Mau edit apa?</b>', {
            inline_keyboard: [
                [
                    { text: '📁 Kategori', callback_data: `ecat:${pendingId}` },
                    { text: '💰 Jumlah', callback_data: `eamt:${pendingId}` },
                ],
                [
                    { text: '📝 Catatan', callback_data: `enote:${pendingId}` },
                    { text: '↩️ Kembali', callback_data: `eback:${pendingId}` },
                ],
            ],
        });
        return;
    }

    // ── Edit Category: show category buttons ──────
    if (action === 'ecat') {
        await answerCallback(deps.botToken, query.id);
        await sendMessage(deps.botToken, chatId, '📁 <b>Pilih kategori:</b>', {
            inline_keyboard: [
                [
                    { text: '⚡ Listrik', callback_data: `scat:${pendingId}:listrik` },
                    { text: '💧 Air', callback_data: `scat:${pendingId}:air` },
                    { text: '📶 WiFi', callback_data: `scat:${pendingId}:wifi` },
                ],
                [
                    { text: '🧹 Kebersihan', callback_data: `scat:${pendingId}:kebersihan` },
                    { text: '🔧 Perbaikan', callback_data: `scat:${pendingId}:perbaikan` },
                    { text: '💼 Gaji', callback_data: `scat:${pendingId}:gaji` },
                ],
                [
                    { text: '🏦 Modal', callback_data: `scat:${pendingId}:modal` },
                    { text: '📦 Lainnya', callback_data: `scat:${pendingId}:lainnya` },
                ],
                [
                    { text: '↩️ Kembali', callback_data: `eback:${pendingId}` },
                ],
            ],
        });
        return;
    }

    // ── Set Category (from button click) ──────────
    if (action === 'scat') {
        const newCategory = extra;
        const tx = await updatePendingField(deps.db, pendingId, 'category', newCategory);
        if (!tx) {
            await answerCallback(deps.botToken, query.id, 'Data kedaluwarsa');
            return;
        }
        await answerCallback(deps.botToken, query.id, `Kategori → ${newCategory}`);
        await showConfirmation(chatId, tx, pendingId, deps);
        return;
    }

    // ── Edit Amount: ask user to type ─────────────
    if (action === 'eamt') {
        await storeEditMode(deps.db, chatId, { pendingId, field: 'amount' });
        await answerCallback(deps.botToken, query.id);
        await sendMessage(deps.botToken, chatId,
            '💰 <b>Ketik jumlah baru:</b>\n\n' +
            'Contoh: <code>82000</code> atau <code>82rb</code> atau <code>1.5jt</code>'
        );
        return;
    }

    // ── Edit Notes: ask user to type ──────────────
    if (action === 'enote') {
        await storeEditMode(deps.db, chatId, { pendingId, field: 'notes' });
        await answerCallback(deps.botToken, query.id);
        await sendMessage(deps.botToken, chatId,
            '📝 <b>Ketik catatan baru:</b>\n\n' +
            'Contoh: <code>1kg No Drop (Rp 67.000), 3 Serat @Rp 5.000 (Rp 15.000)</code>'
        );
        return;
    }

    // ── Back: re-show confirmation ────────────────
    if (action === 'eback') {
        const tx = await getPending(deps.db, pendingId);
        if (!tx) {
            await answerCallback(deps.botToken, query.id, 'Data kedaluwarsa');
            return;
        }
        await answerCallback(deps.botToken, query.id);
        await showConfirmation(chatId, tx, pendingId, deps);
        return;
    }

    if (action === 'save') {
        const tx = await getPending(deps.db, pendingId);
        if (!tx) {
            await answerCallback(deps.botToken, query.id, 'Data sudah kedaluwarsa');
            await editMessage(deps.botToken, chatId, messageId, '⏰ Data sudah kedaluwarsa. Silakan input ulang.');
            return;
        }

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        // Build receipt URL for sheets (Drive URL is already absolute)
        const receiptUrl: string | undefined = tx.receipt_key;

        // If items exist, save each item as a separate expense
        const expIds: string[] = [];
        if (tx.items && tx.items.length > 1) {
            for (const item of tx.items) {
                const expId = `exp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
                const itemNotes = `${item.qty > 1 ? item.qty + (item.unit !== 'pcs' ? ' ' + item.unit : 'x') + ' ' : ''}${item.name}`;
                await deps.db.prepare(
                    `INSERT INTO expenses (id, property_id, expense_date, category, amount, method, receipt_key, notes, status, type, created_by)
                     VALUES (?, ?, ?, ?, ?, 'cash', ?, ?, 'confirmed', ?, 'telegram_bot')`
                ).bind(expId, deps.propertyId, dateStr, tx.category, item.subtotal, tx.receipt_key || null, itemNotes, tx.type).run();
                expIds.push(expId);

                // Sync each item to sheets
                if (deps.sheetsSync) {
                    try {
                        await deps.sheetsSync(tx.type, tx.category, item.subtotal, 'cash', itemNotes, 'telegram_bot', receiptUrl);
                    } catch (e) {
                        console.error('[Sheets sync item]', e);
                    }
                }
            }
        } else {
            // Single item or no items — save as one entry
            const expId = `exp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            await deps.db.prepare(
                `INSERT INTO expenses (id, property_id, expense_date, category, amount, method, receipt_key, notes, status, type, created_by)
                 VALUES (?, ?, ?, ?, ?, 'cash', ?, ?, 'confirmed', ?, 'telegram_bot')`
            ).bind(expId, deps.propertyId, dateStr, tx.category, tx.amount, tx.receipt_key || null, tx.notes, tx.type).run();
            expIds.push(expId);

            if (deps.sheetsSync) {
                try {
                    await deps.sheetsSync(tx.type, tx.category, tx.amount, 'cash', tx.notes, 'telegram_bot', receiptUrl);
                } catch (e) {
                    console.error('[Sheets sync from TG]', e);
                }
            }
        }

        await deletePending(deps.db, pendingId);
        await clearEditMode(deps.db, chatId);
        await answerCallback(deps.botToken, query.id, '✅ Tersimpan!');

        const typeLabel = tx.type === 'income' ? 'Pemasukan' : 'Pengeluaran';
        let savedMsg =
            `✅ <b>Tersimpan!</b>\n\n` +
            `📋 ${typeLabel} — ${tx.category}\n`;
        if (tx.store) savedMsg += `🏪 ${tx.store}\n`;
        if (tx.receipt_key) savedMsg += `📎 Bukti nota tersimpan\n`;

        if (tx.items && tx.items.length > 1) {
            savedMsg += `\n📦 ${tx.items.length} item disimpan:\n`;
            for (let i = 0; i < tx.items.length; i++) {
                const item = tx.items[i];
                const qtyStr = item.qty > 1 ? `${item.qty}${item.unit !== 'pcs' ? ' ' + item.unit : 'x'} ` : '';
                savedMsg += `  • ${qtyStr}${item.name} — Rp ${item.subtotal.toLocaleString('id-ID')}\n`;
            }
            savedMsg += `\n💰 Total: <b>Rp ${tx.amount.toLocaleString('id-ID')}</b>\n`;
            savedMsg += `🆔 ${expIds.length} entries: ${expIds.join(', ')}`;
        } else {
            savedMsg += `💰 Rp ${tx.amount.toLocaleString('id-ID')}\n`;
            savedMsg += `📝 ${tx.notes}\n`;
            savedMsg += `🆔 ${expIds[0]}`;
        }

        await editMessage(deps.botToken, chatId, messageId, savedMsg);
    }
}

// ── Handle edit input (user typed new value) ─────

async function handleEditInput(chatId: number, text: string, editMode: EditMode, deps: TelegramDeps) {
    await clearEditMode(deps.db, chatId);

    let value: any = text.trim();

    if (editMode.field === 'amount') {
        value = parseAmountString(value);
        if (value <= 0) {
            await sendMessage(deps.botToken, chatId, '❌ Jumlah tidak valid. Coba lagi: <code>82000</code> atau <code>82rb</code>');
            await storeEditMode(deps.db, chatId, editMode); // re-enter edit mode
            return;
        }
    }

    const tx = await updatePendingField(deps.db, editMode.pendingId, editMode.field, value);
    if (!tx) {
        await sendMessage(deps.botToken, chatId, '⏰ Data sudah kedaluwarsa. Silakan input ulang.');
        return;
    }

    const fieldLabel = editMode.field === 'category' ? 'Kategori' : editMode.field === 'amount' ? 'Jumlah' : 'Catatan';
    await sendMessage(deps.botToken, chatId, `✅ ${fieldLabel} berhasil diubah!`);
    await showConfirmation(chatId, tx, editMode.pendingId, deps);
}
