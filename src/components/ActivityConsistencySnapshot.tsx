/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { LogEntry } from '../types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell
} from 'recharts';
import { BarChart3, Calendar, Flame, CheckCircle2, Award } from 'lucide-react';
import { motion } from 'motion/react';

interface ActivityConsistencySnapshotProps {
  logs: LogEntry[];
  selectedDate?: string;
  dateRangeList?: string[];
  timeMode?: string;
}

export function ActivityConsistencySnapshot({ logs, selectedDate, dateRangeList, timeMode }: ActivityConsistencySnapshotProps) {
  // Use today's date based on current client time or selectedDate
  const referenceDateStr = useMemo(() => {
    if (selectedDate) return selectedDate;
    return new Date().toISOString().split('T')[0];
  }, [selectedDate]);

  // Calculate the range data based on the dynamic dateRangeList or fall back to last 7 days
  const rangeData = useMemo(() => {
    if (dateRangeList && dateRangeList.length > 0) {
      return dateRangeList.map(dateStr => {
        const d = new Date(dateStr + 'T12:00:00');
        const dayLogs = logs.filter(l => l.date === dateStr);
        const displayDate = d.toLocaleDateString(undefined, { 
          weekday: 'short', 
          month: 'short', 
          day: 'numeric' 
        });
        const dayOfWeek = d.toLocaleDateString(undefined, { weekday: 'short' });
        return {
          date: dateStr,
          dayOfWeek,
          displayDate,
          logsCount: dayLogs.length,
        };
      });
    }

    // Fallback to last 7 days
    const refDate = new Date(referenceDateStr + 'T12:00:00');
    const data = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(refDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const dayLogs = logs.filter(l => l.date === dateStr);

      const displayDate = d.toLocaleDateString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });
      const dayOfWeek = d.toLocaleDateString(undefined, { weekday: 'short' });

      data.push({
        date: dateStr,
        dayOfWeek,
        displayDate,
        logsCount: dayLogs.length,
      });
    }

    return data;
  }, [logs, referenceDateStr, dateRangeList]);

  // Summarized metrics
  const summary = useMemo(() => {
    let totalLogs = 0;
    let activeDaysCount = 0;
    let peakDayName = 'N/A';
    let peakLogsCount = 0;

    rangeData.forEach(day => {
      totalLogs += day.logsCount;
      if (day.logsCount > 0) {
        activeDaysCount++;
      }
      if (day.logsCount > peakLogsCount) {
        peakLogsCount = day.logsCount;
        peakDayName = day.dayOfWeek;
      }
    });

    const totalDays = rangeData.length || 7;
    const averageLogsPerDay = Math.round((totalLogs / totalDays) * 10) / 10;
    const consistencyRate = Math.round((activeDaysCount / totalDays) * 100);

    return {
      totalLogs,
      activeDaysCount,
      averageLogsPerDay,
      consistencyRate,
      peakDayName,
      peakLogsCount
    };
  }, [rangeData]);

  // Title formatting based on selected range
  const titleText = useMemo(() => {
    if (timeMode === '7') return '7-Day Activity Consistency Snapshot';
    if (timeMode === '30') return '30-Day Activity Consistency Snapshot';
    if (timeMode === '90') return '90-Day Activity Consistency Snapshot';
    if (timeMode === 'custom') return `${rangeData.length}-Day Custom Activity Consistency Snapshot`;
    return 'Activity Consistency Snapshot';
  }, [timeMode, rangeData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-6"
    >
      {/* Header and subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-editorial-dark/10 pb-4.5 gap-4">
        <div>
          <h3 className="font-serif font-medium text-lg text-editorial-dark flex items-center gap-2">
            <BarChart3 className="text-editorial-accent shrink-0 animate-pulse" size={18} />
            {titleText}
          </h3>
          <p className="text-xs font-sans italic text-editorial-dark/60 mt-1">
            Total log entry counts per day over the selected timeframe to evaluate habit routine consistency.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono font-bold text-editorial-accent bg-editorial-accent-light border border-editorial-accent/25 px-2.5 py-1 uppercase tracking-widest">
            Consistency: {summary.consistencyRate}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: Summary metrics list */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4 border-b lg:border-b-0 lg:border-r border-editorial-dark/10 pb-6 lg:pb-0 lg:pr-6">
          <div className="space-y-4">
            <span className="block text-[9px] font-mono font-semibold uppercase tracking-widest text-editorial-dark/45">
              Activity Statistics
            </span>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-editorial-dark/45 uppercase">Total Logs</span>
                <p className="text-2xl font-mono font-light text-editorial-dark">
                  {summary.totalLogs}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono text-editorial-dark/45 uppercase">Active Days</span>
                <p className="text-2xl font-mono font-light text-editorial-dark">
                  {summary.activeDaysCount} <span className="text-xs font-serif text-editorial-dark/50">/ {rangeData.length}</span>
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono text-editorial-dark/45 uppercase">Daily Average</span>
                <p className="text-2xl font-mono font-light text-editorial-dark">
                  {summary.averageLogsPerDay}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-mono text-editorial-dark/45 uppercase">Peak Activity</span>
                <p className="text-2xl font-mono font-light text-editorial-dark">
                  {summary.peakDayName} <span className="text-xs font-serif text-editorial-dark/50">({summary.peakLogsCount})</span>
                </p>
              </div>
            </div>
          </div>

          <div className="p-3 bg-editorial-accent-light/10 border border-editorial-dark/10 flex items-start gap-2.5 mt-2">
            <Award size={14} className="text-editorial-accent shrink-0 mt-0.5" />
            <p className="text-[11px] font-sans italic text-editorial-dark/75 leading-relaxed">
              {summary.consistencyRate >= 80 
                ? 'Exceptional consistency! You are maintaining an excellent tracking routine.' 
                : summary.consistencyRate >= 50 
                ? 'Good tracking momentum. Try log entries daily to build a sustainable streak.' 
                : 'Logging is occasional. Setting a daily alarm or visual checklist reminders may help.'}
            </p>
          </div>
        </div>

        {/* Right Side: Recharts Bar Chart */}
        <div className="lg:col-span-8 flex flex-col justify-between h-[200px] w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rangeData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="var(--color-editorial-dark)" strokeOpacity={0.08} />
              <XAxis
                dataKey={rangeData.length > 20 ? 'date' : 'dayOfWeek'}
                tick={{ fontSize: 9, fill: 'var(--color-editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 9, fill: 'var(--color-editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                cursor={{ fill: 'var(--color-editorial-accent)', opacity: 0.04 }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-editorial-dark text-editorial-bg rounded-none p-3 shadow-md text-xs space-y-1 font-sans border border-editorial-accent/30">
                        <p className="font-mono text-[9px] text-editorial-bg/60 border-b border-editorial-bg/15 pb-1 mb-1">
                          {data.displayDate}
                        </p>
                        <p className="font-serif text-xs">
                          Logged <span className="font-mono font-bold text-editorial-accent">{data.logsCount}</span> entry{data.logsCount === 1 ? '' : 'ies'}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar 
                dataKey="logsCount" 
                radius={[2, 2, 0, 0]}
              >
                {rangeData.map((entry, index) => {
                  // Highlight peak logging days with full accent, others with softer desaturated color
                  const isPeak = entry.logsCount > 0 && entry.logsCount === summary.peakLogsCount;
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={isPeak ? '#cca08a' : '#8fa89b'} 
                      fillOpacity={entry.logsCount === 0 ? 0.15 : 0.85}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
