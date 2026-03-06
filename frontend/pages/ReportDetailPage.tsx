/**
 * ReportDetailPage
 * Full detail view for a single HazardReport.
 * Shows submitted data as a labeled table, metadata, attachments, location, version info, and follow-ups.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { authService } from '../services/authService';
import { getReportTimeline, ReportTimelineItem } from '../services/inehssService';
import Tooltip from '../components/ui/Tooltip';

const ADMIN_ACTIVE_MODULE_KEY = 'adminActiveModule';
const INEHSS_ACTIVE_TAB_KEY = 'inehssActiveTab';

type ReportReturnContext = {
    adminModule?: 'VISUALIZATION' | 'INEHSS';
    inehssTab?: 'forms' | 'reports' | 'assignments' | 'officers';
    origin?: 'map' | 'reports';
};

const API_BASE = '/api/v1/inehss';

interface FormVersionInfo {
    id: string;
    template_id?: string;
    version_number: number;
    template_name: string;
    schema?: Array<{ name: string; label: string; type: string }>;
    form_type?: string;
    geo_mode?: string;
}

interface Attachment {
    id: string;
    file: string;
    file_type: string;
    original_filename: string;
    file_size: number;
}

interface ReportOriginInfo {
    code: 'public' | 'patrol' | 'follow_up' | 'unknown';
    label: string;
    description: string;
}

interface ReportLineage {
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
}

interface ReportDetail {
    id: string;
    tracking_id: string;
    form_version: FormVersionInfo;
    parent_report?: string | null;
    data: Record<string, any>;
    latitude: number | null;
    longitude: number | null;
    address: string;
    status: string;
    priority: string;
    event_id?: string | null;
    reporter_name: string;
    reporter_phone: string;
    reporter_email: string;
    assignment_count?: number;
    report_origin?: ReportOriginInfo;
    lineage?: ReportLineage | null;
    attachments: Attachment[];
    created_at: string;
    updated_at: string;
}

interface OfficerAssignment {
    id: string;
    officer_username: string;
    status: string;
    progress_percent: number;
    assigned_at: string;
    form_version?: {
        template_name: string;
        version_number: number;
    };
}

interface TimelineFieldChange {
    field: string;
    from: any;
    to: any;
}

type WorkspaceTab = 'summary' | 'timeline' | 'assignments' | 'reports' | 'evidence';

const getToken = () => authService.getToken();

const statusColors: Record<string, string> = {
    new: 'bg-yellow-500/20 text-yellow-400',
    assigned: 'bg-blue-500/20 text-blue-400',
    in_progress: 'bg-purple-500/20 text-purple-400',
    resolved: 'bg-green-500/20 text-green-400',
    closed: 'bg-slate-500/20 text-slate-400',
};

const priorityColors: Record<string, string> = {
    low: 'bg-slate-500/20 text-slate-400',
    medium: 'bg-yellow-500/20 text-yellow-400',
    high: 'bg-orange-500/20 text-orange-400',
    critical: 'bg-red-500/20 text-red-400',
};

const originColors: Record<string, string> = {
    public: 'bg-cyan-500/20 text-cyan-300',
    patrol: 'bg-purple-500/20 text-purple-300',
    follow_up: 'bg-emerald-500/20 text-emerald-300',
    unknown: 'bg-slate-500/20 text-slate-300',
};

const workspaceTabs: Array<{ key: WorkspaceTab; label: string; tip: string }> = [
    {
        key: 'summary',
        label: 'Summary',
        tip: 'Executive snapshot of the report, including key metadata, submitted fields, location, and schema version.',
    },
    {
        key: 'timeline',
        label: 'Timeline',
        tip: 'Chronological audit trail of status changes, assignments, submissions, and linked event actions.',
    },
    {
        key: 'assignments',
        label: 'Assignments',
        tip: 'Operational work queue showing who was tasked, current progress, and inspection form versions.',
    },
    {
        key: 'reports',
        label: 'Reports',
        tip: 'Relationship view for parent reports and follow-up records so teams can trace the reporting chain.',
    },
    {
        key: 'evidence',
        label: 'Evidence',
        tip: 'Attachments, files, and geospatial evidence captured with this report for verification and response.',
    },
];

const ReportDetailPage: React.FC = () => {
    const { reportId } = useParams<{ reportId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const [report, setReport] = useState<ReportDetail | null>(null);
    const [followUps, setFollowUps] = useState<ReportDetail[]>([]);
    const [assignments, setAssignments] = useState<OfficerAssignment[]>([]);
    const [timeline, setTimeline] = useState<ReportTimelineItem[]>([]);
    const [activeTab, setActiveTab] = useState<WorkspaceTab>('summary');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const returnContext = useMemo<ReportReturnContext>(() => {
        return ((location.state as { returnContext?: ReportReturnContext } | null)?.returnContext) || {
            adminModule: 'INEHSS',
            inehssTab: 'reports',
            origin: 'reports',
        };
    }, [location.state]);

    const returnLabel = returnContext.adminModule === 'VISUALIZATION' ? 'Back to Map' : 'Back';

    const returnToReportsWorkspace = () => {
        if (returnContext.adminModule === 'VISUALIZATION') {
            sessionStorage.setItem(ADMIN_ACTIVE_MODULE_KEY, 'VISUALIZATION');
        } else {
            sessionStorage.setItem(ADMIN_ACTIVE_MODULE_KEY, 'INEHSS');
            sessionStorage.setItem(INEHSS_ACTIVE_TAB_KEY, returnContext.inehssTab || 'reports');
        }
        navigate('/admin');
    };

    useEffect(() => {
        if (reportId) loadReport(reportId);
    }, [reportId]);

    const loadReport = async (id: string) => {
        setIsLoading(true);
        try {
            const token = getToken();
            if (!token) throw new Error('Authentication required');

            const authHeaders = { Authorization: `Bearer ${token}` };
            const res = await fetch(`${API_BASE}/reports/${id}/`, {
                headers: authHeaders,
            });
            if (!res.ok) throw new Error('Report not found');
            const data = await res.json();
            setReport(data);

            const [followRes, assignmentsRes, timelineData] = await Promise.all([
                fetch(`${API_BASE}/reports/?parent_report=${id}`, { headers: authHeaders }),
                fetch(`${API_BASE}/assignments/?report=${id}`, { headers: authHeaders }),
                getReportTimeline(id, token),
            ]);

            if (followRes.ok) {
                const followData = await followRes.json();
                setFollowUps(followData.results || followData || []);
            } else {
                setFollowUps([]);
            }

            if (assignmentsRes.ok) {
                const assignmentsData = await assignmentsRes.json();
                setAssignments(assignmentsData.results || assignmentsData || []);
            } else {
                setAssignments([]);
            }

            setTimeline(timelineData.timeline || []);
        } catch (err: any) {
            setError(err.message || 'Failed to load report');
        } finally {
            setIsLoading(false);
        }
    };

    const getFieldLabel = (fieldName: string): string => {
        if (!report?.form_version?.schema) return fieldName;
        const field = report.form_version.schema.find(f => f.name === fieldName);
        return field?.label || fieldName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const renderValue = (value: any): string => {
        if (value === null || value === undefined) return '—';
        if (Array.isArray(value)) return value.join(', ');
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'object') return JSON.stringify(value);
        return String(value);
    };

    const getTimelineBadgeColor = (sourceType: ReportTimelineItem['source_type']): string => {
        const colors: Record<ReportTimelineItem['source_type'], string> = {
            report_status: 'bg-blue-500/20 text-blue-300',
            assignment_status: 'bg-purple-500/20 text-purple-300',
            submission: 'bg-green-500/20 text-green-300',
            follow_up_report_status: 'bg-orange-500/20 text-orange-300',
            event_status: 'bg-cyan-500/20 text-cyan-300',
        };
        return colors[sourceType] || 'bg-slate-700 text-slate-300';
    };

    const getTimelineSummary = (item: ReportTimelineItem): string => {
        const { metadata } = item;
        if (item.source_type === 'submission') {
            const version = metadata?.submission_version ? `v${metadata.submission_version}` : 'submission';
            if (metadata?.lineage_role === 'origin_submission') {
                return `${version} • generated this patrol report`;
            }
            const changeCount = Array.isArray(metadata?.changed_fields) ? metadata.changed_fields.length : 0;
            return `${version} • ${changeCount} field change${changeCount === 1 ? '' : 's'}`;
        }
        if (metadata?.lineage_role === 'origin_assignment') {
            return `${metadata?.officer || 'Officer'} • origin patrol assignment`;
        }
        if (metadata?.from_status || metadata?.to_status) {
            return `${metadata?.from_status || 'start'} → ${metadata?.to_status || 'current'}`;
        }
        if (metadata?.officer) {
            return metadata.officer;
        }
        return item.source_type.replace(/_/g, ' ');
    };

    const renderInfoHint = (content: string) => (
        <Tooltip content={content} position="top">
            <button
                type="button"
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-600 text-[11px] text-slate-400 hover:border-slate-500 hover:text-white transition-colors"
                aria-label="More information"
            >
                ?
            </button>
        </Tooltip>
    );

    const isOriginAssignment = (assignmentId: string): boolean => report?.lineage?.origin_assignment_id === assignmentId;

    const getLineageStatusLabel = (lineage?: ReportLineage | null): string => {
        if (!lineage) return 'Unavailable';
        return lineage.lineage_status === 'linked' ? 'Linked lineage' : 'Legacy heuristic';
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error || !report) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 text-lg mb-4">{error || 'Report not found'}</p>
                    <button onClick={returnToReportsWorkspace} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">
                        {returnLabel}
                    </button>
                </div>
            </div>
        );
    }

    const tabCounts: Record<WorkspaceTab, number | string> = {
        summary: Object.keys(report.data || {}).length,
        timeline: timeline.length,
        assignments: assignments.length,
        reports: followUps.length + (report.parent_report ? 1 : 0),
        evidence: report.attachments?.length || 0,
    };

    const workspaceHighlights = [
        {
            label: 'Field Responses',
            value: Object.keys(report.data || {}).length,
            accent: 'text-green-400',
            help: 'How many submitted fields are stored on this raw record.',
        },
        {
            label: 'Operational Steps',
            value: timeline.length,
            accent: 'text-cyan-400',
            help: 'The number of audit entries recorded across the report lifecycle.',
        },
        {
            label: 'Assignment Links',
            value: assignments.length,
            accent: 'text-blue-400',
            help: 'Origin patrol assignments and follow-up inspection tasks related to this report.',
        },
        {
            label: 'Evidence Files',
            value: report.attachments?.length || 0,
            accent: 'text-amber-400',
            help: 'Media or documents attached to the report.',
        },
        {
            label: 'Linked Event',
            value: report.event_id ? 'Yes' : 'No',
            accent: report.event_id ? 'text-emerald-400' : 'text-slate-400',
            help: 'Whether this report has been promoted into an operational event/case.',
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button
                        onClick={returnToReportsWorkspace}
                        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        {returnLabel}
                    </button>
                    <span className="text-xs text-slate-500">Event Workspace</span>
                </div>
            </header>

            <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">
                {/* Report Header Card */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <h1 className="text-2xl font-mono font-bold text-green-400">{report.tracking_id}</h1>
                            <p className="text-slate-400 mt-1">
                                {report.form_version?.template_name}
                                <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300">
                                    v{report.form_version?.version_number}
                                </span>
                            </p>
                            <p className="text-xs text-slate-500 mt-2">
                                Submitted {new Date(report.created_at).toLocaleString()} • Updated {new Date(report.updated_at).toLocaleString()}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Tooltip content={report.report_origin?.description || 'Origin metadata not available for this report yet.'}>
                                <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${originColors[report.report_origin?.code || 'unknown'] || originColors.unknown}`}>
                                    {report.report_origin?.label || 'Unknown Origin'}
                                </span>
                            </Tooltip>
                            {report.event_id && (
                                <span className="px-3 py-1.5 rounded-full text-sm font-bold bg-emerald-500/20 text-emerald-300">
                                    LINKED EVENT
                                </span>
                            )}
                            <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${statusColors[report.status] || 'bg-slate-700 text-slate-300'}`}>
                                {report.status.replace('_', ' ').toUpperCase()}
                            </span>
                            <span className={`px-3 py-1.5 rounded-full text-sm font-bold ${priorityColors[report.priority] || 'bg-slate-700 text-slate-300'}`}>
                                {report.priority.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Reporter Info */}
                    <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div>
                            <span className="text-xs text-slate-500 uppercase">Source</span>
                            <p className="text-white text-sm">{report.report_origin?.label || 'Unknown origin'}</p>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 uppercase">Reporter</span>
                            <p className="text-white text-sm">{report.reporter_name || (report.report_origin?.code === 'public' ? 'Anonymous public submitter' : 'System-generated')}</p>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 uppercase">Phone</span>
                            <p className="text-white text-sm">{report.reporter_phone || '—'}</p>
                        </div>
                        <div>
                            <span className="text-xs text-slate-500 uppercase">Email</span>
                            <p className="text-white text-sm">{report.reporter_email || '—'}</p>
                        </div>
                    </div>

                    {/* Parent Report Link */}
                    {report.parent_report && (
                        <div className="mt-4 pt-4 border-t border-slate-700">
                            <span className="text-xs text-slate-500 uppercase">Follow-up of</span>
                            <Link
                                to={`/inehss/reports/${report.parent_report}`}
                                state={location.state}
                                className="ml-2 text-green-400 hover:text-green-300 font-mono text-sm underline"
                            >
                                Parent Report →
                            </Link>
                        </div>
                    )}

                    {report.report_origin?.code === 'patrol' && report.lineage && (
                        <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                <div>
                                    <span className="text-xs text-slate-500 uppercase">Created from Patrol Assignment</span>
                                    <p className="text-sm text-white mt-1">
                                        {report.lineage.lineage_status === 'linked'
                                            ? 'This report keeps a direct patrol lineage link back to its originating assignment and submission.'
                                            : 'This legacy patrol record is classified by historical metadata only; direct lineage was not preserved.'}
                                    </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${report.lineage.lineage_status === 'linked' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                    {getLineageStatusLabel(report.lineage)}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div>
                                    <span className="text-xs text-slate-500 uppercase">Originating Officer</span>
                                    <p className="text-white text-sm">{report.lineage.origin_officer_username || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 uppercase">Assignment Mode</span>
                                    <p className="text-white text-sm">
                                        {report.lineage.origin_assignment_is_persistent ? 'Persistent patrol assignment' : 'Officer patrol assignment'}
                                    </p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 uppercase">Origin Assignment Status</span>
                                    <p className="text-white text-sm">{report.lineage.origin_assignment_status?.replace(/_/g, ' ') || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 uppercase">Origin Assignment ID</span>
                                    <p className="text-white text-sm font-mono break-all">{report.lineage.origin_assignment_id || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 uppercase">Origin Submission ID</span>
                                    <p className="text-white text-sm font-mono break-all">{report.lineage.origin_submission_id || '—'}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-slate-500 uppercase">Submission Recorded</span>
                                    <p className="text-white text-sm">
                                        {report.lineage.origin_submission_timestamp
                                            ? new Date(report.lineage.origin_submission_timestamp).toLocaleString()
                                            : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="bg-slate-800/40 backdrop-blur border border-slate-700 rounded-2xl p-5">
                    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-semibold text-white">Operational Workspace Overview</h2>
                                {renderInfoHint('This strip summarizes the raw-data, operational, and evidence signals available for this report so supervisors can quickly orient themselves.')}
                            </div>
                            <p className="text-xs text-slate-500 mt-1">Use the tabs below to move between inspection, tracking, evidence, and relationship views.</p>
                        </div>
                        <div className="text-xs text-slate-500">
                            Workspace mode: <span className="text-slate-300">Report-centric operations</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                        {workspaceHighlights.map((item) => (
                            <div key={item.label} className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="text-[11px] uppercase tracking-wide text-slate-500">{item.label}</span>
                                    {renderInfoHint(item.help)}
                                </div>
                                <p className={`text-xl font-bold ${item.accent}`}>{item.value}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-slate-800/40 backdrop-blur border border-slate-700 rounded-2xl p-3">
                    <div className="flex flex-wrap gap-2">
                        {workspaceTabs.map((tab) => (
                            <Tooltip key={tab.key} content={tab.tip} position="top">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab(tab.key)}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${activeTab === tab.key
                                        ? 'bg-green-600 text-white border-green-500 shadow-lg shadow-green-900/20'
                                        : 'bg-slate-900/70 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                                        }`}
                                >
                                    <span>{tab.label}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                        {tabCounts[tab.key]}
                                    </span>
                                </button>
                            </Tooltip>
                        ))}
                    </div>
                </div>

                {activeTab === 'summary' && (
                    <>
                        {/* Submitted Data Table */}
                        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-bold text-white">Submitted Data</h2>
                                    {renderInfoHint('This is the raw record inspection layer: the exact field responses captured for this report, rendered against the schema version used at submission time.')}
                                </div>
                                <span className="text-xs text-slate-500">
                                    Schema: {report.form_version?.template_name} v{report.form_version?.version_number}
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-900/50">
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-1/3">Field</th>
                                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {Object.entries(report.data).map(([key, value]) => (
                                            <tr key={key} className="hover:bg-slate-700/20 transition-colors">
                                                <td className="px-6 py-4 text-sm font-medium text-slate-300">{getFieldLabel(key)}</td>
                                                <td className="px-6 py-4 text-sm text-white">{renderValue(value)}</td>
                                            </tr>
                                        ))}
                                        {Object.keys(report.data).length === 0 && (
                                            <tr>
                                                <td colSpan={2} className="px-6 py-8 text-center text-slate-500">No data submitted</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Location */}
                        {(report.latitude !== null && report.longitude !== null) && (
                            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <h2 className="text-lg font-bold text-white">Location</h2>
                                    {renderInfoHint('Geospatial context captured with the report. This helps operators verify where the incident was reported and later connect it to the map view.')}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase">Latitude</span>
                                        <p className="text-white text-sm font-mono">{report.latitude?.toFixed(6)}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase">Longitude</span>
                                        <p className="text-white text-sm font-mono">{report.longitude?.toFixed(6)}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase">Address</span>
                                        <p className="text-white text-sm">{report.address || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Version Info & Link */}
                        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                            <div className="flex items-center gap-2 mb-3">
                                <h2 className="text-lg font-bold text-white">Version Information</h2>
                                {renderInfoHint('This section explains which form schema version produced this record. It is important for auditing because field definitions may evolve over time.')}
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-slate-300 text-sm">
                                        This report was collected using <strong className="text-white">{report.form_version?.template_name}</strong> schema,
                                        version <strong className="text-green-400">v{report.form_version?.version_number}</strong>.
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        The form data is immutably locked to this schema version.
                                    </p>
                                </div>
                                <Link
                                    to={`/inehss/forms/${report.form_version?.template_id}/history`}
                                    state={location.state}
                                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-all whitespace-nowrap"
                                >
                                    View Version History →
                                </Link>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'timeline' && (
                    <>
                        {/* Operational Timeline */}
                        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                            <div className="flex items-center justify-between gap-3 mb-4">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h2 className="text-lg font-bold text-white">Operational Timeline</h2>
                                        {renderInfoHint('This is the operational layer: a chronological history of how the report progressed through assignment, updates, and event-level action.')}
                                    </div>
                                    <p className="text-sm text-slate-400">Audit how this report evolved across status changes, assignments, submissions, and linked event actions.</p>
                                </div>
                                <span className="px-3 py-1 rounded-full bg-slate-900 border border-slate-700 text-xs text-slate-400">
                                    {timeline.length} items
                                </span>
                            </div>

                            {timeline.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-4 py-8 text-center text-sm text-slate-500">
                                    No operational history is available for this report yet.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {timeline.map((item) => {
                                        const changedFields = Array.isArray(item.metadata?.changed_fields)
                                            ? (item.metadata.changed_fields as TimelineFieldChange[])
                                            : [];

                                        return (
                                            <div key={`${item.source_type}-${item.source_id}`} className="relative pl-6">
                                                <div className="absolute left-0 top-2 h-full w-px bg-slate-700" />
                                                <div className="absolute left-[-5px] top-2 h-3 w-3 rounded-full border-2 border-slate-900 bg-green-500" />
                                                <div className="bg-slate-900 border border-slate-700 rounded-xl p-4">
                                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <h3 className="text-sm font-semibold text-white">{item.title}</h3>
                                                                <span className={`px-2 py-0.5 rounded text-[11px] font-medium uppercase ${getTimelineBadgeColor(item.source_type)}`}>
                                                                    {item.source_type.replace(/_/g, ' ')}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-1">{getTimelineSummary(item)}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-xs text-slate-400">{new Date(item.timestamp).toLocaleString()}</p>
                                                            <p className="text-[11px] text-slate-500 mt-1">Actor: {item.actor || 'System'}</p>
                                                        </div>
                                                    </div>

                                                    {(item.metadata?.reason || changedFields.length > 0) && (
                                                        <div className="mt-3 pt-3 border-t border-slate-700/70 space-y-3">
                                                            {item.metadata?.reason && (
                                                                <p className="text-sm text-slate-300">
                                                                    <span className="text-slate-500">Reason:</span> {item.metadata.reason}
                                                                </p>
                                                            )}

                                                            {changedFields.length > 0 && (
                                                                <div>
                                                                    <p className="text-xs uppercase tracking-wide text-slate-500 mb-2">Changed fields</p>
                                                                    <div className="grid gap-2 sm:grid-cols-2">
                                                                        {changedFields.map((change) => (
                                                                            <div key={`${item.source_id}-${change.field}`} className="rounded-lg bg-slate-800/70 border border-slate-700 px-3 py-2">
                                                                                <p className="text-xs font-semibold text-slate-300">{change.field.replace(/_/g, ' ')}</p>
                                                                                <p className="text-[11px] text-slate-500 mt-1">From: <span className="text-slate-300">{renderValue(change.from)}</span></p>
                                                                                <p className="text-[11px] text-slate-500">To: <span className="text-green-300">{renderValue(change.to)}</span></p>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </>
                )}

                {activeTab === 'evidence' && (
                    <>
                        {/* Attachments */}
                        {report.attachments && report.attachments.length > 0 && (
                            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <h2 className="text-lg font-bold text-white">Evidence & Attachments ({report.attachments.length})</h2>
                                    {renderInfoHint('Files, images, and supporting evidence attached to the report. Analysts and supervisors use this section to validate the claim and build incident packs.')}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {report.attachments.map(att => (
                                        <a
                                            key={att.id}
                                            href={att.file}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="bg-slate-900 border border-slate-700 hover:border-green-500/40 rounded-lg p-3 transition-all flex flex-col items-center gap-2"
                                        >
                                            <span className="text-2xl">
                                                {att.file_type === 'image' ? '🖼️' : att.file_type === 'video' ? '🎥' : '📄'}
                                            </span>
                                            <span className="text-xs text-slate-400 text-center truncate w-full">{att.original_filename}</span>
                                            <span className="text-[10px] text-slate-600">{(att.file_size / 1024).toFixed(1)} KB</span>
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}

                        {(report.latitude !== null && report.longitude !== null) && (
                            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <h2 className="text-lg font-bold text-white">Geospatial Evidence</h2>
                                    {renderInfoHint('Location data often acts as evidence too. This view keeps the geographic capture details close to the media evidence for verification.')}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase">Latitude</span>
                                        <p className="text-white text-sm font-mono">{report.latitude?.toFixed(6)}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase">Longitude</span>
                                        <p className="text-white text-sm font-mono">{report.longitude?.toFixed(6)}</p>
                                    </div>
                                    <div>
                                        <span className="text-xs text-slate-500 uppercase">Address</span>
                                        <p className="text-white text-sm">{report.address || '—'}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(!report.attachments || report.attachments.length === 0) && report.latitude === null && report.longitude === null && (
                            <div className="bg-slate-800/50 backdrop-blur border border-dashed border-slate-700 rounded-2xl p-8 text-center text-sm text-slate-500">
                                No evidence files or geospatial metadata are attached to this report yet.
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'assignments' && (
                    <>
                        {/* Officer Assignments (Follow-up Inspections) */}
                        {assignments.length > 0 && (
                            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <h2 className="text-lg font-bold text-white">Assigned Inspections ({assignments.length})</h2>
                                    {renderInfoHint('Assignments represent operational tasks handed to officers for verification, inspection, or follow-up reporting.')}
                                </div>
                                <div className="space-y-2">
                                    {assignments.map(assignment => (
                                        <div
                                            key={assignment.id}
                                            className="flex items-center justify-between bg-slate-900 border border-slate-700 rounded-lg p-3"
                                        >
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-blue-400 text-sm">{assignment.officer_username}</span>
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-300 uppercase">
                                                        {assignment.status.replace('_', ' ')}
                                                    </span>
                                                    {isOriginAssignment(assignment.id) && (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-300 uppercase">
                                                            Origin patrol assignment
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-xs text-slate-400 mt-1">
                                                    {assignment.form_version?.template_name} (v{assignment.form_version?.version_number})
                                                </p>
                                            </div>
                                            <div className="text-right flex flex-col items-end">
                                                <span className="text-xs text-slate-500 mb-1">{new Date(assignment.assigned_at).toLocaleDateString()}</span>
                                                <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full ${assignment.progress_percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                                                        style={{ width: `${assignment.progress_percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {assignments.length === 0 && (
                            <div className="bg-slate-800/50 backdrop-blur border border-dashed border-slate-700 rounded-2xl p-8 text-center text-sm text-slate-500">
                                {report.lineage?.lineage_status === 'heuristic_only'
                                    ? 'This legacy patrol record has no preserved assignment linkage yet.'
                                    : 'No officer assignments are linked to this report yet.'}
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'reports' && (
                    <>
                        {report.parent_report && (
                            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <h2 className="text-lg font-bold text-white">Parent Relationship</h2>
                                    {renderInfoHint('Some records are follow-up reports. This section helps teams trace back to the original report that started the case chain.')}
                                </div>
                                <Link
                                    to={`/inehss/reports/${report.parent_report}`}
                                    state={location.state}
                                    className="flex items-center justify-between bg-slate-900 border border-slate-700 hover:border-green-500/40 rounded-lg p-4 transition-all"
                                >
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase">Parent report</p>
                                        <p className="font-mono text-green-400 text-sm mt-1">{report.parent_report}</p>
                                    </div>
                                    <span className="text-sm text-slate-400">Open →</span>
                                </Link>
                            </div>
                        )}

                        {/* Follow-up Reports */}
                        {followUps.length > 0 && (
                            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <h2 className="text-lg font-bold text-white">Follow-up Reports ({followUps.length})</h2>
                                    {renderInfoHint('These are subsequent reports attached to the same reporting chain, useful for updates, corrections, and longitudinal case tracking.')}
                                </div>
                                <div className="space-y-2">
                                    {followUps.map(fu => (
                                        <Link
                                            key={fu.id}
                                            to={`/inehss/reports/${fu.id}`}
                                            state={location.state}
                                            className="flex items-center justify-between bg-slate-900 border border-slate-700 hover:border-green-500/40 rounded-lg p-3 transition-all"
                                        >
                                            <div>
                                                <span className="font-mono text-green-400 text-sm">{fu.tracking_id}</span>
                                                <span className={`ml-3 px-2 py-0.5 rounded text-xs font-medium ${statusColors[fu.status] || ''}`}>
                                                    {fu.status}
                                                </span>
                                            </div>
                                            <span className="text-xs text-slate-500">{new Date(fu.created_at).toLocaleDateString()}</span>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!report.parent_report && followUps.length === 0 && (
                            <div className="bg-slate-800/50 backdrop-blur border border-dashed border-slate-700 rounded-2xl p-8 text-center text-sm text-slate-500">
                                This report is not currently part of a parent/follow-up reporting chain.
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default ReportDetailPage;
