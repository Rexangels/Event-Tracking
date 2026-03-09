import axios from 'axios';
import { ensureValidAccessToken, refreshAccessToken } from './authSession.js';

const api = axios.create({
    baseURL: `${import.meta.env.VITE_API_BASE_URL || ''}/api/v1`,
    headers: {
        'Content-Type': 'application/json',
    },
});

const isAuthRequest = (url?: string) => Boolean(url && /\/auth\/(login|refresh)\/?$/.test(url));

api.interceptors.request.use(async (config) => {
    if (isAuthRequest(config.url)) {
        return config;
    }

    const existingHeader = typeof config.headers?.Authorization === 'string'
        ? config.headers.Authorization
        : typeof config.headers?.authorization === 'string'
            ? config.headers.authorization
            : null;
    const existingToken = existingHeader?.startsWith('Bearer ')
        ? existingHeader.slice(7)
        : null;
    const token = await ensureValidAccessToken(existingToken);

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest(originalRequest.url)) {
            originalRequest._retry = true;
            const refreshedToken = await refreshAccessToken();

            if (refreshedToken) {
                originalRequest.headers = originalRequest.headers || {};
                originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
                return api(originalRequest);
            }
        }

        if (error.response?.status === 429) {
            console.error('SYSTEM_THROTTLED: Rate limit exceeded. Refer to enterprise security policy.');
            // This can be used to trigger a global notification in an actual app
        } else if (error.response?.status === 503) {
            console.error('SYSTEM_MAINTENANCE: Service temporarily unavailable.');
        }
        return Promise.reject(error);
    }
);

export default api;
