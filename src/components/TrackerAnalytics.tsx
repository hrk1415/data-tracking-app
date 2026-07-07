/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Tracker, LogEntry, COLOR_MAP } from '../types';
import { LucideIcon } from './LucideIcon';
import {
  TrendingUp,
  Flame,
  Calendar,
  Award,
  CheckCircle2,
  ChevronDown,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';

interface TrackerAnalyticsProps {
  trackers: Tracker[];
  logs: LogEntry[];
}

type TimeRange = '7' | '14' | '30';

export function TrackerAnalytics({ trackers, logs }: TrackerAnalyticsProps) {
  const [selectedTrackerId, setSelectedTrackerId] = useState<string>(
    trackers.length > 0 ? trackers[0].id : ''
  );
  const [timeRange, setTimeRange] = useState<TimeRange>('7');

  // Ensure selected tracker is still valid
  const selectedTracker = useMemo(() => {
    return trackers.find(t => t.id === selectedTrackerId) || trackers[0] || null;
  }, [trackers, selectedTrackerId]);

  // Set initial selected tracker when trackers load
  React.useEffect(() => {
    if (trackers.length > 0 && !selectedTrackerId) {
      setSelectedTrackerId(trackers[0].id);
    }
  }, [trackers, selectedTrackerId]);

  // Calculate past dates in YYYY-MM-DD format based on range
  const dateRangeList = useMemo(() => {
    const days = parseInt(timeRange);
    const list: string[] = [];
    const today = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      list.push(d.toISOString().split('T')[0]);
    }
    return list;
  }, [timeRange]);

  // Calculate chart data for selected tracker
  const chartData = useMemo(() => {
    if (!selectedTracker) return [];

    return dateRangeList.map(dateStr => {
      const dayLogs = logs.filter(l => l.trackerId === selectedTracker.id && l.date === dateStr);

      let dayValue = 0;
      if (selectedTracker.type === 'counter') {
        dayValue = dayLogs.reduce((sum, log) => sum + log.value, 0);
      } else if (dayLogs.length > 0) {
        dayValue = dayLogs[dayLogs.length - 1].value;
      }

      // Format date for chart X-axis (e.g. "Jul 05")
      const parts = dateStr.split('-');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const mIndex = parseInt(parts[1]) - 1;
      const formattedDate = `${monthNames[mIndex]} ${parts[2]}`;

      // Notes on this day
      const notes = dayLogs.map(l => l.note).filter(Boolean).join('; ');

      return {
        date: dateStr,
        displayDate: formattedDate,
        value: dayValue,
        notes: notes || undefined,
        hasLog: dayLogs.length > 0,
      };
    });
  }, [selectedTracker, logs, dateRangeList]);

  // Calculations for KPI Cards
  const stats = useMemo(() => {
    if (!selectedTracker || chartData.length === 0) {
      return {
        average: 0,
        total: 0,
        bestValue: 0,
        bestDate: '-',
        completionRate: 0,
        streak: 0,
        loggedDaysCount: 0,
      };
    }

    const values = chartData.map(d => d.value);
    const loggedDays = chartData.filter(d => d.hasLog);

    // Sum
    const total = values.reduce((sum, v) => sum + v, 0);

    // Average
    // For counter and numeric, average of logged days is usually preferred, but overall daily average is also useful. Let's do overall daily average.
    const average = Math.round((total / chartData.length) * 10) / 10;

    // Best Value
    let bestValue = 0;
    let bestDate = '-';
    chartData.forEach(d => {
      if (d.value > bestValue) {
        bestValue = d.value;
        const parts = d.date.split('-');
        bestDate = `${parts[1]}/${parts[2]}`;
      }
    });

    // Completion Rate (days where target is met)
    const target = selectedTracker.targetValue;
    let completionDays = 0;
    if (target) {
      chartData.forEach(d => {
        if (d.value >= target) completionDays++;
      });
    }
    const completionRate = target ? Math.round((completionDays / chartData.length) * 100) : 0;

    // Streak calculation (working backwards from today)
    let streak = 0;
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Check if logged today or yesterday to continue current streak
    const hasLoggedToday = logs.some(l => l.trackerId === selectedTracker.id && l.date === todayStr);
    const hasLoggedYesterday = logs.some(l => l.trackerId === selectedTracker.id && l.date === yesterdayStr);

    if (hasLoggedToday || hasLoggedYesterday) {
      let checkDate = hasLoggedToday ? new Date() : new Date(Date.now() - 24 * 60 * 60 * 1000);
      let searching = true;

      while (searching) {
        const dStr = checkDate.toISOString().split('T')[0];
        const dayHasLog = logs.some(l => l.trackerId === selectedTracker.id && l.date === dStr);

        if (dayHasLog) {
          streak++;
          // Move to previous day
          checkDate = new Date(checkDate.getTime() - 24 * 60 * 60 * 1000);
        } else {
          searching = false;
        }
      }
    }

    return {
      average,
      total,
      bestValue,
      bestDate,
      completionRate,
      streak,
      loggedDaysCount: loggedDays.length,
    };
  }, [selectedTracker, chartData, logs]);

  // Color theme details
  const activeColor = selectedTracker ? selectedTracker.color : 'emerald';
  const colorStyles = COLOR_MAP[activeColor] || COLOR_MAP.emerald;

  // Render notes stream
  const notesStream = useMemo(() => {
    if (!selectedTracker) return [];
    return logs
      .filter(l => l.trackerId === selectedTracker.id && l.note)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);
  }, [selectedTracker, logs]);

  if (!selectedTracker) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-editorial-dark/25 rounded-none bg-editorial-bg">
        <LucideIcon name="BarChart2" className="text-editorial-accent mb-4" size={36} />
        <h3 className="font-serif text-lg text-editorial-dark">No Trackers Available</h3>
        <p className="text-xs text-editorial-dark/60 max-w-xs mt-1 leading-relaxed">
          Create a tracker on the dashboard first to view detailed analytics.
        </p>
      </div>
    );
  }

  // Define hex color codes for Area Chart based on Tailwind name
  const colorHexes: Record<string, string> = {
    emerald: '#8fa89b', // Desaturated green
    blue: '#8da4c4',    // Desaturated blue
    indigo: '#9899c4',  // Desaturated indigo
    violet: '#a398c2',  // Desaturated violet
    amber: '#c7b38f',   // Desaturated gold/bronze
    rose: '#c9929d',    // Desaturated rose
    orange: '#cca08a',  // Desaturated orange
  };
  const hexColor = colorHexes[activeColor] || '#c7b38f';

  return (
    <div className="space-y-6">
      {/* Selector and Filter Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-editorial-bg p-5 rounded-none border border-editorial-dark/15">
        {/* Tracker Selection Dropdown */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-editorial-dark/50 uppercase tracking-wider shrink-0">Metrics for:</span>
          <div className="relative">
            <select
              value={selectedTrackerId}
              onChange={(e) => setSelectedTrackerId(e.target.value)}
              className="appearance-none rounded-none border border-editorial-dark/20 bg-editorial-bg pl-4 pr-10 py-2 text-sm font-serif font-medium text-editorial-dark focus:border-editorial-accent transition-all outline-hidden cursor-pointer"
            >
              {trackers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-editorial-dark/50 pointer-events-none" size={15} />
          </div>
        </div>

        {/* Timeframe Range */}
        <div className="flex rounded-none bg-editorial-dark/5 p-1 self-start sm:self-auto border border-editorial-dark/10">
          {(['7', '14', '30'] as TimeRange[]).map((range) => (
            <button
              key={range}
              type="button"
              onClick={() => setTimeRange(range)}
              className={`rounded-none px-4 py-1.5 text-xs font-mono font-medium transition-all cursor-pointer ${
                timeRange === range
                  ? 'bg-editorial-accent text-editorial-bg'
                  : 'text-editorial-dark/60 hover:text-editorial-dark'
              }`}
            >
              Last {range} Days
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak */}
        <div className="bg-editorial-bg p-5 rounded-none border border-editorial-dark/15 flex items-center gap-4">
          <div className="p-3 rounded-none bg-editorial-orange-light text-editorial-orange border border-editorial-orange/20">
            <Flame className="animate-pulse" size={22} />
          </div>
          <div>
            <span className="block text-[10px] font-mono font-medium text-editorial-dark/50 uppercase tracking-widest">Current Streak</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-mono font-light text-editorial-dark leading-none">{stats.streak}</span>
              <span className="text-xs font-serif italic text-editorial-dark/60">days</span>
            </div>
          </div>
        </div>

        {/* Average logged */}
        <div className="bg-editorial-bg p-5 rounded-none border border-editorial-dark/15 flex items-center gap-4">
          <div className={`p-3 rounded-none ${colorStyles.lightBg} ${colorStyles.text} border border-editorial-dark/10`}>
            <TrendingUp size={22} />
          </div>
          <div>
            <span className="block text-[10px] font-mono font-medium text-editorial-dark/50 uppercase tracking-widest">Daily Avg</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-mono font-light text-editorial-dark leading-none">
                {selectedTracker.type === 'boolean'
                  ? `${Math.round(stats.average * 100)}%`
                  : stats.average}
              </span>
              {selectedTracker.unit && selectedTracker.type !== 'boolean' && (
                <span className="text-xs font-serif italic text-editorial-dark/60 ml-1">{selectedTracker.unit}</span>
              )}
            </div>
          </div>
        </div>

        {/* Best Recording */}
        <div className="bg-editorial-bg p-5 rounded-none border border-editorial-dark/15 flex items-center gap-4">
          <div className="p-3 rounded-none bg-editorial-amber-light text-editorial-amber border border-editorial-amber/20">
            <Award size={22} />
          </div>
          <div>
            <span className="block text-[10px] font-mono font-medium text-editorial-dark/50 uppercase tracking-widest">Peak Day</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-mono font-light text-editorial-dark leading-none">
                {selectedTracker.type === 'boolean' ? (stats.bestValue > 0 ? 'Yes' : 'No') : stats.bestValue}
              </span>
              <span className="text-[10px] font-mono text-editorial-dark/50 ml-1">
                ({stats.bestDate})
              </span>
            </div>
          </div>
        </div>

        {/* Goal completion rate */}
        <div className="bg-editorial-bg p-5 rounded-none border border-editorial-dark/15 flex items-center gap-4">
          <div className="p-3 rounded-none bg-editorial-emerald-light text-editorial-emerald border border-editorial-emerald/20">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <span className="block text-[10px] font-mono font-medium text-editorial-dark/50 uppercase tracking-widest">Goal Progress</span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-mono font-light text-editorial-dark leading-none">
                {selectedTracker.targetValue ? `${stats.completionRate}%` : `${stats.loggedDaysCount} Days`}
              </span>
              <span className="text-xs font-serif italic text-editorial-dark/60 ml-1">
                {selectedTracker.targetValue ? 'reached' : 'logged'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Chart Block */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Trend Chart */}
        <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 lg:col-span-2 flex flex-col h-[380px]">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="font-serif font-medium text-lg text-editorial-dark flex items-center gap-2">
                Daily Entries & Trend
                {selectedTracker.targetValue && (
                  <span className="inline-flex items-center text-[9px] font-mono text-editorial-accent bg-editorial-accent-light border border-editorial-accent/25 px-2 py-0.5 rounded-none">
                    Daily Goal Defined
                  </span>
                )}
              </h4>
              <p className="text-xs font-sans italic text-editorial-dark/60 mt-0.5">Visualizing logs across selected range</p>
            </div>
          </div>

          <div className="flex-1 min-h-0 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {selectedTracker.type === 'rating' ? (
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="var(--color-editorial-dark)" strokeOpacity={0.1} />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 9, fill: 'var(--color-editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[1, 2, 3, 4, 5]}
                    tick={{ fontSize: 9, fill: 'var(--color-editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-editorial-dark text-editorial-bg rounded-none p-4 shadow-md text-xs space-y-1 font-sans border border-editorial-accent/30">
                            <p className="font-mono text-[10px] text-editorial-bg/60">{data.date}</p>
                            <p className="font-serif text-sm font-medium">Rating: {data.value} / 5</p>
                            {data.notes && <p className="italic text-editorial-bg/75 border-t border-editorial-bg/15 pt-1.5 mt-1 max-w-[200px] text-[11px]">"{data.notes}"</p>}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" fill={hexColor} radius={0} maxBarSize={32} />
                </BarChart>
              ) : (
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={hexColor} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={hexColor} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="var(--color-editorial-dark)" strokeOpacity={0.1} />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fontSize: 9, fill: 'var(--color-editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 9, fill: 'var(--color-editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-editorial-dark text-editorial-bg rounded-none p-4 shadow-md text-xs space-y-1 font-sans border border-editorial-accent/30">
                            <p className="font-mono text-[10px] text-editorial-bg/60">{data.date}</p>
                            <p className="font-serif text-sm font-medium">
                              Value: {data.value} {selectedTracker.unit || ''}
                            </p>
                            {data.notes && <p className="italic text-editorial-bg/75 border-t border-editorial-bg/15 pt-1.5 mt-1 max-w-[200px] text-[11px]">"{data.notes}"</p>}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  {selectedTracker.targetValue && (
                    <ReferenceLine
                      y={selectedTracker.targetValue}
                      stroke="#a1824a"
                      strokeDasharray="3 3"
                      label={{
                        value: `Goal: ${selectedTracker.targetValue}`,
                        position: 'top',
                        fill: '#a1824a',
                        fontSize: 9,
                        fontFamily: 'monospace',
                        fontWeight: 'semibold',
                      }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke={hexColor}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorValue)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Notes Stream & Activity */}
        <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex flex-col h-[380px]">
          <h4 className="font-serif font-medium text-lg text-editorial-dark mb-1 flex items-center gap-2">
            Notes & Activity
            <span className="inline-flex h-2 w-2 rounded-full bg-editorial-accent animate-pulse" />
          </h4>
          <p className="text-xs font-sans italic text-editorial-dark/60 mb-4">Latest qualitative descriptions logged</p>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1 select-none">
            {notesStream.length > 0 ? (
              notesStream.map((log) => {
                const parts = log.date.split('-');
                const displayD = `${parts[1]}/${parts[2]}`;
                return (
                  <div key={log.id} className="flex gap-3 text-xs border-b border-editorial-dark/10 pb-3.5 last:border-b-0">
                    <div className="flex flex-col items-center">
                      <span className="font-mono text-[10px] text-editorial-accent bg-editorial-accent-light border border-editorial-accent/15 px-2 py-0.5 rounded-none leading-none">
                        {displayD}
                      </span>
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between items-baseline">
                        <span className="font-serif font-medium text-editorial-dark text-[13px]">
                          Logged: {log.value} {selectedTracker.unit || ''}
                        </span>
                        <span className="text-[9px] font-mono text-editorial-dark/40">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-editorial-dark bg-editorial-accent-light/10 border border-editorial-dark/5 p-3 italic font-sans rounded-none text-xs">
                        "{log.note}"
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-editorial-dark/50 space-y-3">
                <Info size={24} className="text-editorial-accent/50 stroke-[1.5px]" />
                <p className="text-xs font-serif font-medium">No Log Notes Yet</p>
                <p className="text-[11px] text-editorial-dark/60 max-w-[180px] leading-relaxed">
                  Add messages or comments when saving your tracker values!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
