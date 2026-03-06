/**
 * INEHSSAdminModule
 * Admin interface for managing INEHSS forms and assignments
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    FormTemplate,
    FormField,
    HazardReport,
    getReports,
    approveAssignment,
    requestAssignmentRevision,
    reassignAssignment,
} from '../services/inehssService';
import Tooltip from './ui/Tooltip';

type HazardReportAdmin = HazardReport;

interface Officer {
    id: number;
    username: string;
    email?: string;
}

const API_BASE = 'http://localhost:8000/api/v1';
const INEHSS_ACTIVE_TAB_KEY = 'inehssActiveTab';

type INEHSSTab = 'forms' | 'reports' | 'assignments' | 'officers';

interface OfficerAssignment {
    id: string;
    report: HazardReportAdmin;
    officer_username: string;
    form_version: { template_name: string; version_number: number };
    status: string;
    assigned_at: string;
    is_persistent?: boolean;
    submission_count?: number;
    due_date?: string;
    completed_at?: string;
    escalation_level?: 'none' | 'low' | 'medium' | 'high' | 'critical';
    escalation_reason?: string;
    progress_percent?: number;
}

const INEHSSAdminModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<INEHSSTab>(() => {
        const savedTab = sessionStorage.getItem(INEHSS_ACTIVE_TAB_KEY) as INEHSSTab | null;
        return savedTab || 'forms';
    });
    const [forms, setForms] = useState<FormTemplate[]>([]);
    const [reports, setReports] = useState<HazardReportAdmin[]>([]);
    const [assignments, setAssignments] = useState<OfficerAssignment[]>([]);
    const [officers, setOfficers] = useState<Officer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [reportSearch, setReportSearch] = useState('');
    const [reportStatusFilter, setReportStatusFilter] = useState('all');
    const [reportPriorityFilter, setReportPriorityFilter] = useState('all');
    const [reportOfficerFilter, setReportOfficerFilter] = useState('all');
    const [reportFormFilter, setReportFormFilter] = useState('all');
    const [reportAttachmentFilter, setReportAttachmentFilter] = useState('all');
    const [reportCreatedFrom, setReportCreatedFrom] = useState('');
    const [reportCreatedTo, setReportCreatedTo] = useState('');

    const [reassignModalAssignmentId, setReassignModalAssignmentId] = useState<string | null>(null);
    const [reassignOfficerId, setReassignOfficerId] = useState('');
    const [reassignReason, setReassignReason] = useState('');



    // Form Builder State
    const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
    const [editingForm, setEditingForm] = useState<FormTemplate | null>(null);
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formType, setFormType] = useState<'public' | 'officer'>('public');
    const [followUpFor, setFollowUpFor] = useState('');
    const [geoMode, setGeoMode] = useState<'disabled' | 'manual' | 'auto'>('manual');
    const [formFields, setFormFields] = useState<FormField[]>([]);

    // Assignment Modal State
    const [assignmentModalReport, setAssignmentModalReport] = useState<HazardReportAdmin | null>(null);
    const [directAssignmentTemplate, setDirectAssignmentTemplate] = useState<FormTemplate | null>(null);
    const [selectedOfficer, setSelectedOfficer] = useState<string>('');
    const [selectedInspectionForm, setSelectedInspectionForm] = useState<string>('');
    const [assignmentNotes, setAssignmentNotes] = useState('');
    const [isPatrolMode, setIsPatrolMode] = useState(false);
    const [isSubmittingAssignment, setIsSubmittingAssignment] = useState(false);

    // Officer Creation State
    const [isOfficerModalOpen, setIsOfficerModalOpen] = useState(false);
    const [newOfficerUsername, setNewOfficerUsername] = useState('');
    const [newOfficerEmail, setNewOfficerEmail] = useState('');
    const [newOfficerPassword, setNewOfficerPassword] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        const timeout = setTimeout(() => {
            loadReports();
        }, 350);
        return () => clearTimeout(timeout);
    }, [
        reportSearch,
        reportStatusFilter,
        reportPriorityFilter,
        reportOfficerFilter,
        reportFormFilter,
        reportAttachmentFilter,
        reportCreatedFrom,
        reportCreatedTo,
    ]);

    useEffect(() => {
        sessionStorage.setItem(INEHSS_ACTIVE_TAB_KEY, activeTab);
    }, [activeTab]);

    const getToken = () => localStorage.getItem('authToken');

    const loadData = async () => {
        setIsLoading(true);
        try {
            const token = getToken();
            if (!token) {
                setError('Authentication required. Please log in.');
                setIsLoading(false);
                return;
            }

            const headers = { Authorization: `Bearer ${token}` };

            // Load forms
            const formsRes = await fetch(`${API_BASE}/inehss/forms/`, { headers });
            if (!formsRes.ok) console.error('Forms error:', formsRes.status);
            const formsData = await formsRes.json();
            setForms(formsData.results || formsData);

            await loadReports();

            // Load officers (staff users)
            const officersRes = await fetch(`${API_BASE}/inehss/officers/`, { headers });
            if (!officersRes.ok) console.error('Officers error:', officersRes.status);
            const officersData = await officersRes.json();
            setOfficers(officersData || []);

            // Load assignments
            const assignmentsRes = await fetch(`${API_BASE}/inehss/assignments/`, { headers });
            if (!assignmentsRes.ok) console.error('Assignments error:', assignmentsRes.status);
            if (assignmentsRes.ok) {
                const assignmentsData = await assignmentsRes.json();
                setAssignments(assignmentsData.results || assignmentsData || []);
            }
        } catch (err) {
            setError('Failed to load data');
        } finally {
            setIsLoading(false);
        }
    };

    const loadReports = async () => {
        const token = getToken();
        if (!token) return;

        try {
            const reportsData = await getReports(token, {
                search: reportSearch || undefined,
                status: reportStatusFilter === 'all' ? undefined : reportStatusFilter,
                priority: reportPriorityFilter === 'all' ? undefined : reportPriorityFilter,
                assigned_officer: reportOfficerFilter === 'all' ? undefined : reportOfficerFilter,
                form_template: reportFormFilter === 'all' ? undefined : reportFormFilter,
                has_attachments: reportAttachmentFilter === 'all'
                    ? undefined
                    : reportAttachmentFilter === 'with_attachments',
                created_from: reportCreatedFrom || undefined,
                created_to: reportCreatedTo || undefined,
            });
            setReports(reportsData as HazardReportAdmin[]);
        } catch {
            setReports([]);
        }
    };

    const showSuccess = (msg: string) => {
        setSuccessMessage(msg);
        setTimeout(() => setSuccessMessage(null), 3000);
    };

    // === Form Builder ===

    const addField = () => {
        setFormFields([...formFields, {
            name: `field_${formFields.length + 1}`,
            type: 'text',
            label: '',
            required: false,
        }]);
    };

    const updateField = (index: number, updates: Partial<FormField>) => {
        setFormFields(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
    };

    const removeField = (index: number) => {
        setFormFields(prev => prev.filter((_, i) => i !== index));
    };

    const saveForm = async () => {
        if (!formName.trim()) {
            setError('Form name is required');
            return;
        }

        try {
            const payload = {
                name: formName,
                description: formDescription,
                form_type: formType,
                follow_up_for: formType === 'officer' && followUpFor ? followUpFor : null,
                geo_mode: geoMode,
                schema: formFields,
                is_active: true,
                map_icon: (editingForm as any)?.map_icon || 'warning',
                map_color: (editingForm as any)?.map_color || '#f97316',
                event_category: (editingForm as any)?.event_category || 'environmental_hazard',
            };

            const method = editingForm ? 'PUT' : 'POST';
            const url = editingForm
                ? `${API_BASE}/inehss/forms/${editingForm.id}/`
                : `${API_BASE}/inehss/forms/`;

            const res = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('Failed to save form');

            showSuccess(editingForm ? 'Form updated!' : 'Form created!');
            setIsFormBuilderOpen(false);
            resetFormBuilder();
            loadData();
        } catch (err) {
            setError('Failed to save form');
        }
    };

    const resetFormBuilder = () => {
        setEditingForm(null);
        setFormName('');
        setFormDescription('');
        setFormType('public');
        setFollowUpFor('');
        setGeoMode('manual');
        setFormFields([]);
    };

    const openFormBuilder = (form?: FormTemplate) => {
        if (form) {
            setEditingForm(form);
            setFormName(form.name);
            setFormDescription(form.description);
            setFormType(form.form_type);
            setFollowUpFor(form.follow_up_for || '');
            setGeoMode(form.geo_mode || 'manual');
            setFormFields(form.schema || []);
        } else {
            resetFormBuilder();
        }
        setIsFormBuilderOpen(true);
    };

    // === Assignment ===

    const createAssignment = async () => {
        // Prevent double submission
        if (isSubmittingAssignment) return;

        const isDirect = !!directAssignmentTemplate;

        // Validation: ensure required fields are set
        if (!selectedOfficer) {
            setError('Please select an officer');
            return;
        }

        // For direct assignments, we need the template; for regular assignments, we need both report and form
        if (isDirect) {
            if (!directAssignmentTemplate) {
                setError('Please select an inspection template for direct assignment');
                return;
            }
        } else {
            if (!assignmentModalReport) {
                setError('No report selected. Please select a report first.');
                return;
            }
            if (!selectedInspectionForm) {
                setError('Please select an inspection form');
                return;
            }
        }

        setIsSubmittingAssignment(true);

        try {
            let finalReportId = assignmentModalReport?.id;
            let finalFormId = selectedInspectionForm;

            // For direct assignments (Patrol Mode), don't create a report
            // Just assign the form directly to the officer
            if (!isDirect && !finalReportId) {
                console.error("Critical Error: Missing Report ID for non-direct assignment", { isDirect, assignmentModalReport });
                throw new Error('Could not determine report ID for assignment');
            }

            const payload: any = {
                officer: selectedOfficer,
                inspection_form: finalFormId || directAssignmentTemplate?.id,
                notes: assignmentNotes,
                is_persistent: isDirect || isPatrolMode, // Patrol Mode assignments are persistent
            };

            // Only include report if it's a regular assignment (not direct Patrol Mode)
            if (!isDirect) {
                payload.report = finalReportId;
            }

            const res = await fetch(`${API_BASE}/inehss/assignments/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`,
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error('Failed to create assignment');

            showSuccess('Assignment created!');
            setAssignmentModalReport(null);
            setDirectAssignmentTemplate(null);
            setSelectedOfficer('');
            setSelectedInspectionForm('');
            setAssignmentNotes('');
            setIsPatrolMode(false);
            loadData();
        } catch (err) {
            setError('Failed to create assignment');
        } finally {
            setIsSubmittingAssignment(false);
        }
    };

    const createOfficer = async () => {
        if (!newOfficerUsername || !newOfficerPassword) {
            setError('Username and password are required');
            return;
        }

        try {
            const res = await fetch(`${API_BASE}/inehss/officers/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getToken()}`,
                },
                body: JSON.stringify({
                    username: newOfficerUsername,
                    email: newOfficerEmail,
                    password: newOfficerPassword,
                }),
            });

            if (!res.ok) throw new Error('Failed to create officer');

            showSuccess('Officer created successfully!');
            setIsOfficerModalOpen(false);
            setNewOfficerUsername('');
            setNewOfficerEmail('');
            setNewOfficerPassword('');
            loadData();
        } catch (err) {
            setError('Failed to create officer');
        }
    };

    const getStatusColor = (status: string) => {
        const colors: Record<string, string> = {
            new: 'text-blue-400 bg-blue-500/20',
            assigned: 'text-purple-400 bg-purple-500/20',
            in_progress: 'text-amber-400 bg-amber-500/20',
            resolved: 'text-green-400 bg-green-500/20',
            closed: 'text-slate-400 bg-slate-500/20',
        };
        return colors[status] || 'text-slate-400 bg-slate-500/20';
    };

    const getPriorityColor = (priority: string) => {
        const colors: Record<string, string> = {
            low: 'text-slate-300 bg-slate-500/20',
            medium: 'text-yellow-300 bg-yellow-500/20',
            high: 'text-orange-300 bg-orange-500/20',
            critical: 'text-red-300 bg-red-500/20',
        };
        return colors[priority] || 'text-slate-400 bg-slate-500/20';
    };

    const getOriginColor = (originCode?: string) => {
        const colors: Record<string, string> = {
            public: 'text-cyan-300 bg-cyan-500/20',
            patrol: 'text-purple-300 bg-purple-500/20',
            follow_up: 'text-emerald-300 bg-emerald-500/20',
            unknown: 'text-slate-300 bg-slate-500/20',
        };
        return colors[originCode || 'unknown'] || colors.unknown;
    };

    const getReportTaskSummary = (report: HazardReportAdmin) => {
        const assignmentCount = report.assignment_count || 0;
        if (assignmentCount > 0) {
            return `${assignmentCount} task${assignmentCount === 1 ? '' : 's'} linked${report.assigned_officer ? ` • lead: ${report.assigned_officer}` : ''}`;
        }
        if (report.report_origin?.code === 'patrol') {
            return 'No follow-up task yet';
        }
        return 'No officer task yet';
    };

    const getReportActionConfig = (report: HazardReportAdmin) => {
        const hasAssignments = (report.assignment_count || 0) > 0 || !!report.assigned_officer;

        if (report.report_origin?.code === 'patrol') {
            return hasAssignments
                ? {
                    label: 'Add Follow-up',
                    tooltip: 'This patrol-originated report already has linked field work. Create another follow-up task if more investigation is needed.',
                    className: 'px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs transition-all whitespace-nowrap',
                }
                : {
                    label: 'Create Follow-up Task',
                    tooltip: 'This report came from officer patrol activity. Create a new task only if it needs additional field action or supervision.',
                    className: 'px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs transition-all whitespace-nowrap',
                };
        }

        if (report.report_origin?.code === 'follow_up') {
            return hasAssignments
                ? {
                    label: 'Add Another Task',
                    tooltip: 'This follow-up report already has linked tasks. Create an additional task if another officer action is required.',
                    className: 'px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs transition-all whitespace-nowrap',
                }
                : {
                    label: 'Assign Follow-up',
                    tooltip: 'Dispatch this follow-up report to an officer so the next operational step is tracked explicitly.',
                    className: 'px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs transition-all whitespace-nowrap',
                };
        }

        return hasAssignments
            ? {
                label: 'Add Follow-up',
                tooltip: 'This report already has an officer task linked to it. Create another follow-up assignment if more field work is needed.',
                className: 'px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs transition-all whitespace-nowrap',
            }
            : {
                label: 'Assign Officer',
                tooltip: 'Create the first officer task from this incoming public report so investigation can begin.',
                className: 'px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs transition-all whitespace-nowrap',
            };
    };

    const formatShortDate = (value: string) => new Date(value).toLocaleDateString();

    const csvEscape = (value: unknown) => {
        const normalized = value === null || value === undefined ? '' : String(value);
        return `"${normalized.replace(/"/g, '""')}"`;
    };

    const downloadFile = (fileName: string, mimeType: string, content: string) => {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        window.URL.revokeObjectURL(url);
    };

    const exportReports = (format: 'csv' | 'json') => {
        if (visibleReports.length === 0) {
            setError('No reports available to export for the current filters');
            return;
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

        if (format === 'json') {
            downloadFile(
                `inehss_reports_${timestamp}.json`,
                'application/json;charset=utf-8',
                JSON.stringify(visibleReports, null, 2),
            );
            showSuccess('Filtered reports exported as JSON');
            return;
        }

        const headers = [
            'tracking_id',
            'form',
            'version',
            'origin',
            'status',
            'priority',
            'reporter',
            'assigned_officer',
            'assignment_count',
            'address',
            'has_attachments',
            'attachment_count',
            'created_at',
        ];

        const rows = visibleReports.map((report) => [
            report.tracking_id,
            report.form_version?.template_name || '',
            report.form_version?.version_number || '',
            report.report_origin?.label || '',
            report.status,
            report.priority,
            report.reporter_name,
            report.assigned_officer || '',
            report.assignment_count || 0,
            report.address,
            report.attachments && report.attachments.length > 0 ? 'yes' : 'no',
            report.attachments?.length || 0,
            report.created_at,
        ].map(csvEscape).join(','));

        downloadFile(
            `inehss_reports_${timestamp}.csv`,
            'text/csv;charset=utf-8',
            [headers.join(','), ...rows].join('\n'),
        );
        showSuccess('Filtered reports exported as CSV');
    };

    const visibleReports = reports;
    const reportStats = {
        active: visibleReports.filter(report => ['new', 'assigned', 'in_progress'].includes(report.status)).length,
        critical: visibleReports.filter(report => report.priority === 'critical').length,
        withEvidence: visibleReports.filter(report => (report.attachments?.length || 0) > 0).length,
    };

    const officerForms = forms.filter(f => f.form_type === 'officer' && !f.follow_up_for);
    const getFollowUpOptionsForReport = (report: HazardReportAdmin | null) => {
        const templateId = report?.form_version?.template_id;
        if (!templateId) return [];
        return forms.filter(form => form.form_type === 'officer' && form.follow_up_for === templateId);
    };
    const linkedFollowUpForms = getFollowUpOptionsForReport(assignmentModalReport);
    const eligibleBaseForms = forms.filter(form => form.id !== editingForm?.id);
    const reportableForms = forms.filter(f => f.form_type === 'public');
    const assignmentModalAction = assignmentModalReport ? getReportActionConfig(assignmentModalReport) : null;

    const clearReportFilters = () => {
        setReportSearch('');
        setReportStatusFilter('all');
        setReportPriorityFilter('all');
        setReportOfficerFilter('all');
        setReportFormFilter('all');
        setReportAttachmentFilter('all');
        setReportCreatedFrom('');
        setReportCreatedTo('');
    };

    const handleApproveAssignment = async (assignmentId: string) => {
        const token = getToken();
        if (!token) return;
        try {
            await approveAssignment(assignmentId, token);
            showSuccess('Assignment approved');
            await loadData();
        } catch {
            setError('Failed to approve assignment');
        }
    };

    const handleRequestRevision = async (assignmentId: string) => {
        const token = getToken();
        if (!token) return;
        const notes = window.prompt('Revision notes for officer:');
        if (!notes) return;
        try {
            await requestAssignmentRevision(assignmentId, notes, token);
            showSuccess('Revision requested');
            await loadData();
        } catch {
            setError('Failed to request revision');
        }
    };

    const handleReassign = async () => {
        const token = getToken();
        if (!token || !reassignModalAssignmentId) return;
        if (!reassignOfficerId) {
            setError('Select an officer to reassign');
            return;
        }

        try {
            await reassignAssignment(reassignModalAssignmentId, Number(reassignOfficerId), reassignReason, token);
            showSuccess('Assignment reassigned');
            setReassignModalAssignmentId(null);
            setReassignOfficerId('');
            setReassignReason('');
            await loadData();
        } catch {
            setError('Failed to reassign assignment');
        }
    };

    return (
        <div className="h-full flex flex-col animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <span className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </span>
                        INEHSS Control
                    </h2>
                    <p className="text-xs text-slate-500">Environmental Health Surveillance Management</p>
                </div>
                <a
                    href="/inehss/officer"
                    target="_blank"
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition-all flex items-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Officer Portal
                </a>
            </div>

            {/* Messages */}
            {error && (
                <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-2 rounded-lg text-sm flex justify-between">
                    {error}
                    <button onClick={() => setError(null)}>✕</button>
                </div>
            )}
            {successMessage && (
                <div className="mb-4 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-2 rounded-lg text-sm">
                    {successMessage}
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                {[
                    { key: 'forms', label: 'Forms', tip: 'Create and manage form templates (both public reporting forms and officer inspection forms).' },
                    { key: 'reports', label: 'Reports', tip: 'View all incoming hazard reports submitted by the public or generated through officer assignments.' },
                    { key: 'assignments', label: 'Assignments', tip: 'Track officer assignments, their progress, and manage escalations or reassignments.' },
                    { key: 'officers', label: 'Officers', tip: 'Manage registered officers who can be assigned to investigate reports.' },
                ].map(tab => (
                    <Tooltip key={tab.key} content={tab.tip}>
                        <button
                            onClick={() => setActiveTab(tab.key as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                                ? 'bg-green-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                                }`}
                        >
                            {tab.label}
                        </button>
                    </Tooltip>
                ))}
            </div>

            {/* Content */}
            {isLoading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Forms Tab */}
                    {activeTab === 'forms' && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    onClick={() => openFormBuilder()}
                                    className="py-3 border-2 border-dashed border-slate-700 hover:border-green-500 rounded-xl text-slate-400 hover:text-green-400 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Create Form
                                </button>

                                <button
                                    onClick={() => {
                                        // Create a temporary patrol mode template if no officer forms exist
                                        if (officerForms.length === 0) {
                                            setError('Please create an officer-type form first');
                                            return;
                                        }
                                        // Set the first officer form as the direct assignment template
                                        setDirectAssignmentTemplate(officerForms[0]);
                                        setSelectedInspectionForm(officerForms[0].id);
                                    }}
                                    className="py-3 border-2 border-dashed border-purple-500/50 hover:border-purple-400 rounded-xl text-purple-400 hover:text-purple-300 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                    </svg>
                                    Patrol Mode
                                </button>
                            </div>

                            {forms.map(form => (
                                <div
                                    key={form.id}
                                    className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-green-500/50 transition-all"
                                >
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-white font-medium">{form.name}</h3>
                                            <p className="text-sm text-slate-400 mt-1">{form.description}</p>
                                            <div className="flex gap-2 mt-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${form.form_type === 'public' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                                                    }`}>
                                                    {form.form_type}
                                                </span>
                                                {form.is_follow_up && (
                                                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
                                                        Follow-up for {form.follow_up_for_name}
                                                    </span>
                                                )}
                                                <span className="text-xs text-slate-500">{form.schema?.length || 0} fields</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {form.form_type === 'officer' && !form.follow_up_for && (
                                                <Tooltip content="Assign this technical form directly to an officer.">
                                                    <button
                                                        onClick={() => {
                                                            setDirectAssignmentTemplate(form);
                                                            setSelectedInspectionForm(form.id);
                                                        }}
                                                        className="p-2 hover:bg-purple-500/20 text-purple-400 rounded-lg transition-colors border border-transparent hover:border-purple-500/30"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                                        </svg>
                                                    </button>
                                                </Tooltip>
                                            )}
                                            <Link
                                                to={`/inehss/forms/${form.id}/history`}
                                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                                                title="View Version History"
                                            >
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            </Link>
                                            <button
                                                onClick={() => openFormBuilder(form)}
                                                className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )
                    }

                    {/* Reports Tab */}
                    {
                        activeTab === 'reports' && (
                            <div className="space-y-3">
                                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div>
                                            <h3 className="text-sm font-semibold text-white">Operational report filters</h3>
                                            <p className="text-xs text-slate-500">Search and narrow the raw report queue by workflow, officer, schema, evidence, and date.</p>
                                        </div>
                                        <button
                                            onClick={clearReportFilters}
                                            className="px-3 py-1.5 rounded-lg border border-slate-600 text-xs text-slate-300 hover:border-slate-500 hover:text-white transition-all"
                                        >
                                            Clear filters
                                        </button>
                                    </div>

                                    <div className="grid md:grid-cols-3 gap-3">
                                        <input
                                            value={reportSearch}
                                            onChange={(e) => setReportSearch(e.target.value)}
                                            placeholder="Search tracking ID, reporter, address, form"
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        />
                                        <select
                                            value={reportStatusFilter}
                                            onChange={(e) => setReportStatusFilter(e.target.value)}
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        >
                                            <option value="all">All statuses</option>
                                            {['new', 'assigned', 'in_progress', 'resolved', 'closed'].map(status => (
                                                <option key={status} value={status}>{status}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={reportPriorityFilter}
                                            onChange={(e) => setReportPriorityFilter(e.target.value)}
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        >
                                            <option value="all">All priorities</option>
                                            {['low', 'medium', 'high', 'critical'].map(priority => (
                                                <option key={priority} value={priority}>{priority}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="grid md:grid-cols-4 gap-3">
                                        <select
                                            value={reportOfficerFilter}
                                            onChange={(e) => setReportOfficerFilter(e.target.value)}
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        >
                                            <option value="all">All officers</option>
                                            {officers.map(officer => (
                                                <option key={officer.id} value={officer.username}>{officer.username}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={reportFormFilter}
                                            onChange={(e) => setReportFormFilter(e.target.value)}
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        >
                                            <option value="all">All report forms</option>
                                            {reportableForms.map(form => (
                                                <option key={form.id} value={form.id}>{form.name}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={reportAttachmentFilter}
                                            onChange={(e) => setReportAttachmentFilter(e.target.value)}
                                            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white"
                                        >
                                            <option value="all">All evidence states</option>
                                            <option value="with_attachments">With attachments</option>
                                            <option value="without_attachments">Without attachments</option>
                                        </select>
                                        <div className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-400 flex items-center justify-between">
                                            <span>{visibleReports.length} matching report{visibleReports.length === 1 ? '' : 's'}</span>
                                            <span className="text-slate-500">live</span>
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-3">
                                        <label className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white flex flex-col gap-1">
                                            <span className="text-[11px] uppercase tracking-wide text-slate-500">Created from</span>
                                            <input
                                                type="date"
                                                value={reportCreatedFrom}
                                                onChange={(e) => setReportCreatedFrom(e.target.value)}
                                                className="bg-transparent text-white outline-none"
                                            />
                                        </label>
                                        <label className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white flex flex-col gap-1">
                                            <span className="text-[11px] uppercase tracking-wide text-slate-500">Created to</span>
                                            <input
                                                type="date"
                                                value={reportCreatedTo}
                                                onChange={(e) => setReportCreatedTo(e.target.value)}
                                                className="bg-transparent text-white outline-none"
                                            />
                                        </label>
                                    </div>
                                </div>
                                <div className="grid md:grid-cols-3 gap-3">
                                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">Active queue</p>
                                            <Tooltip content="Reports still in the active operational queue: new, assigned, or in progress.">
                                                <span className="text-[11px] text-slate-600 cursor-help">ⓘ</span>
                                            </Tooltip>
                                        </div>
                                        <p className="text-2xl font-bold text-blue-300">{reportStats.active}</p>
                                    </div>
                                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                        <div className="flex items-center gap-2 mb-1">
                                            <p className="text-xs uppercase tracking-wide text-slate-500">Critical priority</p>
                                            <Tooltip content="Filtered reports marked as critical priority and likely needing immediate escalation.">
                                                <span className="text-[11px] text-slate-600 cursor-help">ⓘ</span>
                                            </Tooltip>
                                        </div>
                                        <p className="text-2xl font-bold text-red-300">{reportStats.critical}</p>
                                    </div>
                                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                                        <div className="flex items-center justify-between gap-3 mb-1">
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs uppercase tracking-wide text-slate-500">Evidence-ready</p>
                                                <Tooltip content="How many filtered reports already include attachments or files for verification.">
                                                    <span className="text-[11px] text-slate-600 cursor-help">ⓘ</span>
                                                </Tooltip>
                                            </div>
                                            <div className="flex gap-2">
                                                <Tooltip content="Download the currently filtered reports as CSV for spreadsheet workflows.">
                                                    <button
                                                        onClick={() => exportReports('csv')}
                                                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-all"
                                                    >
                                                        Export CSV
                                                    </button>
                                                </Tooltip>
                                                <Tooltip content="Download the currently filtered reports as JSON for data exchange or API-style handoff.">
                                                    <button
                                                        onClick={() => exportReports('json')}
                                                        className="px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium transition-all"
                                                    >
                                                        Export JSON
                                                    </button>
                                                </Tooltip>
                                            </div>
                                        </div>
                                        <p className="text-2xl font-bold text-amber-300">{reportStats.withEvidence}</p>
                                    </div>
                                </div>

                                {visibleReports.length === 0 ? (
                                    <div className="text-center py-12 text-slate-500">No reports found for selected filters</div>
                                ) : (
                                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between gap-3 flex-wrap">
                                            <div>
                                                <h3 className="text-sm font-semibold text-white">Operations Table</h3>
                                                <p className="text-xs text-slate-500">A compact command view for triage, follow-up assignment, and quick inspection.</p>
                                            </div>
                                            <Tooltip content="Each row represents one report record. Source explains where it came from, while the action button adapts to whether you are dispatching first response or creating more follow-up work.">
                                                <span className="text-xs text-slate-500 cursor-help">How this table works ⓘ</span>
                                            </Tooltip>
                                        </div>

                                        <div className="overflow-x-auto">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-slate-900/70 text-slate-400 uppercase text-[11px] tracking-wide">
                                                    <tr>
                                                        <th className="text-left px-4 py-3">Tracking ID</th>
                                                        <th className="text-left px-4 py-3">Form</th>
                                                        <th className="text-left px-4 py-3">Source</th>
                                                        <th className="text-left px-4 py-3">Status</th>
                                                        <th className="text-left px-4 py-3">Priority</th>
                                                        <th className="text-left px-4 py-3">Reporter / Task State</th>
                                                        <th className="text-left px-4 py-3">Location</th>
                                                        <th className="text-left px-4 py-3">Evidence</th>
                                                        <th className="text-left px-4 py-3">Created</th>
                                                        <th className="text-right px-4 py-3">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {visibleReports.map(report => {
                                                        const actionConfig = getReportActionConfig(report);

                                                        return (
                                                            <tr key={report.id} className="border-t border-slate-700/70 hover:bg-slate-900/40 transition-colors">
                                                                <td className="px-4 py-3 align-top">
                                                                    <Link to={`/inehss/reports/${report.id}`} className="font-mono text-green-400 hover:text-green-300">
                                                                        {report.tracking_id}
                                                                    </Link>
                                                                </td>
                                                                <td className="px-4 py-3 align-top text-slate-300">
                                                                    <div>{report.form_version?.template_name || 'Unknown form'}</div>
                                                                    <div className="text-xs text-slate-500">v{report.form_version?.version_number}</div>
                                                                </td>
                                                                <td className="px-4 py-3 align-top">
                                                                    <Tooltip content={report.report_origin?.description || 'Source could not be determined yet.'}>
                                                                        <div>
                                                                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${getOriginColor(report.report_origin?.code)}`}>
                                                                                {report.report_origin?.label || 'Unknown Origin'}
                                                                            </span>
                                                                            <div className="text-xs text-slate-500 mt-2">
                                                                                {report.report_origin?.code === 'patrol'
                                                                                    ? 'Officer field-created'
                                                                                    : report.report_origin?.code === 'follow_up'
                                                                                        ? 'Linked to prior report'
                                                                                        : 'Incoming intake'}
                                                                            </div>
                                                                        </div>
                                                                    </Tooltip>
                                                                </td>
                                                                <td className="px-4 py-3 align-top">
                                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(report.status)}`}>
                                                                        {report.status.replace(/_/g, ' ')}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 align-top">
                                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityColor(report.priority)}`}>
                                                                        {report.priority}
                                                                    </span>
                                                                </td>
                                                                <td className="px-4 py-3 align-top text-slate-300">
                                                                    <div>{report.reporter_name || (report.report_origin?.code === 'public' ? 'Anonymous public submitter' : 'System-generated')}</div>
                                                                    <div className="text-xs text-slate-500">{getReportTaskSummary(report)}</div>
                                                                </td>
                                                                <td className="px-4 py-3 align-top text-slate-400 max-w-[220px]">
                                                                    <div className="truncate">{report.address || 'No address'}</div>
                                                                </td>
                                                                <td className="px-4 py-3 align-top text-slate-300">
                                                                    <div>{report.attachments?.length || 0} file(s)</div>
                                                                    <div className="text-xs text-slate-500">{(report.attachments?.length || 0) > 0 ? 'Ready for review' : 'No attachments'}</div>
                                                                </td>
                                                                <td className="px-4 py-3 align-top text-slate-400 whitespace-nowrap">
                                                                    {formatShortDate(report.created_at)}
                                                                </td>
                                                                <td className="px-4 py-3 align-top">
                                                                    <div className="flex items-center justify-end gap-2">
                                                                        <Link
                                                                            to={`/inehss/reports/${report.id}`}
                                                                            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs transition-all whitespace-nowrap"
                                                                        >
                                                                            Open
                                                                        </Link>
                                                                        <Tooltip content={actionConfig.tooltip} position="left">
                                                                            <button
                                                                                onClick={() => {
                                                                                    setAssignmentModalReport(report);
                                                                                    const followUpOptions = getFollowUpOptionsForReport(report);
                                                                                    setSelectedInspectionForm(followUpOptions[0]?.id || '');
                                                                                }}
                                                                                className={actionConfig.className}
                                                                            >
                                                                                {actionConfig.label}
                                                                            </button>
                                                                        </Tooltip>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    }

                    {/* Assignments Tab */}
                    {
                        activeTab === 'assignments' && (
                            <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                <div className="grid grid-cols-8 gap-4 p-4 border-b border-slate-700 bg-slate-800/50 text-xs text-slate-400 font-bold uppercase">
                                    <div>Officer</div>
                                    <div>Report</div>
                                    <div>Form</div>
                                    <div>Status</div>
                                    <div>Submissions</div>
                                    <div>Assigned</div>
                                    <div>Progress</div>
                                    <div>Actions</div>
                                </div>
                                {assignments.length === 0 ? (
                                    <div className="p-8 text-center text-slate-500">No assignments found.</div>
                                ) : (
                                    assignments.map(assignment => (
                                        <div key={assignment.id} className="grid grid-cols-8 gap-4 p-4 border-b border-slate-700/50 items-center text-sm text-slate-300">
                                            <div className="font-medium text-white">{assignment.officer_username}</div>
                                            <div>
                                                {assignment.report ? (
                                                    <>
                                                        <div className="font-bold text-white">{assignment.report.tracking_id}</div>
                                                        <div className="text-xs text-slate-500">{assignment.report.form_version?.template_name}</div>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-bold rounded uppercase">
                                                            Patrol
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <div>{assignment.form_version?.template_name || 'N/A'} (v{assignment.form_version?.version_number || '?'})</div>
                                            <div>
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${assignment.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400' :
                                                    assignment.status === 'accepted' ? 'bg-blue-500/20 text-blue-400' :
                                                        'bg-yellow-500/20 text-yellow-400'
                                                    }`}>
                                                    {assignment.status.toUpperCase()}
                                                </span>
                                            </div>
                                            <div>
                                                {assignment.is_persistent ? (
                                                    <div className="flex items-center gap-2">
                                                        <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-500/20 text-purple-400 text-xs font-bold rounded-full">
                                                            {assignment.submission_count || 0}
                                                        </span>
                                                        <span className="text-xs text-slate-500">submitted</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-500">-</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {new Date(assignment.assigned_at).toLocaleDateString()}
                                                {assignment.completed_at && (
                                                    <div className="text-emerald-500">
                                                        Done: {new Date(assignment.completed_at).toLocaleDateString()}
                                                    </div>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-xs text-slate-400 mb-1">{assignment.progress_percent || 0}%</div>
                                                <div className="w-full h-2 rounded bg-slate-700 overflow-hidden">
                                                    <div className="h-full bg-emerald-500" style={{ width: `${assignment.progress_percent || 0}%` }} />
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                {['awaiting_review', 'revision_needed'].includes(assignment.status) && (
                                                    <button onClick={() => handleApproveAssignment(assignment.id)} className="text-xs px-2 py-1 rounded bg-emerald-700/60 hover:bg-emerald-600 text-white">Approve</button>
                                                )}
                                                {['awaiting_review', 'approved'].includes(assignment.status) && (
                                                    <button onClick={() => handleRequestRevision(assignment.id)} className="text-xs px-2 py-1 rounded bg-amber-700/60 hover:bg-amber-600 text-white">Revision</button>
                                                )}
                                                <button
                                                    onClick={() => setReassignModalAssignmentId(assignment.id)}
                                                    className="text-xs px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-white"
                                                >
                                                    Reassign
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )
                    }
                    {/* Officers Tab */}
                    {
                        activeTab === 'officers' && (
                            <div className="space-y-4">
                                <button
                                    onClick={() => setIsOfficerModalOpen(true)}
                                    className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-green-500 rounded-xl text-slate-400 hover:text-green-400 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                    Register New Officer
                                </button>

                                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                                    <div className="grid grid-cols-3 gap-4 p-4 border-b border-slate-700 bg-slate-800/50 text-xs text-slate-400 font-bold uppercase">
                                        <div>Username</div>
                                        <div>Email</div>
                                        <div>Joined</div>
                                    </div>
                                    {officers.map(officer => (
                                        <div key={officer.id} className="grid grid-cols-3 gap-4 p-4 border-b border-slate-700/50 items-center text-sm text-slate-300">
                                            <div className="font-medium text-white">{officer.username}</div>
                                            <div>{officer.email || '-'}</div>
                                            <div className="text-xs text-slate-500">
                                                {(officer as any).date_joined ? new Date((officer as any).date_joined).toLocaleDateString() : '-'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    }
                </div >
            )}

            {
                reassignModalAssignmentId && (
                    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                        <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-3">
                            <h3 className="text-white font-semibold">Reassign Assignment</h3>
                            <select
                                value={reassignOfficerId}
                                onChange={(e) => setReassignOfficerId(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                            >
                                <option value="">Select officer</option>
                                {officers.map(officer => (
                                    <option key={officer.id} value={officer.id}>{officer.username}</option>
                                ))}
                            </select>
                            <textarea
                                value={reassignReason}
                                onChange={(e) => setReassignReason(e.target.value)}
                                rows={3}
                                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white"
                                placeholder="Reason for reassignment"
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setReassignModalAssignmentId(null)} className="px-4 py-2 text-slate-300">Cancel</button>
                                <button onClick={handleReassign} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded">Reassign</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Create Officer Modal */}
            {
                isOfficerModalOpen && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Register New Officer</h3>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-500 uppercase mb-1">Username</label>
                                    <input
                                        type="text"
                                        value={newOfficerUsername}
                                        onChange={e => setNewOfficerUsername(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 uppercase mb-1">Email</label>
                                    <input
                                        type="email"
                                        value={newOfficerEmail}
                                        onChange={e => setNewOfficerEmail(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-500 uppercase mb-1">Password</label>
                                    <input
                                        type="password"
                                        value={newOfficerPassword}
                                        onChange={e => setNewOfficerPassword(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-2 mt-6">
                                <button
                                    onClick={() => setIsOfficerModalOpen(false)}
                                    className="px-4 py-2 text-slate-400 hover:text-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createOfficer}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg"
                                >
                                    Create Account
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Form Builder Modal */}
            {
                isFormBuilderOpen && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="p-6 border-b border-slate-800 flex justify-between items-center sticky top-0 bg-slate-900">
                                <h3 className="text-lg font-bold text-white">
                                    {editingForm ? 'Edit Form' : 'Create New Form'}
                                </h3>
                                <button
                                    onClick={() => setIsFormBuilderOpen(false)}
                                    className="p-2 hover:bg-slate-800 rounded-lg"
                                >
                                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-500 uppercase mb-1">Form Name</label>
                                    <input
                                        type="text"
                                        value={formName}
                                        onChange={e => setFormName(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                        placeholder="e.g., Water Quality Report"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-slate-500 uppercase mb-1">Description</label>
                                    <textarea
                                        value={formDescription}
                                        onChange={e => setFormDescription(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white h-20"
                                        placeholder="Brief description of this form..."
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-xs text-slate-500 uppercase mb-1">Map Icon</label>
                                        <select
                                            value={(editingForm as any)?.map_icon || 'warning'}
                                            onChange={e => setEditingForm(prev => prev ? { ...prev, map_icon: e.target.value } : null)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                        >
                                            <option value="warning">Warning (Triangle)</option>
                                            <option value="alert">Alert (Circle)</option>
                                            <option value="biohazard">Biohazard</option>
                                            <option value="radiation">Radiation</option>
                                            <option value="info">Info</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 uppercase mb-1">Map Color</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="color"
                                                value={(editingForm as any)?.map_color || '#f97316'}
                                                onChange={e => setEditingForm(prev => prev ? { ...prev, map_color: e.target.value } : null)}
                                                className="h-10 w-10 rounded cursor-pointer bg-transparent border-none"
                                            />
                                            <input
                                                type="text"
                                                value={(editingForm as any)?.map_color || '#f97316'}
                                                onChange={e => setEditingForm(prev => prev ? { ...prev, map_color: e.target.value } : null)}
                                                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs text-slate-500 uppercase mb-1">Event Category</label>
                                        <input
                                            type="text"
                                            value={(editingForm as any)?.event_category || 'environmental_hazard'}
                                            onChange={e => setEditingForm(prev => prev ? { ...prev, event_category: e.target.value } : null)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="flex items-center gap-2 text-xs text-slate-500 uppercase mb-1">
                                        Form Type
                                        <Tooltip content="Public forms are visible on the public reporting portal. Officer forms are technical templates used for staff inspections.">
                                            <svg className="w-3.5 h-3.5 text-slate-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </Tooltip>
                                    </label>
                                    <div className="flex gap-2">
                                        {(['public', 'officer'] as const).map(type => (
                                            <button
                                                key={type}
                                                onClick={() => {
                                                    setFormType(type);
                                                    if (type === 'public') {
                                                        setFollowUpFor('');
                                                    }
                                                }}
                                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${formType === type
                                                    ? type === 'public' ? 'bg-blue-600 text-white' : 'bg-purple-600 text-white'
                                                    : 'bg-slate-800 text-slate-400'
                                                    }`}
                                            >
                                                {type === 'public' ? 'Public (Anyone)' : 'Officer (Auth Required)'}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {formType === 'officer' && (
                                    <div>
                                        <label className="block text-xs text-slate-500 uppercase mb-2">Follow-up Base Form (Optional)</label>
                                        <select
                                            value={followUpFor}
                                            onChange={e => setFollowUpFor(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                        >
                                            <option value="">Standard officer form</option>
                                            {eligibleBaseForms.map(form => (
                                                <option key={form.id} value={form.id}>
                                                    {form.name} ({form.form_type})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500 mt-2">
                                            Link this officer form to a specific form template so Assign Follow-up can find it automatically.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className="flex items-center gap-2 text-xs text-slate-500 uppercase mb-1">
                                        Geolocation Mode
                                        <Tooltip content="Controls how location is captured: Disabled hides the map, Manual lets users pin a location, Auto captures GPS automatically.">
                                            <svg className="w-3.5 h-3.5 text-slate-600 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </Tooltip>
                                    </label>
                                    <div className="flex gap-2">
                                        {([{ key: 'disabled', label: 'Disabled', color: 'bg-red-600' }, { key: 'manual', label: 'Manual (Pin)', color: 'bg-yellow-600' }, { key: 'auto', label: 'Auto GPS', color: 'bg-green-600' }] as const).map(mode => (
                                            <button
                                                key={mode.key}
                                                onClick={() => setGeoMode(mode.key)}
                                                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${geoMode === mode.key
                                                    ? `${mode.color} text-white`
                                                    : 'bg-slate-800 text-slate-400'
                                                    }`}
                                            >
                                                {mode.label}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="text-xs text-slate-600 mt-1">
                                        {geoMode === 'disabled' ? 'Location capture will be hidden from reporters.' :
                                            geoMode === 'manual' ? 'Reporters can optionally pin their location on a map.' :
                                                'GPS will be captured automatically when the form loads.'}
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs text-slate-500 uppercase mb-2">Form Fields</label>
                                    <div className="space-y-3">
                                        {formFields.map((field, idx) => (
                                            <div key={idx} className="bg-slate-800 border border-slate-700 rounded-lg p-3">
                                                <div className="flex gap-2 mb-2">
                                                    <input
                                                        type="text"
                                                        value={field.label}
                                                        onChange={e => updateField(idx, { label: e.target.value, name: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                                        className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                                                        placeholder="Field Label"
                                                    />
                                                    <select
                                                        value={field.type}
                                                        onChange={e => updateField(idx, { type: e.target.value as any })}
                                                        className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm"
                                                    >
                                                        <option value="text">Text</option>
                                                        <option value="textarea">Text Area</option>
                                                        <option value="number">Number</option>
                                                        <option value="select">Dropdown</option>
                                                        <option value="multiselect">Multi-Select</option>
                                                        <option value="checkbox">Checkbox</option>
                                                        <option value="radio">Radio</option>
                                                        <option value="date">Date</option>
                                                        <option value="file">File Upload</option>
                                                    </select>
                                                    <label className="flex items-center gap-1 text-xs text-slate-400">
                                                        <input
                                                            type="checkbox"
                                                            checked={field.required}
                                                            onChange={e => updateField(idx, { required: e.target.checked })}
                                                        />
                                                        Required
                                                    </label>
                                                    <button
                                                        onClick={() => removeField(idx)}
                                                        className="p-1.5 hover:bg-red-500/20 rounded text-red-400"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                {['select', 'multiselect', 'radio'].includes(field.type) && (
                                                    <input
                                                        type="text"
                                                        value={field.options?.map(o => o.label).join(', ') || ''}
                                                        onChange={e => updateField(idx, {
                                                            options: e.target.value.split(',').map(s => ({ value: s.trim().toLowerCase().replace(/\s+/g, '_'), label: s.trim() }))
                                                        })}
                                                        className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm mt-2"
                                                        placeholder="Options (comma-separated): Option 1, Option 2, Option 3"
                                                    />
                                                )}

                                                {/* Skip Logic Conditions */}
                                                <div className="mt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const current = field.conditions || [];
                                                            if (current.length === 0) {
                                                                updateField(idx, { conditions: [{ field: '', operator: 'equals', value: '' }] });
                                                            } else {
                                                                updateField(idx, { conditions: undefined });
                                                            }
                                                        }}
                                                        className={`text-[11px] font-medium px-2 py-0.5 rounded transition-all ${field.conditions && field.conditions.length > 0
                                                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                                                            : 'text-slate-500 hover:text-blue-400 hover:bg-blue-500/10'
                                                            }`}
                                                    >
                                                        {field.conditions && field.conditions.length > 0 ? '✦ Skip Logic Active' : '+ Show if…'}
                                                    </button>

                                                    {field.conditions && field.conditions.length > 0 && (
                                                        <div className="mt-2 space-y-2 pl-2 border-l-2 border-blue-500/30">
                                                            {field.conditions.map((cond, condIdx) => {
                                                                // Get the source field's options (if select/radio/multiselect)
                                                                const sourceField = formFields.find(f => f.name === cond.field);
                                                                const hasOptions = sourceField && ['select', 'multiselect', 'radio'].includes(sourceField.type);
                                                                const needsValue = !['not_empty', 'is_empty'].includes(cond.operator);

                                                                return (
                                                                    <div key={condIdx} className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="text-[10px] text-slate-500 uppercase font-bold">
                                                                            {condIdx === 0 ? 'Show if' : 'AND'}
                                                                        </span>
                                                                        <select
                                                                            value={cond.field}
                                                                            onChange={e => {
                                                                                const updated = [...(field.conditions || [])];
                                                                                updated[condIdx] = { ...updated[condIdx], field: e.target.value };
                                                                                updateField(idx, { conditions: updated });
                                                                            }}
                                                                            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-[11px] max-w-[120px]"
                                                                        >
                                                                            <option value="">Select field…</option>
                                                                            {formFields
                                                                                .filter((f, fIdx) => fIdx !== idx)
                                                                                .map(f => (
                                                                                    <option key={f.name} value={f.name}>{f.label || f.name}</option>
                                                                                ))
                                                                            }
                                                                        </select>
                                                                        <select
                                                                            value={cond.operator}
                                                                            onChange={e => {
                                                                                const updated = [...(field.conditions || [])];
                                                                                updated[condIdx] = { ...updated[condIdx], operator: e.target.value as any };
                                                                                updateField(idx, { conditions: updated });
                                                                            }}
                                                                            className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-[11px]"
                                                                        >
                                                                            <option value="equals">equals</option>
                                                                            <option value="not_equals">≠ not equals</option>
                                                                            <option value="contains">contains</option>
                                                                            <option value="not_empty">is not empty</option>
                                                                            <option value="is_empty">is empty</option>
                                                                            <option value="greater_than">&gt; greater than</option>
                                                                            <option value="less_than">&lt; less than</option>
                                                                        </select>
                                                                        {needsValue && (
                                                                            hasOptions ? (
                                                                                <select
                                                                                    value={String(cond.value || '')}
                                                                                    onChange={e => {
                                                                                        const updated = [...(field.conditions || [])];
                                                                                        updated[condIdx] = { ...updated[condIdx], value: e.target.value };
                                                                                        updateField(idx, { conditions: updated });
                                                                                    }}
                                                                                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-[11px] max-w-[120px]"
                                                                                >
                                                                                    <option value="">Select value…</option>
                                                                                    {sourceField?.options?.map(o => (
                                                                                        <option key={o.value} value={o.value}>{o.label}</option>
                                                                                    ))}
                                                                                </select>
                                                                            ) : (
                                                                                <input
                                                                                    type="text"
                                                                                    value={String(cond.value || '')}
                                                                                    onChange={e => {
                                                                                        const updated = [...(field.conditions || [])];
                                                                                        updated[condIdx] = { ...updated[condIdx], value: e.target.value };
                                                                                        updateField(idx, { conditions: updated });
                                                                                    }}
                                                                                    className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-[11px] w-20"
                                                                                    placeholder="value"
                                                                                />
                                                                            )
                                                                        )}
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => {
                                                                                const updated = (field.conditions || []).filter((_, i) => i !== condIdx);
                                                                                updateField(idx, { conditions: updated.length > 0 ? updated : undefined });
                                                                            }}
                                                                            className="p-0.5 hover:bg-red-500/20 rounded text-red-400/60 hover:text-red-400"
                                                                        >
                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                                            </svg>
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })}
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const updated = [...(field.conditions || []), { field: '', operator: 'equals' as const, value: '' }];
                                                                    updateField(idx, { conditions: updated });
                                                                }}
                                                                className="text-[10px] text-blue-400/70 hover:text-blue-400 transition-colors"
                                                            >
                                                                + Add AND condition
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <button
                                            onClick={addField}
                                            className="w-full py-2 border border-dashed border-slate-600 hover:border-green-500 rounded-lg text-slate-400 hover:text-green-400 text-sm transition-all"
                                        >
                                            + Add Field
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 border-t border-slate-800 flex gap-3">
                                <button
                                    onClick={() => setIsFormBuilderOpen(false)}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveForm}
                                    className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-all"
                                >
                                    {editingForm ? 'Update Form' : 'Create Form'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Assignment Modal */}
            {
                (assignmentModalReport || directAssignmentTemplate) && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
                            <div className="p-6 border-b border-slate-800">
                                <div className="flex items-center gap-2 mb-2">
                                    <h3 className="text-lg font-bold text-white">
                                        {directAssignmentTemplate ? 'Patrol Mode Assignment' : assignmentModalAction?.label || 'Assign Report'}
                                    </h3>
                                    {directAssignmentTemplate && (
                                        <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs font-bold rounded uppercase">
                                            Persistent
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-slate-400">
                                    {directAssignmentTemplate
                                        ? `Officer will patrol with ${directAssignmentTemplate.name} form`
                                        : assignmentModalReport
                                            ? `${assignmentModalReport.tracking_id} • ${assignmentModalAction?.tooltip || 'Create an operational task for this report.'}`
                                            : 'Create an operational task for this report.'
                                    }
                                </p>
                            </div>

                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-xs text-slate-500 uppercase mb-1">Officer</label>
                                    <select
                                        value={selectedOfficer}
                                        onChange={e => setSelectedOfficer(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                    >
                                        <option value="">Select an officer...</option>
                                        {officers.map(officer => (
                                            <option key={officer.id} value={officer.id}>{officer.username}</option>
                                        ))}
                                    </select>
                                </div>

                                {!directAssignmentTemplate && assignmentModalReport && (
                                    <div>
                                        <label className="block text-xs text-slate-500 uppercase mb-1">Follow-up Form</label>
                                        <select
                                            value={selectedInspectionForm}
                                            onChange={e => setSelectedInspectionForm(e.target.value)}
                                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white"
                                        >
                                            <option value="">Select a linked follow-up form...</option>
                                            {linkedFollowUpForms.map(form => (
                                                <option key={form.id} value={form.id}>
                                                    {form.name} (v{form.version_number || 1})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500 mt-2">
                                            {linkedFollowUpForms.length > 0
                                                ? `Linked to ${assignmentModalReport.form_version?.template_name}`
                                                : `No follow-up forms are linked to ${assignmentModalReport.form_version?.template_name}. Create one in the Forms tab first.`}
                                        </p>
                                    </div>
                                )}

                                {directAssignmentTemplate && (
                                    <div>
                                        <label className="block text-xs text-slate-500 uppercase mb-1">Inspection Form</label>
                                        <div className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm flex items-center justify-between">
                                            <span>{directAssignmentTemplate.name}</span>
                                            <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-2">Patrol mode form</p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs text-slate-500 uppercase mb-1">Notes (Optional)</label>
                                    <textarea
                                        value={assignmentNotes}
                                        onChange={e => setAssignmentNotes(e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2 text-white h-20"
                                        placeholder="Instructions for the officer..."
                                    />
                                </div>

                                {!directAssignmentTemplate && (
                                    <label className="flex items-center gap-3 p-3 bg-slate-800/50 border border-purple-500/30 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={isPatrolMode}
                                            onChange={e => setIsPatrolMode(e.target.checked)}
                                            className="w-4 h-4 rounded border-slate-600 text-purple-600 cursor-pointer"
                                        />
                                        <div>
                                            <div className="text-sm font-medium text-white">Patrol Mode</div>
                                            <div className="text-xs text-slate-400">Officer can make multiple submissions without closing assignment</div>
                                        </div>
                                    </label>
                                )}
                            </div>

                            <div className="p-6 border-t border-slate-800 flex gap-3">
                                <button
                                    onClick={() => {
                                        setAssignmentModalReport(null);
                                        setDirectAssignmentTemplate(null);
                                        setIsPatrolMode(false);
                                    }}
                                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={createAssignment}
                                    disabled={isSubmittingAssignment}
                                    className={`flex-1 py-3 rounded-lg font-medium transition-all ${isSubmittingAssignment
                                        ? 'bg-purple-800 text-purple-300 cursor-not-allowed'
                                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                                        }`}
                                >
                                    {isSubmittingAssignment ? 'Saving...' : directAssignmentTemplate ? 'Assign Patrol' : assignmentModalAction?.label || 'Assign'}
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default INEHSSAdminModule;
