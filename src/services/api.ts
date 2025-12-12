import { Alert, YaraRule, MitreAttackTechnique, AlertMitreMapping, AlertSource } from '../types';

const API_Base = 'http://localhost:3000/api';

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
}

export const api = {
    async getStats() {
        const res = await fetch(`${API_Base}/stats`);
        if (!res.ok) throw new Error('Failed to fetch stats');
        return res.json();
    },

    async getAlerts(severity?: string, page = 0, limit = 50): Promise<PaginatedResponse<Alert>> {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: (page * limit).toString(),
        });
        if (severity && severity !== 'all') {
            params.append('severity', severity);
        }

        const res = await fetch(`${API_Base}/alerts?${params}`);
        if (!res.ok) throw new Error('Failed to fetch alerts');

        // Assuming the backend now returns { data: Alert[], total: number }
        return res.json();
    },

    async getTrendData(): Promise<Alert[]> {
        const res = await fetch(`${API_Base}/alerts?limit=1000`);
        if (!res.ok) throw new Error('Failed to fetch trend data');
        const response = await res.json();
        return response.data || [];
    },

    async getYaraRules(severity?: string, page = 0, limit = 50): Promise<PaginatedResponse<YaraRule>> {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: (page * limit).toString()
        });
        if (severity && severity !== 'all') {
            params.append('severity', severity);
        }
        const res = await fetch(`${API_Base}/yara-rules?${params}`);
        if (!res.ok) throw new Error('Failed to fetch YARA rules');
        return res.json();
    },

    async getMitreTechniques() {
        const res = await fetch(`${API_Base}/mitre-techniques`);
        if (!res.ok) throw new Error('Failed to fetch MITRE techniques');
        return res.json();
    },

    async getMitreMappings(severity?: string) {
        const query = severity && severity !== 'all' ? `?severity=${severity}` : '';
        const res = await fetch(`${API_Base}/mitre-mappings${query}`);
        if (!res.ok) throw new Error('Failed to fetch MITRE mappings');
        return res.json();
    },

    async triggerSync() {
        const res = await fetch(`${API_Base}/jobs/sync`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to trigger sync');
        return res.json();
    }
};
