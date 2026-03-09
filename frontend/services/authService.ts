import api from './api';
import {
    USER_STORAGE_KEY,
    clearStoredAuth,
    decodeTokenPayload,
    getAccessToken,
    hasActiveSession,
    notifyAuthStateChanged,
    persistAuthTokens,
} from './authSession.js';

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
            persistAuthTokens({ access: response.data.access, refresh: response.data.refresh });
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
        notifyAuthStateChanged();
        return response.data;
    },

    logout() {
        clearStoredAuth();
    },

    getCurrentUser(): User | null {
        const userStr = localStorage.getItem(USER_STORAGE_KEY);
        if (userStr) {
            try {
                return JSON.parse(userStr);
            } catch {
                localStorage.removeItem(USER_STORAGE_KEY);
            }
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
        return hasActiveSession();
    },

    getToken(): string | null {
        return getAccessToken();
    },

    getUser(): User | null {
        return this.getCurrentUser();
    }
};
