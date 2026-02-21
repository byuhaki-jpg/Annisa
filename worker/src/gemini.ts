/**
 * Gemini Vision API integration for receipt OCR
 */

export type OcrResult = {
    merchant_name: string | null;
    transaction_date: string | null;
    total_amount: number | null;
    suggested_category: string | null;
    confidence: number;
    notes: string | null;
    raw_json: string;
};

const CATEGORY_MAP: Record<string, string> = {
    electricity: 'listrik',
    electric: 'listrik',
    listrik: 'listrik',
    pln: 'listrik',
    water: 'air',
    pdam: 'air',
    air: 'air',
    internet: 'wifi',
    wifi: 'wifi',
    cleaning: 'kebersihan',
    kebersihan: 'kebersihan',
    repair: 'perbaikan',
    perbaikan: 'perbaikan',
    maintenance: 'perbaikan',
};

function mapCategory(raw: string | null): string {
    if (!raw) return 'lainnya';
    const lower = raw.toLowerCase().trim();
    return CATEGORY_MAP[lower] || 'lainnya';
}

/**
 * Call Gemini Vision API to extract receipt information from an image
 */
export async function ocrReceipt(
    imageBytes: ArrayBuffer,
    contentType: string,
    apiKey: string
): Promise<OcrResult> {
    const base64 = btoa(
        new Uint8Array(imageBytes).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    const prompt = `You are an OCR assistant for an Indonesian boarding house (kost) expense tracker.
Analyze this receipt image and extract the following information as JSON:
{
  "merchant_name": "string or null",
  "transaction_date": "YYYY-MM-DD or null",
  "total_amount": number_in_rupiah_integer or null,
  "suggested_category": "one of: listrik, air, wifi, kebersihan, perbaikan, lainnya",
  "confidence": 0.0_to_1.0,
  "notes": "any additional relevant info or null"
}
Return ONLY the JSON object, no markdown formatting.`;

    const body = {
        contents: [
            {
                parts: [
                    { text: prompt },
                    {
                        inline_data: {
                            mime_type: contentType,
                            data: base64,
                        },
                    },
                ],
            },
        ],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024,
        },
    };

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    );

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errText}`);
    }

    const data: any = await response.json();
    const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    // Clean any markdown code blocks
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let parsed: any;
    try {
        parsed = JSON.parse(cleaned);
    } catch {
        parsed = {};
    }

    return {
        merchant_name: parsed.merchant_name || null,
        transaction_date: parsed.transaction_date || null,
        total_amount: typeof parsed.total_amount === 'number' ? parsed.total_amount : null,
        suggested_category: mapCategory(parsed.suggested_category),
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
        notes: parsed.notes || null,
        raw_json: cleaned,
    };
}
