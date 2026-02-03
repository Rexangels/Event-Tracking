
import api from './api';

export interface User {
    id: number;
    username: string;
    email: string;
    is_staff: boolean;
}

export interface LoginResponse {
    access: string;
    refresh: string;
}

export const authService = {
    async login(username: string, password: string): Promise<LoginResponse> {
        const response = await api.post<LoginResponse>('/auth/login/', { username, password });
        if (response.data.access) {
            localStorage.setItem('authToken', response.data.access);
            localStorage.setItem('refreshToken', response.data.refresh);
        }
        return response.data;
    },

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    },

    getCurrentUser(): User | null {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            return JSON.parse(userStr);
        }
        return null;
    },

    isAuthenticated(): boolean {
        return !!localStorage.getItem('authToken');
    },

    getToken(): string | null {
        return localStorage.getItem('authToken');
    },

    getUser(): User | null {
        return this.getCurrentUser();
    }
};
