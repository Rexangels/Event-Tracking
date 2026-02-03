/**
 * INEHSS API Service
 * Handles communication with the INEHSS backend
 */

import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/v1/inehss';

export interface FormField {
    name: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'gps' | 'file';
    label: string;
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    helpText?: string;
}

export interface FormTemplate {
    id: string;
    name: string;
    description: string;
    form_type: 'public' | 'officer';
    schema: FormField[];
    is_active: boolean;
    created_at: string;
}

export interface HazardReport {
    id: string;
    tracking_id: string;
    form_template: FormTemplate;
    data: Record<string, any>;
    latitude: number | null;
    longitude: number | null;
    address: string;
    status: string;
    priority: string;
    reporter_name: string;
    reporter_phone: string;
    reporter_email: string;
    created_at: string;
    updated_at: string;
}

export interface OfficerAssignment {
    id: string;
    report: HazardReport;
    officer_username: string;
    inspection_form: FormTemplate;
    status: string;
    notes: string;
    assigned_at: string;
    due_date: string | null;
    completed_at: string | null;
}

// === Public API ===

export async function getPublicForms(): Promise<FormTemplate[]> {
    const response = await axios.get(`${API_BASE}/forms/public/`);
    return response.data;
}

export async function getFormSchema(formId: string): Promise<FormTemplate> {
    const response = await axios.get(`${API_BASE}/forms/${formId}/schema/`);
    return response.data;
}

export async function submitPublicReport(
    formTemplateId: string,
    data: Record<string, any>,
    location?: { latitude: number; longitude: number; address?: string },
    reporter?: { name?: string; phone?: string; email?: string }
): Promise<{ tracking_id: string; message: string }> {
    const payload = {
        form_template: formTemplateId,
        data,
        latitude: location?.latitude,
        longitude: location?.longitude,
        address: location?.address || '',
        reporter_name: reporter?.name || '',
        reporter_phone: reporter?.phone || '',
        reporter_email: reporter?.email || '',
    };
    const response = await axios.post(`${API_BASE}/reports/`, payload);
    return response.data;
}

export async function trackReport(trackingId: string): Promise<{
    tracking_id: string;
    status: string;
    created_at: string;
    updated_at: string;
}> {
    const response = await axios.get(`${API_BASE}/reports/track/${trackingId}/`);
    return response.data;
}

// === Officer API (requires auth) ===

export async function getMyAssignments(token: string): Promise<OfficerAssignment[]> {
    const response = await axios.get(`${API_BASE}/assignments/`, {
        headers: { Authorization: `Token ${token}` }
    });
    return response.data;
}

export async function acceptAssignment(assignmentId: string, token: string): Promise<void> {
    await axios.post(`${API_BASE}/assignments/${assignmentId}/accept/`, {}, {
        headers: { Authorization: `Token ${token}` }
    });
}

export async function submitInspection(
    assignmentId: string,
    data: Record<string, any>,
    location: { latitude: number; longitude: number } | null,
    isDraft: boolean,
    token: string
): Promise<any> {
    const payload = {
        assignment: assignmentId,
        data,
        latitude: location?.latitude,
        longitude: location?.longitude,
        is_draft: isDraft,
    };
    const response = await axios.post(`${API_BASE}/submissions/`, payload, {
        headers: { Authorization: `Token ${token}` }
    });
    return response.data;
}

export async function completeAssignment(assignmentId: string, token: string): Promise<void> {
    await axios.post(`${API_BASE}/assignments/${assignmentId}/complete/`, {}, {
        headers: { Authorization: `Token ${token}` }
    });
}

// === File Uploads ===

export interface MediaAttachment {
    id: string;
    file: string;
    file_type: 'image' | 'video' | 'document';
    original_filename: string;
    file_size: number;
    uploaded_at: string;
}

export async function uploadAttachment(
    file: File,
    reportId?: string,
    submissionId?: string,
    token?: string
): Promise<MediaAttachment> {
    const formData = new FormData();
    formData.append('file', file);
    if (reportId) formData.append('report', reportId);
    if (submissionId) formData.append('submission', submissionId);

    const headers: Record<string, string> = {};
    if (token) {
        headers['Authorization'] = `Token ${token}`;
    }

    const response = await axios.post(`${API_BASE}/attachments/`, formData, { headers });
    return response.data;
}
