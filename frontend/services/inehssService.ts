/**
 * INEHSS API Service
 * Handles communication with the INEHSS backend
 */

import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/v1/inehss';

export interface FieldCondition {
    field: string;
    operator: 'equals' | 'not_equals' | 'contains' | 'not_empty' | 'is_empty' | 'greater_than' | 'less_than';
    value?: string | number | boolean;
}

export interface FormField {
    name: string;
    type: 'text' | 'textarea' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'radio' | 'date' | 'gps' | 'file';
    label: string;
    required?: boolean;
    options?: Array<{ value: string; label: string }>;
    placeholder?: string;
    helpText?: string;
    conditions?: FieldCondition[];
}

export interface FormTemplate {
    id: string;
    name: string;
    description: string;
    form_type: 'public' | 'officer';
    geo_mode: 'disabled' | 'manual' | 'auto';
    version_id?: string;
    version_number?: number;
    follow_up_for?: string | null;
    follow_up_for_name?: string | null;
    is_follow_up?: boolean;
    schema: FormField[];
    is_active: boolean;
    created_at: string;
}

export interface HazardReport {
    id: string;
    tracking_id: string;
    form_version: {
        id: string;
        template_id?: string;
        version_number: number;
        template_name: string;
        schema?: any[];
        geo_mode?: 'disabled' | 'manual' | 'auto';
    };
    parent_report?: string | null;
    data: Record<string, any>;
    latitude: number | null;
    longitude: number | null;
    address: string;
    status: string;
    priority: string;
    reporter_name: string;
    reporter_phone: string;
    reporter_email: string;
    assigned_officer?: string | null;
    assignment_count?: number;
    report_origin?: {
        code: 'public' | 'patrol' | 'follow_up' | 'unknown';
        label: string;
        description: string;
    };
    lineage?: {
        lineage_status: 'linked' | 'heuristic_only';
        is_patrol_generated: boolean;
        origin_assignment_id: string | null;
        origin_submission_id: string | null;
        origin_officer_username: string | null;
        origin_assignment_status: string | null;
        origin_assignment_is_persistent: boolean | null;
        origin_assignment_assigned_at: string | null;
        origin_submission_timestamp: string | null;
        origin_submission_version: number | null;
        origin_submission_is_draft: boolean | null;
        origin_submission_submitted_by: string | null;
    } | null;
    attachments?: MediaAttachment[];
    event_id?: string | null;
    created_at: string;
    updated_at: string;
}

export interface OfficerAssignment {
    id: string;
    report: HazardReport;
    officer_username: string;
    form_version: {
        id: string;
        template_id?: string;
        version_number: number;
        template_name: string;
        schema?: any[];
        geo_mode?: 'disabled' | 'manual' | 'auto';
        is_latest?: boolean;
        follow_up_for?: string | null;
    };
    status: string;
    progress_percent?: number;
    escalation_level?: 'none' | 'low' | 'medium' | 'high' | 'critical';
    escalation_reason?: string;
    notes: string;
    assigned_at: string;
    due_date: string | null;
    completed_at: string | null;
    is_persistent?: boolean;
}

export interface ReportFilters {
    tracking_id?: string;
    priority?: string;
    status?: string;
    search?: string;
    parent_report?: string;
    form_template?: string;
    template_id?: string;
    form_version?: string;
    assigned_officer?: string;
    officer?: string;
    created_from?: string;
    created_to?: string;
    has_attachments?: boolean;
    event_id?: string;
    min_lat?: number;
    max_lat?: number;
    min_lon?: number;
    max_lon?: number;
}

export interface AssignmentFilters {
    report?: string;
    officer_username?: string;
    status?: string;
}

export interface ReportTimelineItem {
    timestamp: string;
    source_type: 'report_status' | 'assignment_status' | 'submission' | 'follow_up_report_status' | 'event_status';
    source_id: string;
    title: string;
    actor: string | null;
    metadata: Record<string, any>;
}

