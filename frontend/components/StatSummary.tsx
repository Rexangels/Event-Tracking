
import React, { useEffect, useState } from 'react';
import api from '../services/api';
import Tooltip from './ui/Tooltip';

interface StatsData {
  active_reports: number;
  critical_sectors: number;
  sensor_integrity: number;
  global_heat_index: number;
}

const StatSummary: React.FC = () => {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get<StatsData>('/stats/summary/');
        setStats(response.data);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      }
    };
    fetchStats();

    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!stats) return (
    <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex justify-center">
      <span className="text-xs text-slate-500 animate-pulse">SYNCING_TELEMETRY...</span>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-6 py-4 bg-slate-950 border-b border-slate-800">
      <Tooltip content="Total number of verified and unverified reports received in the last 24 hours.">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Active Reports</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{stats.active_reports.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-500 font-mono">+12.4%</span>
          </div>
        </div>
      </Tooltip>
      <Tooltip content="Sectors currently reporting high-severity events requiring immediate attention.">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Critical Sectors</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${stats.critical_sectors > 0 ? 'text-red-500' : 'text-slate-100'}`}>
              {stats.critical_sectors.toString().padStart(2, '0')}
            </span>
            <span className="text-[10px] text-slate-600 font-mono">/ 24 TOTAL</span>
          </div>
        </div>
      </Tooltip>
      <Tooltip content="Operational status of the global distributed sensor network.">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sensor Integrity</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{stats.sensor_integrity}%</span>
            <span className="text-[10px] text-blue-400 font-mono">NOMINAL</span>
          </div>
        </div>
      </Tooltip>
      <Tooltip content="Aggregated intensity of world-wide event activity.">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Heat Index</span>
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${stats.global_heat_index > 7 ? 'text-orange-500' : 'text-slate-100'}`}>
              {stats.global_heat_index}
            </span>
            <span className="text-[10px] text-slate-600 font-mono">{stats.global_heat_index > 5 ? 'ELEVATED' : 'STABLE'}</span>
          </div>
        </div>
      </Tooltip>
    </div>
  );
};

export default StatSummary;
