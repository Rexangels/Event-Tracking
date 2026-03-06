import React, { useMemo } from 'react';
import { EventSeverity, EventType, IntelligenceEvent, MapFilterState, MapLayerSettings, MapOverlayCounts } from '../types';
import { MAP_COLORS } from '../constants';
import { countBySeverity, getActiveFilterCount, MAP_TIME_WINDOW_OPTIONS } from '../utils/mapOperations';

interface MapOperationsPanelProps {
    isOpen: boolean;
    totalEvents: number;
    filteredEvents: IntelligenceEvent[];
    selectedRegion: string | null;
    searchQuery: string;
    filters: MapFilterState;
    layerSettings: MapLayerSettings;
    overlayCounts: MapOverlayCounts;
    sourceOptions: string[];
    searchMatches: IntelligenceEvent[];
    onClose: () => void;
    onSearchQueryChange: (value: string) => void;
    onVerificationChange: (value: MapFilterState['verification']) => void;
    onLinkedReportChange: (value: MapFilterState['linkedReport']) => void;
    onTimeWindowChange: (value: MapFilterState['timeWindowHours']) => void;
    onSourceChange: (value: string) => void;
    onToggleSeverity: (severity: EventSeverity) => void;
    onToggleType: (type: EventType) => void;
    onToggleLayer: (layer: keyof MapLayerSettings) => void;
    onSelectEvent: (event: IntelligenceEvent) => void;
    onClearRegion: () => void;
    onReset: () => void;
}

