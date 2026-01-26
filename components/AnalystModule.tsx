
import React, { useState } from 'react';
import { IntelligenceEvent } from '../types';
import { analyzeTrends } from '../services/geminiService';
import { Badge } from './ui/Badge';

interface AnalystModuleProps {
  events: IntelligenceEvent[];
}

const AnalystModule: React.FC<AnalystModuleProps> = ({ events }) => {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const result = await analyzeTrends(events);
    setAnalysis(result);
    setIsAnalyzing(false);
  };

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Intelligence Briefing Input/Action */}
        <div className="xl:col-span-2 flex flex-col gap-4">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 shadow-xl">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Strategic Trend Analysis</h2>
                <p className="text-sm text-slate-400">Leveraging Gemini-3 Pro for cross-sector correlation.</p>
              </div>
              <button 
                onClick={handleAnalyze}
                disabled={isAnalyzing}
                className={`px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 rounded text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${isAnalyzing ? 'animate-pulse' : ''}`}
              >
                {isAnalyzing ? 'Processing_Data...' : 'Generate_Briefing'}
              </button>
            </div>

            <div className="min-h-[300px] bg-slate-950/80 rounded-lg border border-slate-800 p-6 font-light leading-relaxed text-slate-300">
              {analysis ? (
                <div className="space-y-4 prose prose-invert max-w-none">
                  {analysis.split('\n').map((para, i) => para.trim() ? <p key={i}>{para}</p> : null)}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-20">
                  <div className="w-16 h-16 rounded-full border-2 border-slate-800 border-t-blue-600 animate-spin mb-4" style={{ display: isAnalyzing ? 'block' : 'none' }}></div>
                  {!isAnalyzing && (
                    <>
                      <svg className="w-12 h-12 text-slate-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0012 18.75c-1.03 0-1.9-.4-2.593-.88l-.547-.547z" />
                      </svg>
                      <p className="text-slate-500 italic">Initiate briefing to correlate {events.length} active event vectors.</p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Intelligence Stats */}
        <div className="flex flex-col gap-6">
          <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Correlation Clusters</h3>
            <div className="space-y-3">
              {[
                { label: 'Energy Sector Probes', count: 12, risk: 'High' },
                { label: 'Coastal Seismic Anomalies', count: 4, risk: 'Critical' },
                { label: 'Border Flow Fluctuations', count: 8, risk: 'Medium' }
              ].map((cluster, i) => (
                <div key={i} className="p-3 bg-slate-950 border border-slate-800 rounded flex justify-between items-center group hover:border-blue-500/50 transition-colors cursor-pointer">
                  <div>
                    <div className="text-xs font-bold text-slate-300">{cluster.label}</div>
                    <div className="text-[9px] text-slate-600 uppercase mt-0.5">{cluster.count} Related Nodes</div>
                  </div>
                  <Badge variant={cluster.risk === 'Critical' ? 'critical' : cluster.risk === 'High' ? 'warning' : 'default'}>
                    {cluster.risk}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-950 rounded-xl border border-slate-800 p-6 flex-1">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Export Pipeline</h3>
            <div className="space-y-2">
              <button className="w-full py-2 px-3 text-[10px] font-mono text-left bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                > Intel_Brief_2024_Q4.pdf
              </button>
              <button className="w-full py-2 px-3 text-[10px] font-mono text-left bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                > Tactical_CSV_Export.raw
              </button>
              <button className="w-full py-2 px-3 text-[10px] font-mono text-left bg-slate-900 border border-slate-800 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-all">
                > GeoJSON_Sector_Map.json
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalystModule;
