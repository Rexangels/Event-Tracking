
import React from 'react';
import { Badge } from './ui/Badge';

const GovernanceModule: React.FC = () => {
  const AUDIT_LOGS = [
    { id: 'LOG-8821', action: 'DATA_INGESTION', source: 'SeismicNet API', status: 'VERIFIED', time: '14:22:01' },
    { id: 'LOG-8822', action: 'AGENT_ACCESS', source: 'SEC-USR-4921', status: 'AUTHORIZED', time: '14:15:33' },
    { id: 'LOG-8823', action: 'POLICY_ENFORCEMENT', source: 'GDPR_RESTRICTION_V2', status: 'ACTIVE', time: '13:55:10' },
    { id: 'LOG-8824', action: 'SYSTEM_UPGRADE', source: 'CORE_KERNEL', status: 'SUCCESS', time: '12:00:00' },
    { id: 'LOG-8825', action: 'THREAT_MODEL_RECAL', source: 'SENTINEL_AI', status: 'STABLE', time: '11:45:12' },
  ];

  return (
    <div className="flex flex-col h-full gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Compliance Scorecards */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-4">Trust Infrastructure</div>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-[11px] mb-2">
                  <span className="text-slate-400">Data Integrity</span>
                  <span className="text-emerald-500 font-mono">100%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full">
                  <div className="bg-emerald-500 h-full w-full shadow-[0_0_8px_#10b981]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-2">
                  <span className="text-slate-400">Source Verification</span>
                  <span className="text-blue-500 font-mono">94%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full">
                  <div className="bg-blue-500 h-full w-[94%] shadow-[0_0_8px_#3b82f6]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[11px] mb-2">
                  <span className="text-slate-400">Audit Coverage</span>
                  <span className="text-orange-500 font-mono">88%</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full">
                  <div className="bg-orange-500 h-full w-[88%] shadow-[0_0_8px_#f97316]"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">Active Directives</h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-[10px] text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                UN_GEOSPATIAL_PROTOCOL_12
              </li>
              <li className="flex items-center gap-2 text-[10px] text-slate-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                EU_PRIVACY_SHIELD_V4
              </li>
              <li className="flex items-center gap-2 text-[10px] text-slate-600">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                US_FEDRAMP_ALIGNMENT (PENDING)
              </li>
            </ul>
          </div>
        </div>

        {/* Central Audit Ledger */}
        <div className="lg:col-span-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-800/50 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest">Immutable System Ledger</h2>
              <Badge variant="outline">Ledger_Sync_Active</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-mono">
                <thead>
                  <tr className="bg-slate-950 text-slate-500 border-b border-slate-800">
                    <th className="px-6 py-3 font-bold uppercase">ID_ENTRY</th>
                    <th className="px-6 py-3 font-bold uppercase">ACTION_TYPE</th>
                    <th className="px-6 py-3 font-bold uppercase">ORIGIN_VECTOR</th>
                    <th className="px-6 py-3 font-bold uppercase">STATUS_HEX</th>
                    <th className="px-6 py-3 font-bold uppercase">TIMESTAMP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {AUDIT_LOGS.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-6 py-4 text-slate-500">{log.id}</td>
                      <td className="px-6 py-4 text-blue-400 font-bold">{log.action}</td>
                      <td className="px-6 py-4 text-slate-400">{log.source}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${log.status === 'SUCCESS' || log.status === 'VERIFIED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-500/10 text-blue-500'}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">{log.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-950/50 flex justify-center">
              <button className="text-[10px] text-slate-500 hover:text-blue-400 underline uppercase tracking-widest font-bold">Load_Archived_Chain_Data</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovernanceModule;
