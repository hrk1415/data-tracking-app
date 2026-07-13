/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Tracker, LogEntry, COLOR_MAP } from '../types';
import { LucideIcon } from './LucideIcon';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart3, 
  List, 
  Trophy, 
  Calendar, 
  Flame, 
  TrendingUp, 
  TrendingDown,
  Sparkles, 
  HelpCircle,
  Clock
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface WeeklySummaryDashboardWidgetProps {
  trackers: Tracker[];
  logs: LogEntry[];
  selectedDate: string;
}

export function WeeklySummaryDashboardWidget({
  trackers,
  logs,
  selectedDate
}: WeeklySummaryDashboardWidgetProps) {
  const [viewMode, setViewMode] = useState<'overview' | 'chart'>('overview');
  const [chartGrouping, setChartGrouping] = useState<'tracker' | 'day'>('tracker');

  // Compute stats for the past 7 days ending on selectedDate (inclusive)
  const statsData = useMemo(() => {
    const last7Days: string[] = [];
    let refDate = new Date();
    if (selectedDate && selectedDate.includes('-')) {
      const parts = selectedDate.split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const dVal = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(dVal)) {
        refDate = new Date(y, m, dVal, 12, 0, 0);
      }
    }
    if (isNaN(refDate.getTime())) {
      refDate = new Date();
    }
    
    for (let i = 0; i < 7; i++) {
      const d = new Date(refDate.getTime() - i * 24 * 60 * 60 * 1000);
      last7Days.push(d.toISOString().split('T')[0]);
    }
    // Chronological order (oldest to newest)
    last7Days.reverse();

    const prev7Days: string[] = [];
    for (let i = 7; i < 14; i++) {
      const d = new Date(refDate.getTime() - i * 24 * 60 * 60 * 1000);
      prev7Days.push(d.toISOString().split('T')[0]);
    }
    prev7Days.reverse();

    const weekLogs = logs.filter(l => last7Days.includes(l.date));
    const prevWeekLogs = logs.filter(l => prev7Days.includes(l.date));

    const trackerStats = trackers.map(tracker => {
      const trackerWeekLogs = weekLogs.filter(l => l.trackerId === tracker.id);
      const trackerPrevLogs = prevWeekLogs.filter(l => l.trackerId === tracker.id);
      const logsCount = trackerWeekLogs.length;
      const milestonesCount = trackerWeekLogs.filter(l => l.milestone && l.milestone.trim() !== '').length;

      const milestones = trackerWeekLogs
        .filter(l => l.milestone && l.milestone.trim() !== '')
        .map(l => ({
          date: l.date,
          text: l.milestone!,
          value: l.value,
          unit: tracker.unit || ''
        }));

      // Calculate performance metric value for current and previous 7 days
      const getAggregateValue = (t: Tracker, tLogs: LogEntry[]) => {
        if (tLogs.length === 0) return 0;
        
        if (t.type === 'counter') {
          return tLogs.reduce((sum, l) => sum + l.value, 0);
        } else if (t.type === 'boolean') {
          return tLogs.filter(l => l.value > 0).length;
        } else { // 'numeric' or 'rating'
          const sum = tLogs.reduce((sum, l) => sum + l.value, 0);
          return sum / tLogs.length;
        }
      };

      const currVal = getAggregateValue(tracker, trackerWeekLogs);
      const prevVal = getAggregateValue(tracker, trackerPrevLogs);

      let growth: number | null = null;
      if (prevVal > 0) {
        growth = Math.round(((currVal - prevVal) / prevVal) * 100);
      } else if (currVal > 0) {
        growth = 100; // went from 0 to some positive value, so +100% growth
      } else if (trackerWeekLogs.length > 0 || trackerPrevLogs.length > 0) {
        growth = 0; // both are 0 but there were logs
      } else {
        growth = null; // no activity in either week
      }

      const formatValue = (t: Tracker, val: number) => {
        if (t.type === 'boolean') {
          return `${val} day${val !== 1 ? 's' : ''}`;
        }
        if (t.type === 'counter') {
          return `${val} ${t.unit || 'time'}${val !== 1 && !t.unit ? 's' : ''}`;
        }
        // Rating or Numeric
        return `${val.toFixed(1)} ${t.unit || ''}`;
      };

      const tooltipTitle = growth !== null
        ? `This week: ${formatValue(tracker, currVal)} | Last week: ${formatValue(tracker, prevVal)}`
        : 'No activity logs in the last 14 days';

      return {
        id: tracker.id,
        name: tracker.name,
        color: tracker.color,
        icon: tracker.icon,
        category: tracker.category,
        logsCount,
        milestonesCount,
        milestones,
        growth,
        currVal,
        prevVal,
        tooltipTitle
      };
    });

    const dailyStats = last7Days.map(dateStr => {
      const dayLogs = weekLogs.filter(l => l.date === dateStr);
      const logsCount = dayLogs.length;
      const milestonesCount = dayLogs.filter(l => l.milestone && l.milestone.trim() !== '').length;

      const d = new Date(dateStr + 'T12:00:00');
      const label = d.toLocaleDateString(undefined, { weekday: 'short' });
      const formattedDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      return {
        date: dateStr,
        label,
        formattedDate,
        logsCount,
        milestonesCount
      };
    });

    const totalLogs = weekLogs.length;
    const totalMilestones = weekLogs.filter(l => l.milestone && l.milestone.trim() !== '').length;

    const startDateStr = last7Days[0];
    const endDateStr = last7Days[6];

    const formatDateDisplayShort = (dStr: string) => {
      const d = new Date(dStr + 'T12:00:00');
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const dateRangeLabel = `${formatDateDisplayShort(startDateStr)} – ${formatDateDisplayShort(endDateStr)}`;

    // Compile active milestones list for direct text scanning
    const allWeeklyMilestones = trackerStats.flatMap(t => 
      t.milestones.map(m => ({
        ...m,
        trackerName: t.name,
        trackerIcon: t.icon,
        trackerColor: t.color
      }))
    ).sort((a, b) => b.date.localeCompare(a.date));

    return {
      last7Days,
      trackerStats,
      dailyStats,
      totalLogs,
      totalMilestones,
      dateRangeLabel,
      allWeeklyMilestones
    };
  }, [trackers, logs, selectedDate]);

  const {
    trackerStats,
    dailyStats,
    totalLogs,
    totalMilestones,
    dateRangeLabel,
    allWeeklyMilestones
  } = statsData;

  // Render a custom Tooltip for Recharts to maintain editorial aesthetics
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-editorial-dark text-editorial-bg border border-editorial-accent/20 p-3 shadow-lg rounded-none text-xs font-sans space-y-1.5 min-w-[150px]">
          <p className="font-mono text-[9px] text-editorial-bg/60 border-b border-editorial-bg/10 pb-1 mb-1 font-bold">
            {label}
          </p>
          {payload.map((entry: any) => {
            const isMilestone = entry.dataKey === 'milestonesCount';
            const valLabel = isMilestone ? 'Milestones' : 'Log Entries';
            const colorClass = isMilestone ? 'text-editorial-amber' : 'text-editorial-accent';
            return (
              <div key={entry.dataKey} className="flex items-center justify-between gap-3">
                <span className="text-editorial-bg/80">{valLabel}:</span>
                <span className={`font-mono font-bold ${colorClass}`}>
                  {entry.value}
                </span>
              </div>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Recharts Data according to selected grouping
  const chartData = useMemo(() => {
    if (chartGrouping === 'tracker') {
      return trackerStats.map(stat => ({
        name: stat.name,
        logsCount: stat.logsCount,
        milestonesCount: stat.milestonesCount
      }));
    } else {
      return dailyStats.map(day => ({
        name: day.label,
        logsCount: day.logsCount,
        milestonesCount: day.milestonesCount
      }));
    }
  }, [chartGrouping, trackerStats, dailyStats]);

  if (trackers.length === 0) {
    return null; // Don't clutter the dashboard if no trackers configured yet
  }

  return (
    <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-6">
      {/* Header section with toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-editorial-dark/10 pb-4 gap-4">
        <div>
          <span className="block text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-widest">
            Weekly Engagement Summary
          </span>
          <h3 className="font-serif font-medium text-lg text-editorial-dark mt-0.5 flex items-center gap-1.5">
            <Trophy size={18} className="text-editorial-accent" />
            Weekly Summary & Milestones
          </h3>
          <p className="text-[10px] font-sans italic text-editorial-dark/60 mt-0.5">
            Performance & achievements for the 7-day window ending on {dateRangeLabel}
          </p>
        </div>

        {/* Display Selector Toggles */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('overview')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] border transition-all cursor-pointer ${
              viewMode === 'overview'
                ? 'bg-editorial-dark text-editorial-bg border-editorial-dark font-bold'
                : 'bg-transparent text-editorial-dark/60 border-editorial-dark/15 hover:border-editorial-dark/30 hover:text-editorial-dark'
            }`}
          >
            <List size={13} />
            <span>Overview</span>
          </button>
          
          <button
            type="button"
            onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] border transition-all cursor-pointer ${
              viewMode === 'chart'
                ? 'bg-editorial-dark text-editorial-bg border-editorial-dark font-bold'
                : 'bg-transparent text-editorial-dark/60 border-editorial-dark/15 hover:border-editorial-dark/30 hover:text-editorial-dark'
            }`}
          >
            <BarChart3 size={13} />
            <span>Activity Chart</span>
          </button>
        </div>
      </div>

      {/* Mini stats cards overview */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-editorial-dark/10 p-3 bg-editorial-dark/[0.01] flex items-center justify-between gap-3">
          <div>
            <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45">Total Log Frequency</span>
            <span className="font-mono text-xl font-bold text-editorial-dark mt-0.5 block leading-none">
              {totalLogs}
            </span>
          </div>
          <div className="h-8 w-8 rounded-none bg-editorial-accent/10 border border-editorial-accent/20 flex items-center justify-center text-editorial-accent shrink-0">
            <TrendingUp size={14} />
          </div>
        </div>

        <div className="border border-editorial-dark/10 p-3 bg-editorial-dark/[0.01] flex items-center justify-between gap-3">
          <div>
            <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45">Weekly Milestones</span>
            <span className="font-mono text-xl font-bold text-editorial-amber mt-0.5 block leading-none">
              {totalMilestones}
            </span>
          </div>
          <div className="h-8 w-8 rounded-none bg-editorial-amber-light border border-editorial-amber/20 flex items-center justify-center text-editorial-amber shrink-0 animate-pulse">
            <Trophy size={14} className="fill-editorial-amber/10" />
          </div>
        </div>
      </div>

      {/* Main content body */}
      <AnimatePresence mode="wait">
        {viewMode === 'overview' ? (
          <motion.div
            key="overview-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Table layout of Trackers */}
            <div className="border border-editorial-dark/15 overflow-x-auto rounded-none bg-editorial-bg">
              <table className="w-full text-left border-collapse min-w-[580px]">
                <thead>
                  <tr className="border-b border-editorial-dark/10 bg-editorial-dark/[0.02]">
                    <th className="px-4 py-2 text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest">Tracker Name</th>
                    <th className="px-4 py-2 text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest">Category</th>
                    <th className="px-4 py-2 text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest">Logs Recorded</th>
                    <th className="px-4 py-2 text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest">WoW Trend</th>
                    <th className="px-4 py-2 text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest text-right">Milestones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-editorial-dark/5">
                  {trackerStats.map(stat => {
                    const colorStyles = COLOR_MAP[stat.color] || COLOR_MAP.emerald;
                    const maxLogs = Math.max(...trackerStats.map(s => s.logsCount), 1);
                    const percentWidth = Math.max(4, Math.round((stat.logsCount / maxLogs) * 100));

                    return (
                      <tr key={stat.id} className="hover:bg-editorial-dark/[0.01] transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className={`h-7 w-7 flex shrink-0 items-center justify-center text-white border border-editorial-dark/10 ${colorStyles.bg}`}>
                              <LucideIcon name={stat.icon} size={14} />
                            </div>
                            <span className="font-serif font-semibold text-xs text-editorial-dark truncate leading-tight">
                              {stat.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[10px] font-sans text-editorial-dark/65 italic">
                            {stat.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="font-mono text-xs font-bold text-editorial-dark shrink-0 w-6">
                              {stat.logsCount}
                            </span>
                            {/* Simple inline visual weight strip */}
                            <div className="w-24 bg-editorial-dark/5 h-1.5 rounded-none overflow-hidden shrink-0">
                              <div 
                                className={`h-full ${colorStyles.bg}`}
                                style={{ width: `${percentWidth}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {stat.growth !== null ? (
                            <div className="flex items-center gap-1.5" title={stat.tooltipTitle}>
                              {stat.growth > 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-editorial-emerald bg-editorial-emerald/10 border border-editorial-emerald/20 px-1.5 py-0.5 rounded-none">
                                  <TrendingUp size={11} className="stroke-[2.5px]" />
                                  <span>+{stat.growth}%</span>
                                </span>
                              ) : stat.growth < 0 ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-editorial-rose bg-editorial-rose/10 border border-editorial-rose/20 px-1.5 py-0.5 rounded-none">
                                  <TrendingDown size={11} className="stroke-[2.5px]" />
                                  <span>{stat.growth}%</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-editorial-dark/50 bg-editorial-dark/5 border border-editorial-dark/10 px-1.5 py-0.5 rounded-none">
                                  <span className="w-1.5 h-0.5 bg-editorial-dark/40 block rounded-full" />
                                  <span>0%</span>
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] font-mono text-editorial-dark/30 italic" title={stat.tooltipTitle}>—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {stat.milestonesCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider bg-editorial-amber-light text-editorial-amber border border-editorial-amber/20 px-2 py-0.5">
                              <Trophy size={10} className="fill-editorial-amber/15" />
                              <span>{stat.milestonesCount} Achieved</span>
                            </span>
                          ) : (
                            <span className="text-xs text-editorial-dark/25 font-mono">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* List of concrete milestone text accomplishments logged this week */}
            {allWeeklyMilestones.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-editorial-dark/10">
                <h4 className="text-[10px] font-mono text-editorial-accent tracking-widest uppercase font-semibold flex items-center gap-1">
                  <Sparkles size={11} className="text-editorial-amber" />
                  Weekly Accomplishment Journal
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {allWeeklyMilestones.map((ms, index) => {
                    const colorStyles = COLOR_MAP[ms.trackerColor] || COLOR_MAP.emerald;
                    const dateObj = new Date(ms.date + 'T12:00:00');
                    const formattedDate = dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

                    return (
                      <div 
                        key={`${ms.date}-${index}`}
                        className="border border-editorial-dark/10 p-3 bg-editorial-dark/[0.01] hover:bg-editorial-dark/[0.03] transition-all flex flex-col justify-between space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className={`h-2 w-2 shrink-0 ${colorStyles.bg}`} />
                            <span className="text-[10px] font-mono text-editorial-dark/50 uppercase tracking-wider truncate">
                              {ms.trackerName}
                            </span>
                          </div>
                          <span className="text-[9px] font-mono text-editorial-dark/40 uppercase whitespace-nowrap shrink-0">
                            {formattedDate}
                          </span>
                        </div>
                        <p className="text-xs font-serif italic text-editorial-dark font-medium leading-relaxed">
                          " {ms.text} "
                        </p>
                        {ms.value > 0 && (
                          <span className="text-[8px] font-mono text-editorial-dark/45 block self-end">
                            Logged entry value: {ms.value} {ms.unit}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="chart-tab"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Chart Sub Toggles */}
            <div className="flex items-center justify-between bg-editorial-dark/[0.02] border border-editorial-dark/10 p-2">
              <span className="text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest pl-1">
                Chart Grouping:
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setChartGrouping('tracker')}
                  className={`px-2 py-1 text-[10px] font-mono transition-colors cursor-pointer ${
                    chartGrouping === 'tracker'
                      ? 'bg-editorial-accent text-editorial-bg font-bold'
                      : 'bg-transparent text-editorial-dark/60 hover:text-editorial-dark'
                  }`}
                >
                  By Tracker
                </button>
                <button
                  type="button"
                  onClick={() => setChartGrouping('day')}
                  className={`px-2 py-1 text-[10px] font-mono transition-colors cursor-pointer ${
                    chartGrouping === 'day'
                      ? 'bg-editorial-accent text-editorial-bg font-bold'
                      : 'bg-transparent text-editorial-dark/60 hover:text-editorial-dark'
                  }`}
                >
                  By Weekday
                </button>
              </div>
            </div>

            {/* Recharts Bar Chart Container */}
            <div className="h-72 w-full pt-2">
              {totalLogs === 0 ? (
                <div className="h-full border border-dashed border-editorial-dark/25 flex items-center justify-center p-6 text-center">
                  <p className="text-xs font-serif italic text-editorial-dark/60">
                    No log entries logged yet for this week ending on {dateRangeLabel}.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid 
                      strokeDasharray="2 2" 
                      vertical={false} 
                      stroke="var(--editorial-dark)" 
                      strokeOpacity={0.08} 
                    />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 9, fill: 'var(--editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                      axisLine={{ stroke: 'var(--editorial-dark)', strokeOpacity: 0.15 }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 9, fill: 'var(--editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                      axisLine={{ stroke: 'var(--editorial-dark)', strokeOpacity: 0.15 }}
                      tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--editorial-dark)', opacity: 0.02 }} />
                    <Legend 
                      verticalAlign="top"
                      height={36}
                      iconType="rect"
                      iconSize={10}
                      wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', opacity: 0.8 }}
                    />
                    <Bar 
                      name="Log Entries"
                      dataKey="logsCount" 
                      fill="var(--editorial-accent)" 
                      maxBarSize={30} 
                    />
                    <Bar 
                      name="Milestones"
                      dataKey="milestonesCount" 
                      fill="#b38364" 
                      maxBarSize={30} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
