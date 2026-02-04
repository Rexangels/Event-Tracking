/**
 * INEHSSAdminModule
 * Admin interface for managing INEHSS forms and assignments
 */

import React, { useState, useEffect } from 'react';
import { FormTemplate, FormField, acceptAssignment, submitInspection, completeAssignment } from '../services/inehssService';
import Tooltip from './ui/Tooltip';

interface HazardReportAdmin {
    id: string;
    tracking_id: string;
    form_template: { name: string };
    status: string;
    priority: string;
    address: string;
    reporter_name: string;
    created_at: string;
}

interface Officer {
    id: number;
    username: string;
    email?: string;
}

const API_BASE = 'http://localhost:8000/api/v1';

interface OfficerAssignment {
    id: string;
    report: HazardReportAdmin;
    officer_username: string;
    inspection_form: { name: string };
    status: string;
    assigned_at: string;
    is_persistent?: boolean;
    submission_count?: number;
    due_date?: string;
    completed_at?: string;
}

const INEHSSAdminModule: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'forms' | 'reports' | 'assignments' | 'officers'>('forms');
    const [forms, setForms] = useState<FormTemplate[]>([]);
    const [reports, setReports] = useState<HazardReportAdmin[]>([]);
    const [assignments, setAssignments] = useState<OfficerAssignment[]>([]);
    const [officers, setOfficers] = useState<Officer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Form Builder State
    const [isFormBuilderOpen, setIsFormBuilderOpen] = useState(false);
    const [editingForm, setEditingForm] = useState<FormTemplate | null>(null);
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formType, setFormType] = useState<'public' | 'officer'>('public');
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

            // Load reports
            const reportsRes = await fetch(`${API_BASE}/inehss/reports/`, { headers });
            if (!reportsRes.ok) console.error('Reports error:', reportsRes.status);
            const reportsData = await reportsRes.json();
            setReports(reportsData.results || reportsData);

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
        setFormFields([]);
    };

    const openFormBuilder = (form?: FormTemplate) => {
        if (form) {
            setEditingForm(form);
            setFormName(form.name);
            setFormDescription(form.description);
            setFormType(form.form_type);
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

    const officerForms = forms.filter(f => f.form_type === 'officer');

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
                {(['forms', 'reports', 'assignments', 'officers'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as any)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab
                            ? 'bg-green-600 text-white'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
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
                                                <span className="text-xs text-slate-500">{form.schema?.length || 0} fields</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {form.form_type === 'officer' && (
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
                    )}

                    {/* Reports Tab */}
                    {activeTab === 'reports' && (
                        <div className="space-y-3">
                            {reports.length === 0 ? (
                                <div className="text-center py-12 text-slate-500">No reports yet</div>
                            ) : (
                                reports.map(report => (
                                    <div
                                        key={report.id}
                                        className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-slate-600 transition-all"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-green-400">{report.tracking_id}</span>
                                                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(report.status)}`}>
                                                        {report.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-slate-300 mt-1">{report.form_template?.name}</p>
                                                <p className="text-xs text-slate-500 mt-1">{report.address || 'No address'}</p>
                                                <p className="text-xs text-slate-600 mt-1">
                                                    {report.reporter_name || 'Anonymous'} • {new Date(report.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            {report.status === 'new' && (
                                                <Tooltip
                                                    content="Pair this public hazard report with an officer and a specific technical inspection template to begin investigation."
                                                    position="left"
                                                >
                                                    <button
                                                        onClick={() => {
                                                            setAssignmentModalReport(report);
                                                            setSelectedInspectionForm(report.form_template?.id || '');
                                                        }}
                                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs transition-all whitespace-nowrap"
                                                    >
                                                        Assign
                                                    </button>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Assignments Tab */}
                    {activeTab === 'assignments' && (
                        <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700">
                            <div className="grid grid-cols-6 gap-4 p-4 border-b border-slate-700 bg-slate-800/50 text-xs text-slate-400 font-bold uppercase">
                                <div>Officer</div>
                                <div>Report</div>
                                <div>Form</div>
                                <div>Status</div>
                                <div>Submissions</div>
                                <div>Assigned</div>
                            </div>
                            {assignments.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">No assignments found.</div>
                            ) : (
                                assignments.map(assignment => (
                                    <div key={assignment.id} className="grid grid-cols-6 gap-4 p-4 border-b border-slate-700/50 items-center text-sm text-slate-300">
                                        <div className="font-medium text-white">{assignment.officer_username}</div>
                                        <div>
                                            {assignment.report ? (
                                                <>
                                                    <div className="font-bold text-white">{assignment.report.tracking_id}</div>
                                                    <div className="text-xs text-slate-500">{assignment.report.form_template.name}</div>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-1">
                                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-bold rounded uppercase">
                                                        Patrol
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        <div>{assignment.inspection_form?.name || 'N/A'}</div>
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
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                    {/* Officers Tab */}
                    {activeTab === 'officers' && (
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
                    )}
                </div>
            )}

            {/* Create Officer Modal */}
            {isOfficerModalOpen && (
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
            )}

            {/* Form Builder Modal */}
            {isFormBuilderOpen && (
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
                                            onClick={() => setFormType(type)}
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
            )}

            {/* Assignment Modal */}
            {(assignmentModalReport || directAssignmentTemplate) && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md">
                        <div className="p-6 border-b border-slate-800">
                            <div className="flex items-center gap-2 mb-2">
                                <h3 className="text-lg font-bold text-white">
                                    {directAssignmentTemplate ? 'Patrol Mode Assignment' : 'Assign Report'}
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
                                    : `Assign ${assignmentModalReport?.tracking_id} to an officer`
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
                                    <label className="block text-xs text-slate-500 uppercase mb-1">Inspection Form</label>
                                    <div className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm flex items-center justify-between">
                                        <span>{assignmentModalReport.form_template?.name || 'Unknown Form'}</span>
                                        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">Automatically matched to report template</p>
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
                                {isSubmittingAssignment ? 'Assigning...' : 'Assign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default INEHSSAdminModule;
