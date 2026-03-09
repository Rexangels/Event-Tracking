import axios from 'axios';

const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL || '';
const AUTH_API_BASE = `${apiBaseUrl}/api/v1`;

export const AUTH_STATE_EVENT = 'sentinel-auth-state-changed';
export const ACCESS_TOKEN_KEY = 'authToken';
export const REFRESH_TOKEN_KEY = 'refreshToken';
export const USER_STORAGE_KEY = 'user';

let refreshPromise = null;

const getStorage = () => (typeof globalThis !== 'undefined' && 'localStorage' in globalThis ? globalThis.localStorage : null);

const emitAuthStateChange = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(AUTH_STATE_EVENT));
    }
};

const decodeBase64 = (value) => {
    if (typeof globalThis.atob === 'function') {
        return globalThis.atob(value);
    }
    return Buffer.from(value, 'base64').toString('utf-8');
};

export const subscribeToAuthChanges = (listener) => {
    if (typeof window === 'undefined') return () => undefined;
    window.addEventListener(AUTH_STATE_EVENT, listener);
    return () => window.removeEventListener(AUTH_STATE_EVENT, listener);
};

export const getAccessToken = () => getStorage()?.getItem(ACCESS_TOKEN_KEY) || null;
export const getRefreshToken = () => getStorage()?.getItem(REFRESH_TOKEN_KEY) || null;

export const decodeTokenPayload = (token) => {
    try {
        const payload = token?.split('.')[1];
        if (!payload) return null;

        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        return JSON.parse(decodeBase64(padded));
    } catch {
        return null;
    }
};

export const isTokenExpired = (token, bufferSeconds = 30) => {
    const payload = decodeTokenPayload(token);
    if (!payload?.exp) return true;
    return payload.exp * 1000 <= Date.now() + bufferSeconds * 1000;
};

export const getUsableAccessToken = () => {
    const token = getAccessToken();
    return token && !isTokenExpired(token) ? token : null;
};

export const hasActiveSession = () => {
    if (getUsableAccessToken()) return true;
    const refreshToken = getRefreshToken();
    return Boolean(refreshToken && !isTokenExpired(refreshToken));
};

export const persistAuthTokens = ({ access, refresh }) => {
    const storage = getStorage();
    if (!storage) return;

    if (access) storage.setItem(ACCESS_TOKEN_KEY, access);
    if (refresh) storage.setItem(REFRESH_TOKEN_KEY, refresh);
    emitAuthStateChange();
};

export const clearStoredAuth = () => {
    const storage = getStorage();
    if (!storage) return;

    storage.removeItem(ACCESS_TOKEN_KEY);
    storage.removeItem(REFRESH_TOKEN_KEY);
    storage.removeItem(USER_STORAGE_KEY);
    emitAuthStateChange();
};

export const notifyAuthStateChanged = emitAuthStateChange;

export const refreshAccessToken = async () => {
    if (refreshPromise) return refreshPromise;

    const refreshToken = getRefreshToken();
    if (!refreshToken || isTokenExpired(refreshToken)) {
        clearStoredAuth();
        return null;
    }

    refreshPromise = axios.post(`${AUTH_API_BASE}/auth/refresh/`, { refresh: refreshToken }, {
        headers: { 'Content-Type': 'application/json' },
    })
        .then(response => {
            const nextAccess = response.data?.access;
            const nextRefresh = response.data?.refresh || refreshToken;

            if (!nextAccess) {
                throw new Error('Refresh endpoint did not return an access token.');
            }

            persistAuthTokens({ access: nextAccess, refresh: nextRefresh });
            return nextAccess;
        })
        .catch(() => {
            clearStoredAuth();
            return null;
        })
        .finally(() => {
            refreshPromise = null;
        });

    return refreshPromise;
};

export const ensureValidAccessToken = async (preferredToken = null) => {
    if (preferredToken && !isTokenExpired(preferredToken)) {
        return preferredToken;
    }

    const currentAccessToken = getAccessToken();
    if (currentAccessToken && !isTokenExpired(currentAccessToken)) {
        return currentAccessToken;
    }

    return refreshAccessToken();
};

export const getAuthorizedHeaders = async (preferredToken = null, headers = {}) => {
    const accessToken = await ensureValidAccessToken(preferredToken);
    if (!accessToken) return { ...headers };

    return {
        ...headers,
        Authorization: `Bearer ${accessToken}`,
    };
};