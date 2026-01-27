
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
        const response = await api.get<AuditLog[]>('/audit-logs/');
        return response.data;
    }
};
