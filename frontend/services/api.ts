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
