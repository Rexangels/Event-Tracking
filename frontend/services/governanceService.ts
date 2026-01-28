
import api from './api';

export interface AuditLog {
    id: string;
    action: string;
    source: string;
    status: string;
    details: string;
    ip_address: string;
    timestamp: string;
}

export const governanceService = {
    async getAuditLogs(): Promise<AuditLog[]> {
        const response = await api.get<any>('/audit-logs/');
        const data = response.data;

        if (data && typeof data === 'object' && !Array.isArray(data) && data.results) {
            return data.results;
        }

        return Array.isArray(data) ? data : [];
    }
};
