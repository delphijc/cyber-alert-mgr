import { Alert, YaraRule, AlertSource } from '../types';

// Use environment variable or valid browser location to determine API base
const getApiBase = () => {
    // If VITE_API_BASE_URL is set, use it
    if (import.meta.env.VITE_API_BASE_URL) {
        return import.meta.env.VITE_API_BASE_URL;
    }
    // Otherwise construct from window location (assuming port 3000 for backend)
    return `http://${window.location.hostname}:3000/api`;
};

const API_Base = getApiBase();

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
    },

    async triggerDeduplicate() {
        const res = await fetch(`${API_Base}/jobs/deduplicate`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to trigger deduplication');
        return res.json();
    },

    async triggerReprocess() {
        const res = await fetch(`${API_Base}/jobs/reprocess`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to trigger reprocessing');
        return res.json();
    },

    async updateYaraRule(id: string, updates: { rule_content?: string, is_locked?: number }) {
        const res = await fetch(`${API_Base}/yara-rules/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        });
        if (!res.ok) throw new Error('Failed to update rule');
        return res.json();
    },

    async deleteYaraRule(id: string) {
        const res = await fetch(`${API_Base}/yara-rules/${id}`, { method: 'DELETE' });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to delete rule');
        }
        return res.json();
    },

    async reprocessAlert(id: string) {
        const res = await fetch(`${API_Base}/alerts/${id}/reprocess`, { method: 'POST' });
        if (!res.ok) throw new Error('Failed to reprocess alert');
        return res.json();
    }
};
