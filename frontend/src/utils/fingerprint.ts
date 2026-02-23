import FingerprintJS from '@fingerprintjs/fingerprintjs';
import { useGlobalState } from '../store';

const { browserFingerprint } = useGlobalState();

/**
 * Get browser fingerprint
 * Uses cached value from global state if available to avoid unnecessary computation
 * @returns Fingerprint visitor ID, or 'ERROR' if failed
 */
export const getFingerprint = async (): Promise<string> => {
    // Return cached fingerprint if available
    if (browserFingerprint.value) {
        return browserFingerprint.value;
    }

    try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        browserFingerprint.value = result.visitorId;
        return browserFingerprint.value;
    } catch (error) {
        console.error('Failed to get fingerprint:', error);
        // Return special error value to prevent blocking requests
        const errorValue = 'ERROR';
        browserFingerprint.value = errorValue;
        return errorValue;
    }
};

