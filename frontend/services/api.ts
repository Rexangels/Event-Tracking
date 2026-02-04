import axios from 'axios';

const api = axios.create({
    baseURL: '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            console.warn('SYSTEM_AUTH: Unauthorized access detected. Redirecting to login.');
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
            // Redirect only if not already on login page to avoid loops
            if (!window.location.pathname.includes('/login')) {
                window.location.href = '/login';
            }
        } else if (error.response?.status === 429) {
            console.error('SYSTEM_THROTTLED: Rate limit exceeded. Refer to enterprise security policy.');
        } else if (error.response?.status === 503) {
            console.error('SYSTEM_MAINTENANCE: Service temporarily unavailable.');
        }
        return Promise.reject(error);
    }
);

export default api;
