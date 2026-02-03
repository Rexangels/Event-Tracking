import React, { useState } from 'react';
import { IntelligenceEvent } from '../types';
import { Badge } from './ui/Badge';
import DeepDiveChat from './DeepDiveChat';

import { ExportFile } from '../services/ExportService';

interface AnalystModuleProps {
  events: IntelligenceEvent[];
  sharedExports?: ExportFile[];
  onSharedExport?: (file: ExportFile) => void;
}

const AnalystModule: React.FC<AnalystModuleProps> = ({ events, sharedExports = [], onSharedExport }) => {
  const exportedFiles = sharedExports;

  // Real-time clustering logic
  const clusters = React.useMemo(() => {
    const groups = events.reduce((acc, event) => {
      const key = event.type;
      if (!acc[key]) acc[key] = { label: `${key}_CLUSTER`, count: 0, severity: event.severity };
      acc[key].count++;
      // Upgrade severity if higher
      if (['HIGH', 'CRITICAL'].includes(event.severity)) acc[key].severity = event.severity;
      return acc;
    }, {} as Record<string, { label: string; count: number; severity: string }>);

    return Object.values(groups).sort((a, b) => b.count - a.count).slice(0, 3);
  }, [events]);

  const handleExport = (file: ExportFile) => {
    if (onSharedExport) onSharedExport(file);
  };

  const downloadFile = (file: ExportFile) => {
    let blobPart: BlobPart = file.data;

    // If it's a PDF, the data is base64 encoded and needs decoding
    if (file.type === 'pdf') {
      const byteCharacters = atob(file.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      blobPart = new Uint8Array(byteNumbers);
    }

    const type = file.type === 'pdf' ? 'application/pdf' : file.type === 'csv' ? 'text/csv' : 'application/json';
    const blob = new Blob([blobPart], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Intelligence Briefing Input/Action */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-xl h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Strategic Trend Analysis</h2>
                <p className="text-sm text-slate-400">Powered by Google ADK - Cross-sector correlation matrix.</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] text-slate-500 font-mono">VECTORS: {events.length}</span>
                  <span className="text-[10px] text-blue-500 font-mono">AGENT: ACTIVE</span>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <DeepDiveChat events={events} onExport={handleExport} />
            </div>
          </div>
        </div>

        {/* Sidebar Intelligence Stats */}
        <div className="flex flex-col gap-6">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Correlation Clusters</h3>
            <div className="space-y-3">
              {clusters.map((cluster, i) => (
                <div key={i} className="p-3 bg-slate-950 border border-slate-800 rounded flex justify-between items-center group hover:border-blue-500/50 transition-colors cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-slate-300">{cluster.label}</div>
                    <div className="text-[9px] text-slate-600 uppercase mt-0.5">{cluster.count} Related Nodes</div>
                  </div>
                  <Badge variant={cluster.severity === 'CRITICAL' ? 'critical' : cluster.severity === 'HIGH' ? 'warning' : 'default'}>
                    {cluster.severity}
                  </Badge>
                </div>
              ))}
              {clusters.length === 0 && (
                <div className="text-[9px] text-slate-700 font-mono italic">No clusters correlated...</div>
              )}
            </div>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 flex-1">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Export Pipeline</h3>
            <div className="space-y-2">
              {exportedFiles.map((file, i) => (
                <button
                  key={i}
                  onClick={() => downloadFile(file)}
                  className="w-full py-2 px-3 text-[10px] font-mono text-left bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 text-blue-400 hover:text-blue-300 transition-all flex justify-between items-center group"
                >
                  <span>&gt; {file.name}</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity">⬇️</span>
                </button>
              ))}
              {exportedFiles.length === 0 && (
                <div className="text-[9px] text-slate-700 font-mono italic">No active exports... AI can generate these on request.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalystModule;
