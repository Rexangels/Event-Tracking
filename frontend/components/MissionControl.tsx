import React, { useState } from 'react';
import { IntelligenceEvent } from '../types';
import { ExportService, ExportFile } from '../services/ExportService';

interface MissionControlProps {
    events: IntelligenceEvent[];
    onExport: (file: ExportFile) => void;
}

const MissionControl: React.FC<MissionControlProps> = ({ events, onExport }) => {
    const [runningProcedure, setRunningProcedure] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);

    const runProcedure = (procedure: string, template: string) => {
        if (runningProcedure) return;

        setRunningProcedure(procedure);
        setProgress(0);

        // Simulate procedural analysis
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setTimeout(() => {
                        finalizeExport(template);
                        setRunningProcedure(null);
                    }, 500);
                    return 100;
                }
                return prev + Math.floor(Math.random() * 20) + 5;
            });
        }, 400);
    };

    const finalizeExport = (template: string) => {
        let file: ExportFile;

        switch (template) {
            case 'SITUATION_REPORT_PDF':
                file = ExportService.generateBriefing(events, "SITUATION_REPORT");
                break;
            case 'RAW_CSV_GEOPACKAGE':
                file = ExportService.generateCSV(events, "TACTICAL_DATA");
                break;
            case 'MEDIA_EVIDENCE_BUNDLE':
                file = ExportService.generateGeoJSON(events);
                break;
            default:
                return;
        }

        onExport(file);
    };

    return (
        <div className="bg-slate-950 rounded-lg border border-slate-800 p-4 flex flex-col shadow-xl h-full">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400">Mission Control</h3>
                <button className="text-[10px] bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded transition-colors text-slate-300">NEW_QUERY</button>
            </div>

            <div className="flex-1 space-y-4">
                {runningProcedure ? (
                    <div className="p-3 bg-slate-900/50 rounded border border-slate-800/50 animate-in fade-in">
                        <div className="text-[10px] text-blue-500 font-mono mb-1 flex justify-between">
                            <span>PROCEDURE: {runningProcedure}</span>
                            <span className="animate-pulse">●</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
                            <div
                                className="bg-blue-500 h-full transition-all duration-300 shadow-[0_0_8px_#3b82f6]"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <div className="mt-2 text-[10px] text-slate-500 flex justify-between">
                            <span>Synthesizing structural vectors...</span>
                            <span>{progress}%</span>
                        </div>
                    </div>
                ) : (
                    <div className="p-3 bg-slate-900/20 rounded border border-dashed border-slate-800 flex items-center justify-center h-20">
                        <span className="text-[10px] text-slate-600 font-mono uppercase">System Idle // Ready for Procedure</span>
                    </div>
                )}

                <div className="space-y-2">
                    <h4 className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter mb-1">Procedural Export Templates</h4>
                    {[
                        { id: 'SITUATION_REPORT_PDF', label: 'SITUATION_REPORT_PDF' },
                        { id: 'RAW_CSV_GEOPACKAGE', label: 'RAW_CSV_GEOPACKAGE' },
                        { id: 'MEDIA_EVIDENCE_BUNDLE', label: 'MEDIA_EVIDENCE_BUNDLE' }
                    ].map(t => (
                        <div
                            key={t.id}
                            onClick={() => runProcedure(`PROCEDURE_${t.id.slice(0, 4)}`, t.id)}
                            className={`p-2 border border-slate-900 rounded transition-all cursor-pointer text-[10px] font-mono flex justify-between group ${runningProcedure ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-900 hover:border-slate-700'}`}
                        >
                            <span className="text-slate-400 group-hover:text-blue-400 transition-colors">{t.label}</span>
                            <span className="text-slate-600 opacity-0 group-hover:opacity-100 tracking-widest text-[9px] transition-opacity">INITIATE</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="mt-auto pt-4 border-t border-slate-900">
                <div className="flex items-center gap-2 text-[9px] text-slate-600 font-mono">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>IMMUTABLE LOGGING ACTIVE</span>
                </div>
            </div>
        </div>
    );
};

export default MissionControl;