export interface ReportTimelineResponse {
    report_id: string;
    tracking_id: string;
    timeline: ReportTimelineItem[];
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
    formVersionId: string,
    data: Record<string, any>,
    location?: { latitude: number; longitude: number; address?: string },
    reporter?: { name?: string; phone?: string; email?: string },
    parentTrackingId?: string
): Promise<{ tracking_id: string; message: string }> {
    const payload: any = {
        form_version: formVersionId,
        data,
        latitude: location?.latitude,
        longitude: location?.longitude,
        address: location?.address || '',
        reporter_name: reporter?.name || '',
        reporter_phone: reporter?.phone || '',
        reporter_email: reporter?.email || '',
    };
    if (parentTrackingId) {
        payload.parent_tracking_id = parentTrackingId;
    }
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
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
}

export async function startAssignment(assignmentId: string, token: string): Promise<void> {
    await axios.post(`${API_BASE}/assignments/${assignmentId}/start/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
    });
}

export async function submitAssignmentForReview(assignmentId: string, token: string): Promise<void> {
    await axios.post(`${API_BASE}/assignments/${assignmentId}/submit_review/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
    });
}

export async function escalateAssignment(
    assignmentId: string,
    level: 'low' | 'medium' | 'high' | 'critical',
    reason: string,
    token: string
): Promise<void> {
    await axios.post(`${API_BASE}/assignments/${assignmentId}/escalate/`, { level, reason }, {
        headers: { Authorization: `Bearer ${token}` }
    });
}

export async function getReports(token: string, filters?: ReportFilters): Promise<HazardReport[]> {
    const response = await axios.get(`${API_BASE}/reports/`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results || []);
}

export async function getAssignments(token: string, filters?: AssignmentFilters): Promise<OfficerAssignment[]> {
    const response = await axios.get(`${API_BASE}/assignments/`, {
        headers: { Authorization: `Bearer ${token}` },
        params: filters,
    });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.results || []);
}

export async function getReportTimeline(reportId: string, token: string): Promise<ReportTimelineResponse> {
    const response = await axios.get(`${API_BASE}/reports/${reportId}/timeline/`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    return response.data;
}


export async function approveAssignment(assignmentId: string, token: string): Promise<void> {
    await axios.post(`${API_BASE}/assignments/${assignmentId}/approve/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
    });
}

export async function requestAssignmentRevision(assignmentId: string, notes: string, token: string): Promise<void> {
    await axios.post(`${API_BASE}/assignments/${assignmentId}/request_revision/`, { notes }, {
        headers: { Authorization: `Bearer ${token}` }
    });
}

export async function reassignAssignment(assignmentId: string, officerId: number, reason: string, token: string): Promise<void> {
    await axios.post(`${API_BASE}/assignments/${assignmentId}/reassign/`, {
        officer_id: officerId,
        reason,
    }, {
        headers: { Authorization: `Bearer ${token}` }
    });
}


export async function acceptAssignment(assignmentId: string, token: string): Promise<void> {
    await axios.post(`${API_BASE}/assignments/${assignmentId}/accept/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
    });
}

export interface SubmissionLocation {
    latitude: number;
    longitude: number;
    accuracy?: number;
    source?: 'gps' | 'manual' | 'map';
    capturedAt?: string;
}

export async function submitInspection(
    assignmentId: string,
    data: Record<string, any>,
    location: SubmissionLocation | null,
    isDraft: boolean,
    token: string
): Promise<any> {
    const payload = {
        assignment: assignmentId,
        data,
        latitude: location?.latitude,
        longitude: location?.longitude,
        location_accuracy_m: location?.accuracy,
        location_source: location?.source || 'gps',
        location_captured_at: location?.capturedAt,
        is_draft: isDraft,
    };
    const response = await axios.post(`${API_BASE}/submissions/`, payload, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
}

export async function completeAssignment(assignmentId: string, token: string): Promise<void> {
    await axios.post(`${API_BASE}/assignments/${assignmentId}/complete/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
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
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await axios.post(`${API_BASE}/attachments/`, formData, { headers });
    return response.data;
}

export async function upgradeAssignmentVersion(assignmentId: string, token: string): Promise<any> {
    const response = await axios.post(`${API_BASE}/assignments/${assignmentId}/upgrade_version/`, {}, {
        headers: { Authorization: `Bearer ${token}` }
    });
    return response.data;
}
