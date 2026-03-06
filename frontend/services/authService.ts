import api from './api';

export type UserRole = 'admin' | 'supervisor' | 'analyst' | 'officer' | 'public';

export interface User {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    organization?: string;
    is_staff: boolean;
    is_superuser: boolean;
}

export interface LoginResponse {
    access: string;
    refresh: string;
}

const USER_STORAGE_KEY = 'user';

const decodeTokenPayload = (token: string): Record<string, any> | null => {
    try {
        const payload = token.split('.')[1];
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        return JSON.parse(window.atob(padded));
    } catch {
        return null;
    }
};

const normalizeRole = (value: unknown): UserRole => {
    const role = typeof value === 'string' ? value.toLowerCase() : '';
    if (role === 'admin' || role === 'supervisor' || role === 'analyst' || role === 'officer') {
        return role;
    }
    return 'public';
};

const decodeUserFromToken = (token: string): User | null => {
    const payload = decodeTokenPayload(token);
    if (!payload) return null;

    return {
        id: Number(payload.user_id || 0),
        username: payload.username || 'User',
        email: payload.email || '',
        role: normalizeRole(payload.role),
        organization: payload.organization || '',
        is_staff: Boolean(payload.is_staff),
        is_superuser: Boolean(payload.is_superuser),
    };
};

export const authService = {
    async login(username: string, password: string): Promise<LoginResponse> {
        const response = await api.post<LoginResponse>('/auth/login/', { username, password });
        if (response.data.access) {
            localStorage.setItem('authToken', response.data.access);
            localStorage.setItem('refreshToken', response.data.refresh);
            try {
                await this.fetchCurrentUser();
            } catch {
                const fallbackUser = decodeUserFromToken(response.data.access);
                if (fallbackUser) {
                    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(fallbackUser));
                }
            }
        }
        return response.data;
    },

    async fetchCurrentUser(): Promise<User> {
        const response = await api.get<User>('/auth/users/me/');
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data));
        return response.data;
    },

    logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem(USER_STORAGE_KEY);
    },

    getCurrentUser(): User | null {
        const userStr = localStorage.getItem(USER_STORAGE_KEY);
        if (userStr) {
            return JSON.parse(userStr);
        }

        const token = this.getToken();
        if (!token) {
            return null;
        }

        const decodedUser = decodeUserFromToken(token);
        if (decodedUser) {
            localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(decodedUser));
        }
        return decodedUser;
    },

    hasAnyRole(roles: UserRole[]): boolean {
        const user = this.getCurrentUser();
        if (!user) return false;

        if ((user.is_staff || user.is_superuser) && roles.some(role => role === 'admin' || role === 'supervisor' || role === 'analyst')) {
            return true;
        }

        return roles.includes(user.role);
    },

    getDefaultRoute(): string {
        if (this.hasAnyRole(['admin', 'supervisor', 'analyst'])) {
            return '/admin';
        }
        if (this.hasAnyRole(['officer'])) {
            return '/inehss/officer';
        }
        return '/inehss';
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
