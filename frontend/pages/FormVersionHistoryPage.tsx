/**
 * FormVersionHistoryPage
 * GitHub-style version timeline with schema diff comparison.
 * Shows all FormVersion entries for a FormTemplate, with side-by-side diff tables.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

const API_BASE = '/api/v1/inehss';
const getToken = () => authService.getToken();

interface SchemaField {
    name: string;
    label: string;
    type: string;
    required?: boolean;
    options?: string[];
    [key: string]: any;
}

interface VersionEntry {
    id: string;
    version_number: number;
    schema: SchemaField[];
    is_published: boolean;
    created_at: string;
    report_count: number;
}

interface VersionsResponse {
    template_id: string;
    template_name: string;
    geo_mode: string;
    versions: VersionEntry[];
}

type DiffStatus = 'added' | 'removed' | 'modified' | 'unchanged';

interface DiffRow {
    field_name: string;
    status: DiffStatus;
    left?: SchemaField;
    right?: SchemaField;
    changes?: string[];
}

function computeDiff(oldSchema: SchemaField[], newSchema: SchemaField[]): DiffRow[] {
    const oldMap = new Map(oldSchema.map(f => [f.name, f]));
    const newMap = new Map(newSchema.map(f => [f.name, f]));
    const allFields = new Set([...oldMap.keys(), ...newMap.keys()]);
    const rows: DiffRow[] = [];

    allFields.forEach(name => {
        const left = oldMap.get(name);
        const right = newMap.get(name);

        if (!left && right) {
            rows.push({ field_name: name, status: 'added', right });
        } else if (left && !right) {
            rows.push({ field_name: name, status: 'removed', left });
        } else if (left && right) {
            const changes: string[] = [];
            if (left.type !== right.type) changes.push(`type: ${left.type} → ${right.type}`);
            if (left.label !== right.label) changes.push(`label: "${left.label}" → "${right.label}"`);
            if (left.required !== right.required) changes.push(`required: ${left.required || false} → ${right.required || false}`);
            if (JSON.stringify(left.options || []) !== JSON.stringify(right.options || [])) changes.push('options changed');

            rows.push({
                field_name: name,
                status: changes.length > 0 ? 'modified' : 'unchanged',
                left,
                right,
                changes,
            });
        }
    });

    return rows;
}

const statusStyles: Record<DiffStatus, { bg: string; text: string; icon: string }> = {
    added: { bg: 'bg-green-500/10', text: 'text-green-400', icon: '＋' },
    removed: { bg: 'bg-red-500/10', text: 'text-red-400', icon: '−' },
    modified: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', icon: '~' },
    unchanged: { bg: '', text: 'text-slate-400', icon: '' },
};

const FormVersionHistoryPage: React.FC = () => {
    const { formId } = useParams<{ formId: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<VersionsResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedLeft, setSelectedLeft] = useState<number>(0);
    const [selectedRight, setSelectedRight] = useState<number>(1);

    useEffect(() => {
        if (formId) loadVersions(formId);
    }, [formId]);

    const loadVersions = async (id: string) => {
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE}/forms/${id}/versions/`, {
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            if (!res.ok) throw new Error('Failed to load versions');
            const json = await res.json();
            setData(json);
            if (json.versions.length >= 2) {
                setSelectedLeft(0);
                setSelectedRight(json.versions.length - 1);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load');
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 text-lg mb-4">{error || 'No data'}</p>
                    <button onClick={() => navigate(-1)} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg">Go Back</button>
                </div>
            </div>
        );
    }

    const versions = data.versions;
    const leftVersion = versions[selectedLeft];
    const rightVersion = versions[selectedRight];
    const diff = leftVersion && rightVersion ? computeDiff(leftVersion.schema, rightVersion.schema) : [];
    const addedCount = diff.filter(d => d.status === 'added').length;
    const removedCount = diff.filter(d => d.status === 'removed').length;
    const modifiedCount = diff.filter(d => d.status === 'modified').length;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
                    <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back
                    </button>
                    <span className="text-xs text-slate-500">Form Version History</span>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                {/* Title */}
                <div>
                    <h1 className="text-2xl font-bold text-white">{data.template_name}</h1>
                    <p className="text-slate-400 text-sm mt-1">{versions.length} version{versions.length !== 1 ? 's' : ''} • Geo Mode: {data.geo_mode}</p>
                </div>

                {/* Version Timeline */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase mb-4">Version Timeline</h2>
                    <div className="flex items-center gap-1 overflow-x-auto pb-2">
                        {versions.map((v, idx) => (
                            <React.Fragment key={v.id}>
                                <button
                                    onClick={() => {
                                        if (idx !== selectedRight) setSelectedLeft(idx);
                                        else if (idx !== selectedLeft) setSelectedRight(idx);
                                    }}
                                    className={`flex-shrink-0 px-4 py-3 rounded-xl text-sm font-medium transition-all border ${idx === selectedLeft
                                            ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                                            : idx === selectedRight
                                                ? 'bg-green-600/20 border-green-500 text-green-400'
                                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'
                                        }`}
                                >
                                    <div className="font-bold">v{v.version_number}</div>
                                    <div className="text-[10px] mt-1 opacity-70">
                                        {v.report_count} report{v.report_count !== 1 ? 's' : ''}
                                    </div>
                                    <div className="text-[10px] opacity-50">
                                        {new Date(v.created_at).toLocaleDateString()}
                                    </div>
                                </button>
                                {idx < versions.length - 1 && (
                                    <div className="flex-shrink-0 w-6 h-0.5 bg-slate-700" />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                    <div className="flex gap-4 mt-3 text-xs">
                        <span className="text-blue-400">● Left (base)</span>
                        <span className="text-green-400">● Right (compare)</span>
                    </div>
                </div>

                {/* Diff Summary */}
                {versions.length >= 2 && leftVersion && rightVersion && (
                    <>
                        <div className="flex flex-wrap gap-3">
                            <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-800 border border-slate-700 text-white">
                                v{leftVersion.version_number} → v{rightVersion.version_number}
                            </span>
                            {addedCount > 0 && (
                                <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-green-500/10 text-green-400">
                                    +{addedCount} added
                                </span>
                            )}
                            {removedCount > 0 && (
                                <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-red-500/10 text-red-400">
                                    −{removedCount} removed
                                </span>
                            )}
                            {modifiedCount > 0 && (
                                <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-yellow-500/10 text-yellow-400">
                                    ~{modifiedCount} modified
                                </span>
                            )}
                            {addedCount === 0 && removedCount === 0 && modifiedCount === 0 && (
                                <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-slate-700 text-slate-400">
                                    No changes
                                </span>
                            )}
                        </div>

                        {/* Diff Table */}
                        <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="bg-slate-900/50">
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase w-8"></th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Field</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-blue-400 uppercase">
                                                v{leftVersion.version_number} (base)
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-green-400 uppercase">
                                                v{rightVersion.version_number} (compare)
                                            </th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Changes</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {diff.map((row) => {
                                            const style = statusStyles[row.status];
                                            return (
                                                <tr key={row.field_name} className={`${style.bg} transition-colors`}>
                                                    <td className={`px-4 py-3 text-center text-lg font-bold ${style.text}`}>
                                                        {style.icon}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium text-white">
                                                        {row.left?.label || row.right?.label || row.field_name}
                                                        <div className="text-[10px] text-slate-500 font-mono">{row.field_name}</div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-300">
                                                        {row.left ? (
                                                            <div>
                                                                <span className="px-2 py-0.5 rounded bg-slate-700 text-xs">{row.left.type}</span>
                                                                {row.left.required && <span className="ml-1 text-red-400 text-xs">*</span>}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-600 italic">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-slate-300">
                                                        {row.right ? (
                                                            <div>
                                                                <span className="px-2 py-0.5 rounded bg-slate-700 text-xs">{row.right.type}</span>
                                                                {row.right.required && <span className="ml-1 text-red-400 text-xs">*</span>}
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-600 italic">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-xs text-slate-400">
                                                        {row.status === 'added' && <span className="text-green-400">New field</span>}
                                                        {row.status === 'removed' && <span className="text-red-400">Removed</span>}
                                                        {row.status === 'modified' && (
                                                            <div className="space-y-0.5">
                                                                {row.changes?.map((c, i) => (
                                                                    <div key={i} className="text-yellow-400">{c}</div>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {row.status === 'unchanged' && '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                        {diff.length === 0 && (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                                    Select two different versions to compare
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* Single version — just show schema */}
                {versions.length === 1 && (
                    <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-700">
                            <h2 className="text-lg font-bold text-white">v1 Schema</h2>
                            <p className="text-xs text-slate-500">{versions[0].report_count} reports collected</p>
                        </div>
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-900/50">
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Field</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-400 uppercase">Required</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700/50">
                                {versions[0].schema.map((field) => (
                                    <tr key={field.name} className="hover:bg-slate-700/20 transition-colors">
                                        <td className="px-6 py-3 text-sm text-white">
                                            {field.label || field.name}
                                            <div className="text-[10px] text-slate-500 font-mono">{field.name}</div>
                                        </td>
                                        <td className="px-6 py-3 text-sm">
                                            <span className="px-2 py-0.5 rounded bg-slate-700 text-xs text-slate-300">{field.type}</span>
                                        </td>
                                        <td className="px-6 py-3 text-sm text-slate-400">{field.required ? 'Yes' : 'No'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Report Counts per Version */}
                <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-6">
                    <h2 className="text-sm font-semibold text-slate-400 uppercase mb-4">Reports per Version</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {versions.map(v => (
                            <div key={v.id} className="bg-slate-900 border border-slate-700 rounded-xl p-4 text-center">
                                <div className="text-2xl font-bold text-white">{v.report_count}</div>
                                <div className="text-xs text-slate-400 mt-1">v{v.version_number}</div>
                                <div className="text-[10px] text-slate-600 mt-0.5">{new Date(v.created_at).toLocaleDateString()}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default FormVersionHistoryPage;
