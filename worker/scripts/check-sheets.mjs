/**
 * Quick check: read spreadsheet data via Sheets API
 */
const crypto = globalThis.crypto || (await import('crypto')).webcrypto;

const SA_JSON = `{
  "type": "service_account",
  "client_email": "kosannisa@kostannisa.iam.gserviceaccount.com",
  "token_uri": "https://oauth2.googleapis.com/token",
  "private_key": "-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDxmeK1s128frQv\\noRyZloUmG5T+N5G01oNoCb5pIsTIaYpW0xdpfws/vOV5ng10CQ76WJZamudFeNNh\\nObU6c9La3PbO7gmcB8vnM8U2CgQN/V36PG1akkxdFDmn8e0BBGlWoPlSQ9bcmKP/\\nRn09IE/PEwUO6yxA/adDNoVFQAO7PEfftXn7mMMKfQ9Z8It1cf9XM2Kq9Q886FxV\\n2dHsGkGKK8zlCRJnfmyp0qUisEJ5bmTCkdzUC9GCN6JPwJ4Pc7+BPQbVvejqM68U\\n0h5269sPw4vblc80fi5lj2wXb5+EIxoy6f8ee8qK07fzQk7HviKrViBga2dX4+2Q\\n9gcZPYt1AgMBAAECggEABEotH2ZdjFqb3JDsHwG5ZMl3liKGBmzBf4yedIgm3Zs/\\nRKRkJ9BN4FPqFSjw6Fp1G42MsL0CqF8ye1b0U+MCccjSdeW0z9SiwEX1sNEDtdgq\\nVKZ4Kb0rr4KLx9BlWtRXJsJCzU9Yn6kXl8hBjbqCNx5AQ6t6BJtlgxs3pP1YM53E\\nfAiMMot4vTJo56ryYKu9yKi5x4tfmIWVJh7iR8WY7Mp1xfEbM5N9VWDieK+9fLGx\\nTZDU2yVkRb24+RvHBOmiLnWZR1EO/pz5grKud8zKMqtCUclC3xQMKRrx4EgIX76f\\nHdkBZFnQPGchyPU9mjdh7azwP7PeU2aCEJNOFmKKAQKBgQD8wx8nXkDXmlVa8SO4\\nMDYwSBbJB+xiKqCWczyz3TuwJ4OkLfg1NRD1h6ttKSUYTYrkiYGua4ctnrJADqcl\\nvrVaSMeTTbjMQj7/S2G/cr8TE8Qcqw3A/IFAYIGSu6RV5Fl5xFTEDobj1yqQbj+s\\ns2roA2oALBJGzjuOBBGt3Rr1AQKBgQD0singGcM/gN+qBVyhspwVfwq3FrQydfqo\\nRDESmX7bSExLo07nUu3+9uwul+13S6OTfpmyneRTf0P7ONdxN8mUM4aXHHXvLD6k\\nUx2tj1iTvmRScDgVLxiMxzIPBRpr6hXW84eVz+BH4MIVOWNPLkXHAJx0qy8+FYjv\\n0dvbxzGSdQKBgQCaCj/+Og7CVqgWGEdwhNFBc22Pbmi9GsVraydfZkBuBmbPs8RE\\niOag++GZUS3uNbOju7lwls93GfP/3e43rpXPQ/N87izlLqo9467agg+4jJ9D6Wsk\\nZb5PgYD1760jO1rcPq56HXBPgl3KT6Y2ldFdPFdpa3Jn/F+HGSu9DbbUAQKBgCXd\\nD8fClMjVy0ZG0B+hQK++2cyc8cNBKEkzTBihsdSCqnOl0IbQ+UzTrpZDIhasmKIx\\nG91cu0EEV2OfVw8I3+NT2ca2O7WHtiW9SsFZhg5Ojr2G6da1U+osxJ04X+9E6J47\\nTsaqxPy6Va3tFGXjNh7mBE+1UXkc4fSiF5A5kX0lAoGAeVrbr87iDiktUfYHRwEr\\nvYx1Ys8Ndb7QMQdip+xdlvqctnpWivPDcpcgXC39CLgHWfB6MzMuqRu4rTjiPUBV\\nPzPZol62rL7BeYjexZ4tCrprX/aKG+GxggEpp8Tbv1ALndqjA2VtFdZ6+w4xUsFy\\nNt0zZmqOECG/ebR64HP0QBY=\\n-----END PRIVATE KEY-----\\n"
}`;

const sa = JSON.parse(SA_JSON);
const SPREADSHEET_ID = '1i_8xssjdEzyrzXx5_0Yg32p5h51eYtzoqBOsQPmg0H0';

async function createJwt(sa) {
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claim = { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: sa.token_uri, exp: now + 3600, iat: now };
    const enc = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const unsignedToken = `${enc(header)}.${enc(claim)}`;
    const pemContents = sa.private_key.replace(/-----BEGIN PRIVATE KEY-----/g, '').replace(/-----END PRIVATE KEY-----/g, '').replace(/\\n/g, '').replace(/\s/g, '');
    const binaryKey = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey('pkcs8', binaryKey.buffer, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(unsignedToken));
    const sig = btoa(String.fromCharCode(...new Uint8Array(signature))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return `${unsignedToken}.${sig}`;
}

async function getToken() {
    const jwt = await createJwt(sa);
    const res = await fetch(sa.token_uri, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}` });
    const data = await res.json();
    return data.access_token;
}

const token = await getToken();
const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/Sheet2!A1:J10`, { headers: { Authorization: `Bearer ${token}` } });
const data = await res.json();
console.log('Sheet2 data:');
console.log(JSON.stringify(data, null, 2));
