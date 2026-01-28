import React from 'react';
import { IntelligenceEvent } from '../types';
import { MAP_COLORS, EVENT_ICONS } from '../constants';
import MediaPlayer from './MediaPlayer';
import { updateEventStatus } from '../services/eventService';
import EscalationForm from './EscalationForm';

interface EventDetailPanelProps {
    event: IntelligenceEvent | null;
    onClose: () => void;
    onStatusUpdate?: (event: IntelligenceEvent) => void;
}

const EventDetailPanel: React.FC<EventDetailPanelProps> = ({ event, onClose, onStatusUpdate }) => {
    const [isEscalating, setIsEscalating] = React.useState(false);
    const [isProcessing, setIsProcessing] = React.useState(false);

    if (!event) return null;

    const severityColor = MAP_COLORS[event.severity];
    const eventIcon = EVENT_ICONS[event.type];

    const formatTimestamp = (ts: string) => {
        const date = new Date(ts);
        return {
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
    };

    const { date, time } = formatTimestamp(event.timestamp);

    const handleAction = async (action: 'verify' | 'escalate' | 'archive') => {
        setIsProcessing(true);
        const updatedEvent = await updateEventStatus(event.id, action);
        if (updatedEvent && onStatusUpdate) {
            onStatusUpdate(updatedEvent);
            if (action !== 'escalate') onClose();
        }
        setIsProcessing(false);
    };

    const onEscalateConfirm = (level: string, reason: string) => {
        console.log(`Escalating to ${level} with reason: ${reason}`);
        handleAction('escalate');
        setIsEscalating(false);
    };

    return (
        <div className="fixed inset-y-0 right-0 w-[420px] bg-slate-950 border-l border-slate-800 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                        {/* Event Type Icon */}
                        <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${severityColor}20`, border: `1px solid ${severityColor}40` }}
                        >
                            <svg className="w-5 h-5" fill={severityColor} viewBox="0 0 24 24">
                                <path d={eventIcon?.path} />
                            </svg>
                        </div>
                        <div>
                            <h2 className="font-bold text-white text-sm leading-tight">{event.title}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span
                                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                                    style={{ backgroundColor: `${severityColor}20`, color: severityColor }}
                                >
                                    {event.severity}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">{eventIcon?.label}</span>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {/* Media Section */}
                <div className="p-5 border-b border-slate-800/50">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Evidence Media</h3>
                    <MediaPlayer media={event.media_attachments || []} />
                </div>

                {/* Description */}
                <div className="p-5 border-b border-slate-800/50">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Intelligence Summary</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{event.description}</p>
                </div>

                {/* Metadata Grid */}
                <div className="p-5 border-b border-slate-800/50">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Event Metadata</h3>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">Timestamp</div>
                            <div className="text-xs text-slate-300 font-mono">{date}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{time}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">Source</div>
                            <div className="text-xs text-slate-300 font-mono truncate">{event.source}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">Location</div>
                            <div className="text-xs text-slate-300 font-mono">{event.location}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50">
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">Region</div>
                            <div className="text-xs text-slate-300 font-mono">{event.region}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-800/50 col-span-2">
                            <div className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">Coordinates</div>
                            <div className="text-xs text-blue-400 font-mono">
                                {event.coords.lat.toFixed(4)}°, {event.coords.lng.toFixed(4)}°
                            </div>
                        </div>
                    </div>
                </div>

                {/* Verification Status */}
                <div className="p-5 border-b border-slate-800/50">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Verification Status</h3>
                    <div className={`flex items-center gap-2 p-3 rounded-lg border ${event.verified
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        }`}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            {event.verified ? (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            ) : (
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            )}
                        </svg>
                        <span className="text-xs font-bold uppercase tracking-widest">
                            {event.verified ? 'VERIFIED INTELLIGENCE' : 'PENDING VERIFICATION'}
                        </span>
                    </div>
                </div>

                {/* Raw Metadata */}
                {Object.keys(event.metadata).length > 0 && (
                    <div className="p-5">
                        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Extended Data</h3>
                        <pre className="text-[10px] text-slate-400 font-mono bg-slate-900/50 rounded-lg p-3 border border-slate-800/50 overflow-x-auto">
                            {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            {/* Action Footer */}
            <div className="shrink-0 px-5 py-6 border-t border-slate-800 bg-slate-900/50">
                {isEscalating ? (
                    <EscalationForm
                        onEscalate={onEscalateConfirm}
                        onCancel={() => setIsEscalating(false)}
                    />
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleAction('verify')}
                            disabled={isProcessing || event.verified}
                            className={`flex-1 py-2 px-4 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors ${event.verified ? 'bg-slate-800 cursor-not-allowed text-slate-500' : 'bg-emerald-600 hover:bg-emerald-500'
                                }`}
                        >
                            {isProcessing ? '...' : 'Verify'}
                        </button>
                        <button
                            onClick={() => setIsEscalating(true)}
                            disabled={isProcessing}
                            className="flex-1 py-2 px-4 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-50"
                        >
                            Escalate
                        </button>
                        <button
                            onClick={() => handleAction('archive')}
                            disabled={isProcessing}
                            className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold uppercase tracking-widest rounded transition-colors disabled:opacity-50"
                        >
                            Archive
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EventDetailPanel;
