
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

export interface GovernanceLedgerResponse {
    integrity_ok: boolean;
    count: number;
    results: AuditLog[];
}

export interface GovernanceTrustIndex {
    data_integrity: number;
    source_verification: number;
    audit_coverage: number;
    integrity_ok: boolean;
    total_audit_logs: number;
}

export const governanceService = {
    async getAuditLogs(): Promise<AuditLog[]> {
        const response = await api.get<GovernanceLedgerResponse>('/governance/ledger/');
        return response.data?.results || [];
    },

    async getLedger(): Promise<GovernanceLedgerResponse> {
        const response = await api.get<GovernanceLedgerResponse>('/governance/ledger/');
        return response.data;
    },

    async getTrustIndex(): Promise<GovernanceTrustIndex> {
        const response = await api.get<GovernanceTrustIndex>('/governance/trust-index/');
        return response.data;
    }
};
