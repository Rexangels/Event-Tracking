/**
 * OfficerDashboard
 * Dashboard for NESREA officers to view and complete assignments.
 */

import React, { useState, useEffect } from 'react';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import {
    getMyAssignments,
    acceptAssignment,
    submitInspection,
    completeAssignment,
    OfficerAssignment
} from '../services/inehssService';

interface OfficerDashboardProps {
    authToken: string;
    userName: string;
}

const OfficerDashboard: React.FC<OfficerDashboardProps> = ({ authToken, userName }) => {
    const [assignments, setAssignments] = useState<OfficerAssignment[]>([]);
    const [selectedAssignment, setSelectedAssignment] = useState<OfficerAssignment | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

    useEffect(() => {
        loadAssignments();
    }, []);

    const loadAssignments = async () => {
        setIsLoading(true);
        try {
            const response = await getMyAssignments(authToken);
            // Handle paginated response
            const data = response as any;
            const assignmentsList = Array.isArray(data) ? data : (data?.results || []);
            setAssignments(assignmentsList);
        } catch (err) {
            setError('Failed to load assignments');
            setAssignments([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccept = async (assignmentId: string) => {
        try {
            await acceptAssignment(assignmentId, authToken);
            await loadAssignments();
            setSuccessMessage('Assignment accepted!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError('Failed to accept assignment');
        }
    };

    const handleSubmitInspection = async (data: Record<string, any>) => {
        if (!selectedAssignment) return;

        setIsSubmitting(true);
        try {
            await submitInspection(selectedAssignment.id, data, location, false, authToken);
            await completeAssignment(selectedAssignment.id, authToken);
            setSuccessMessage('Inspection submitted successfully!');
            setSelectedAssignment(null);
            await loadAssignments();
        } catch (err) {
            setError('Failed to submit inspection');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSaveDraft = async (data: Record<string, any>) => {
        if (!selectedAssignment) return;

        try {
            await submitInspection(selectedAssignment.id, data, location, true, authToken);
            setSuccessMessage('Draft saved!');
            setTimeout(() => setSuccessMessage(null), 3000);
        } catch (err) {
            setError('Failed to save draft');
        }
    };

    const getStatusBadge = (status: string) => {
        const styles: Record<string, string> = {
            pending: 'bg-yellow-500/20 text-yellow-400',
            accepted: 'bg-blue-500/20 text-blue-400',
            in_progress: 'bg-purple-500/20 text-purple-400',
            completed: 'bg-green-500/20 text-green-400',
            declined: 'bg-red-500/20 text-red-400',
        };
        return styles[status] || 'bg-slate-500/20 text-slate-400';
    };

    if (selectedAssignment) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
                <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
                    <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
                        <button
                            onClick={() => setSelectedAssignment(null)}
                            className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            Back to Dashboard
                        </button>
                    </div>
                </header>

                <main className="max-w-4xl mx-auto px-4 py-8">
                    {/* Reference Report Info */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Reference Report</h3>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-500">Tracking ID</span>
                                <p className="text-green-400 font-mono">{selectedAssignment.report.tracking_id}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Status</span>
                                <p className="text-slate-300">{selectedAssignment.report.status}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Priority</span>
                                <p className="text-slate-300">{selectedAssignment.report.priority}</p>
                            </div>
                            <div>
                                <span className="text-slate-500">Location</span>
                                <p className="text-slate-300">{selectedAssignment.report.address || 'N/A'}</p>
                            </div>
                        </div>
                        {selectedAssignment.notes && (
                            <div className="mt-4 pt-4 border-t border-slate-700">
                                <span className="text-slate-500 text-sm">Admin Notes</span>
                                <p className="text-slate-300 mt-1">{selectedAssignment.notes}</p>
                            </div>
                        )}
                    </div>

                    {/* Inspection Form */}
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                        <h2 className="text-xl font-bold text-white mb-2">{selectedAssignment.inspection_form.name}</h2>
                        <p className="text-slate-400 mb-6">{selectedAssignment.inspection_form.description}</p>

                        <DynamicFormRenderer
                            schema={selectedAssignment.inspection_form.schema}
                            onSubmit={handleSubmitInspection}
                            isSubmitting={isSubmitting}
                            submitLabel="Submit Inspection Report"
                            onLocationChange={setLocation}
                        />

                        <button
                            onClick={() => {
                                const form = document.querySelector('form');
                                if (form) {
                                    const formData = new FormData(form);
                                    const data: Record<string, any> = {};
                                    formData.forEach((value, key) => { data[key] = value; });
                                    handleSaveDraft(data);
                                }
                            }}
                            className="w-full mt-4 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-all"
                        >
                            Save as Draft
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            {/* Header */}
            <header className="bg-slate-800/50 backdrop-blur border-b border-slate-700 sticky top-0 z-50">
                <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-white">INEHSS Officer Portal</h1>
                            <p className="text-xs text-slate-400">Welcome, {userName}</p>
                        </div>
                    </div>
                    <button
                        onClick={loadAssignments}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-all"
                        title="Refresh"
                    >
                        <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Messages */}
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
                        {error}
                        <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-300">✕</button>
                    </div>
                )}
                {successMessage && (
                    <div className="mb-6 bg-green-500/10 border border-green-500/30 text-green-400 px-4 py-3 rounded-lg">
                        {successMessage}
                    </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                    {['pending', 'accepted', 'in_progress', 'completed'].map(status => (
                        <div key={status} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                            <p className="text-2xl font-bold text-white">
                                {assignments.filter(a => a.status === status).length}
                            </p>
                            <p className="text-sm text-slate-400 capitalize">{status.replace('_', ' ')}</p>
                        </div>
                    ))}
                </div>

                {/* Assignments List */}
                <h2 className="text-xl font-bold text-white mb-4">My Assignments</h2>

                {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
                    </div>
                ) : assignments.length === 0 ? (
                    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
                        <p className="text-slate-400">No assignments yet</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {assignments.map(assignment => (
                            <div
                                key={assignment.id}
                                className="bg-slate-800/50 border border-slate-700 hover:border-green-500/50 rounded-xl p-6 transition-all"
                            >
                                <div className="flex items-start justify-between">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="font-mono text-green-400">{assignment.report.tracking_id}</span>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(assignment.status)}`}>
                                                {assignment.status.replace('_', ' ').toUpperCase()}
                                            </span>
                                        </div>
                                        <p className="text-white font-medium">{assignment.report.form_template.name}</p>
                                        <p className="text-sm text-slate-400 mt-1">{assignment.report.address || 'Location not specified'}</p>
                                        {assignment.due_date && (
                                            <p className="text-xs text-yellow-400 mt-2">Due: {new Date(assignment.due_date).toLocaleDateString()}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        {assignment.status === 'pending' && (
                                            <button
                                                onClick={() => handleAccept(assignment.id)}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm transition-all"
                                            >
                                                Accept
                                            </button>
                                        )}
                                        {['accepted', 'in_progress'].includes(assignment.status) && (
                                            <button
                                                onClick={() => setSelectedAssignment(assignment)}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-all"
                                            >
                                                Start Inspection
                                            </button>
                                        )}
                                        {assignment.status === 'completed' && (
                                            <button
                                                onClick={() => setSelectedAssignment(assignment)}
                                                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-sm transition-all"
                                            >
                                                View
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default OfficerDashboard;
