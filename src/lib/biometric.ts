/**
 * Biometric Auth Helper for Capacitor (Android / iOS)
 *
 * Provides fingerprint/face-based quick login using:
 *  - @aparajita/capacitor-biometric-auth  → native biometric prompt
 *  - @capacitor/preferences               → secure credential storage
 */

import { Capacitor } from '@capacitor/core';

// ── Types ───────────────────────────────────────
export interface SavedCredentials {
    email: string;
    password: string;
}

// We lazy-import the plugins only on native to avoid SSR / browser errors
let BiometricAuth: any = null;
let Preferences: any = null;

async function loadPlugins() {
    if (!Capacitor.isNativePlatform()) return false;
    if (!BiometricAuth) {
        const mod = await import('@aparajita/capacitor-biometric-auth');
        BiometricAuth = mod.BiometricAuth;
    }
    if (!Preferences) {
        const mod = await import('@capacitor/preferences');
        Preferences = mod.Preferences;
    }
    return true;
}

// ── Keys ────────────────────────────────────────
const PREF_KEY_CRED = 'biometric_credentials';
const PREF_KEY_ENABLED = 'biometric_enabled';

// ── Public API ──────────────────────────────────

/**
 * Check if the device supports biometric auth (fingerprint / face).
 * Returns true if the hardware is available AND the user has enrolled biometry.
 */
export async function isBiometricAvailable(): Promise<boolean> {
    try {
        const ok = await loadPlugins();
        if (!ok) return false;

        // checkBiometry() returns Promise<CheckBiometryResult>
        // with { isAvailable: boolean, ... }
        const result = await BiometricAuth.checkBiometry();
        return result?.isAvailable === true;
    } catch (err) {
        console.warn('[Biometric] checkBiometry error:', err);
        return false;
    }
}

/**
 * Check if user has previously enabled biometric login.
 */
export async function isBiometricEnabled(): Promise<boolean> {
    try {
        const ok = await loadPlugins();
        if (!ok) return false;
        const { value } = await Preferences.get({ key: PREF_KEY_ENABLED });
        return value === 'true';
    } catch {
        return false;
    }
}

/**
 * Prompt the native biometric dialog (fingerprint / face).
 * Resolves true if auth succeeds, false otherwise.
 */
export async function authenticateWithBiometric(): Promise<boolean> {
    try {
        const ok = await loadPlugins();
        if (!ok) return false;
        await BiometricAuth.authenticate({
            reason: 'Login ke Kost Annisa',
            cancelTitle: 'Batal',
            allowDeviceCredential: true,
        });
        return true;
    } catch (err) {
        console.warn('[Biometric] authenticate error:', err);
        return false;
    }
}

/**
 * Save credentials after a successful manual login.
 * Called when user opts-in to biometric login.
 */
export async function saveCredentials(cred: SavedCredentials): Promise<void> {
    const ok = await loadPlugins();
    if (!ok) return;
    await Preferences.set({
        key: PREF_KEY_CRED,
        value: JSON.stringify(cred),
    });
    await Preferences.set({
        key: PREF_KEY_ENABLED,
        value: 'true',
    });
}

/**
 * Retrieve saved credentials (only after biometric auth succeeds).
 */
export async function getSavedCredentials(): Promise<SavedCredentials | null> {
    try {
        const ok = await loadPlugins();
        if (!ok) return null;
        const { value } = await Preferences.get({ key: PREF_KEY_CRED });
        if (!value) return null;
        return JSON.parse(value) as SavedCredentials;
    } catch {
        return null;
    }
}

/**
 * Remove saved credentials & disable biometric login.
 */
export async function clearBiometric(): Promise<void> {
    try {
        const ok = await loadPlugins();
        if (!ok) return;
        await Preferences.remove({ key: PREF_KEY_CRED });
        await Preferences.remove({ key: PREF_KEY_ENABLED });
    } catch {
        // ignore
    }
}