const MapOperationsPanel: React.FC<MapOperationsPanelProps> = ({
    isOpen,
    totalEvents,
    filteredEvents,
    selectedRegion,
    searchQuery,
    filters,
    layerSettings,
    overlayCounts,
    sourceOptions,
    searchMatches,
    onClose,
    onSearchQueryChange,
    onVerificationChange,
    onLinkedReportChange,
    onTimeWindowChange,
    onSourceChange,
    onToggleSeverity,
    onToggleType,
    onToggleLayer,
    onSelectEvent,
    onClearRegion,
    onReset,
}) => {
    const severityCounts = useMemo(() => countBySeverity(filteredEvents), [filteredEvents]);
    const activeFilterCount = useMemo(
        () => getActiveFilterCount(filters, selectedRegion, searchQuery),
        [filters, selectedRegion, searchQuery],
    );

    if (!isOpen) return null;

    return (
        <div className="absolute top-4 right-16 z-30 w-[360px] max-w-[calc(100%-5rem)] rounded-2xl border border-slate-700/80 bg-slate-950/95 backdrop-blur-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between gap-3">
                <div>
                    <div className="text-[10px] uppercase tracking-[0.25em] font-bold text-blue-400">Map Operations</div>
                    <div className="text-sm font-semibold text-white mt-1">Spatial filters and tactical controls</div>
                    <div className="text-xs text-slate-500 mt-1">
                        {filteredEvents.length} of {totalEvents} events active • {activeFilterCount} active filter{activeFilterCount === 1 ? '' : 's'}
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                    aria-label="Close map operations"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto custom-scrollbar p-4 space-y-5">
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">Search + jump</h3>
                        {selectedRegion && (
                            <button onClick={onClearRegion} className="text-[10px] text-blue-400 hover:text-blue-300 uppercase tracking-widest">
                                Clear region
                            </button>
                        )}
                    </div>
                    <div className="relative">
                        <input
                            value={searchQuery}
                            onChange={(event) => onSearchQueryChange(event.target.value)}
                            placeholder="Search event ID, report ID, title, location"
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 pl-9 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                        />
                        <svg className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    {selectedRegion && (
                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
                            Region focus active: <span className="font-semibold">{selectedRegion}</span>
                        </div>
                    )}
                    {searchMatches.length > 0 && (
                        <div className="space-y-2">
                            {searchMatches.map((event) => (
                                <button
                                    key={event.id}
                                    onClick={() => onSelectEvent(event)}
                                    className="w-full rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-left hover:border-blue-500/40 hover:bg-slate-900 transition-colors"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <span className="text-sm font-medium text-white truncate">{event.title}</span>
                                        <span className="text-[10px] uppercase tracking-widest text-slate-500">{event.severity}</span>
                                    </div>
                                    <div className="mt-1 text-xs text-slate-400 flex items-center justify-between gap-3">
                                        <span className="truncate">{event.location}</span>
                                        <span className="font-mono text-slate-500 truncate">{event.metadata?.hazard_report_id || event.id}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <section className="space-y-3">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">Time window</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {MAP_TIME_WINDOW_OPTIONS.map((option) => {
                            const isActive = filters.timeWindowHours === option.value;
                            return (
                                <button
                                    key={String(option.value)}
                                    onClick={() => onTimeWindowChange(option.value as MapFilterState['timeWindowHours'])}
                                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${isActive ? 'border-blue-500 bg-blue-500/20 text-blue-200' : 'border-slate-800 bg-slate-900 text-slate-400 hover:border-slate-700 hover:text-white'}`}
                                >
                                    {option.label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="space-y-3">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">Operational filters</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="space-y-1 text-xs text-slate-400">
                            <span className="uppercase tracking-widest">Verification</span>
                            <select
                                value={filters.verification}
                                onChange={(event) => onVerificationChange(event.target.value as MapFilterState['verification'])}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="all">All events</option>
                                <option value="verified">Verified only</option>
                                <option value="unverified">Unverified only</option>
                            </select>
                        </label>
                        <label className="space-y-1 text-xs text-slate-400">
                            <span className="uppercase tracking-widest">Linked reports</span>
                            <select
                                value={filters.linkedReport}
                                onChange={(event) => onLinkedReportChange(event.target.value as MapFilterState['linkedReport'])}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="all">All events</option>
                                <option value="linked">Linked reports only</option>
                                <option value="unlinked">No linked report</option>
                            </select>
                        </label>
                        <label className="space-y-1 text-xs text-slate-400 sm:col-span-2">
                            <span className="uppercase tracking-widest">Source</span>
                            <select
                                value={filters.source}
                                onChange={(event) => onSourceChange(event.target.value)}
                                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                            >
                                <option value="all">All sources</option>
                                {sourceOptions.map((source) => (
                                    <option key={source} value={source}>{source}</option>
                                ))}
                            </select>
                        </label>
                    </div>
                </section>

                <section className="space-y-3">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">Severity mix</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {Object.values(EventSeverity).map((severity) => (
                            <button
                                key={severity}
                                onClick={() => onToggleSeverity(severity)}
                                className={`rounded-xl border px-3 py-2 text-left transition-colors ${filters.severity[severity] ? 'border-slate-700 bg-slate-900' : 'border-slate-800 bg-slate-950/80 opacity-60'}`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: MAP_COLORS[severity] }}>{severity}</span>
                                    <span className="text-xs text-slate-400">{severityCounts[severity]}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </section>

                <section className="space-y-3">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">Event types</h3>
                    <div className="flex flex-wrap gap-2">
                        {Object.values(EventType).map((type) => {
                            const isActive = filters.types[type];
                            return (
                                <button
                                    key={type}
                                    onClick={() => onToggleType(type)}
                                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-colors ${isActive ? 'border-blue-500/40 bg-blue-500/15 text-blue-200' : 'border-slate-800 bg-slate-900 text-slate-500 hover:text-slate-300'}`}
                                >
                                    {type.replace('_', ' ')}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="space-y-3">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">Operational overlays</h3>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { label: 'Reports', value: overlayCounts.reports, tone: 'text-sky-300 border-sky-500/30 bg-sky-500/10' },
                            { label: 'Tasks', value: overlayCounts.assignments, tone: 'text-amber-300 border-amber-500/30 bg-amber-500/10' },
                            { label: 'Patrol', value: overlayCounts.patrolOrigins, tone: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
                        ].map((item) => (
                            <div key={item.label} className={`rounded-xl border px-3 py-2 ${item.tone}`}>
                                <div className="text-[10px] uppercase tracking-widest opacity-80">{item.label}</div>
                                <div className="text-lg font-bold mt-1">{item.value}</div>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="space-y-3">
                    <h3 className="text-[11px] uppercase tracking-[0.18em] font-bold text-slate-400">Map layers</h3>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            ['showRegions', 'Regions'],
                            ['showSubregions', 'Subregions'],
                            ['showMarkers', 'Event markers'],
                            ['showHeatmap', 'Heatmap'],
                            ['enableAutoDetail', 'Auto detail'],
                            ['showReportOverlays', `Reports (${overlayCounts.reports})`],
                            ['showAssignmentOverlays', `Tasks (${overlayCounts.assignments})`],
                            ['showPatrolOrigins', `Patrol (${overlayCounts.patrolOrigins})`],
                        ].map(([key, label]) => {
                            const typedKey = key as keyof MapLayerSettings;
                            const isActive = layerSettings[typedKey];
                            return (
                                <button
                                    key={key}
                                    onClick={() => onToggleLayer(typedKey)}
                                    className={`rounded-xl border px-3 py-2 text-left text-xs font-semibold transition-colors ${isActive ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-slate-800 bg-slate-900 text-slate-500'}`}
                                >
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <section className="flex items-center justify-between gap-3 pt-1">
                    <button
                        onClick={onReset}
                        className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold uppercase tracking-widest text-slate-300 hover:bg-slate-900 transition-colors"
                    >
                        Reset operations
                    </button>
                    <div className="text-[11px] text-slate-500 text-right">
                        Keep operators in the loop with real spatial filters and fast event jumps.
                    </div>
                </section>
            </div>
        </div>
    );
};

export default MapOperationsPanel;