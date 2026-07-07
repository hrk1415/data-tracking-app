/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Tracker, LogEntry, COLOR_MAP } from '../types';
import { LucideIcon } from './LucideIcon';
import {
  TrendingUp,
  TrendingDown,
  Flame,
  Calendar,
  Award,
  CheckCircle2,
  ChevronDown,
  Info,
  Sparkles,
  Loader2,
  RefreshCw,
  Lightbulb,
  Activity,
  Table
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  Legend,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from 'recharts';

const colorHexes: Record<string, string> = {
  emerald: '#8fa89b', // Desaturated green
  blue: '#8da4c4',    // Desaturated blue
  indigo: '#9899c4',  // Desaturated indigo
  violet: '#a398c2',  // Desaturated violet
  amber: '#c7b38f',   // Desaturated gold/bronze
  rose: '#c9929d',    // Desaturated rose
  orange: '#cca08a',  // Desaturated orange
};

interface TrackerAnalyticsProps {
  trackers: Tracker[];
  logs: LogEntry[];
}

interface Insight {
  title: string;
  description: string;
  type: 'success' | 'warning' | 'info';
  trackerName: string;
}

type TimeMode = '7' | '30' | '90' | 'custom';

export function TrackerAnalytics({ trackers, logs }: TrackerAnalyticsProps) {
  const [analyticsView, setAnalyticsView] = useState<'individual' | 'weekly'>('individual');
  const [selectedTrackerId, setSelectedTrackerId] = useState<string>(
    trackers.length > 0 ? trackers[0].id : ''
  );
  const [timeMode, setTimeMode] = useState<TimeMode>('7');
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const counterTrackers = useMemo(() => trackers.filter(t => t.type === 'counter'), [trackers]);
  const numericTrackers = useMemo(() => trackers.filter(t => t.type === 'numeric'), [trackers]);
  const booleanTrackers = useMemo(() => trackers.filter(t => t.type === 'boolean'), [trackers]);
  const ratingTrackers = useMemo(() => trackers.filter(t => t.type === 'rating'), [trackers]);

  const [insights, setInsights] = useState<Insight[]>(() => {
    try {
      const cached = localStorage.getItem('tracker_ai_insights');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ trackers, logs }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }
      const data = await res.json();
      if (data && Array.isArray(data.insights)) {
        setInsights(data.insights);
        localStorage.setItem('tracker_ai_insights', JSON.stringify(data.insights));
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

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

  // Calculate past dates in YYYY-MM-DD format based on range or custom dates
  const dateRangeList = useMemo(() => {
    const list: string[] = [];

    if (timeMode !== 'custom') {
      const days = parseInt(timeMode);
      const today = new Date();

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        list.push(d.toISOString().split('T')[0]);
      }
    } else {
      if (!customStartDate || !customEndDate) return [];

      const start = new Date(customStartDate + 'T00:00:00');
      const end = new Date(customEndDate + 'T00:00:00');

      if (end < start) {
        return [];
      }

      const current = new Date(start);
      let safetyCounter = 0;
      while (current <= end && safetyCounter < 366) {
        list.push(current.toISOString().split('T')[0]);
        current.setDate(current.getDate() + 1);
        safetyCounter++;
      }
    }
    return list;
  }, [timeMode, customStartDate, customEndDate]);

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

  // 30-day stats calculations for each tracker
  const last30DaysStats = useMemo(() => {
    const list: string[] = [];
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      list.push(d.toISOString().split('T')[0]);
    }

    return trackers.map(tracker => {
      const trackerLogs = logs.filter(l => l.trackerId === tracker.id && list.includes(l.date));
      const dailyValues: number[] = [];
      
      list.forEach(dateStr => {
        const dayLogs = trackerLogs.filter(l => l.date === dateStr);
        if (dayLogs.length > 0) {
          if (tracker.type === 'counter') {
            const sum = dayLogs.reduce((acc, log) => acc + log.value, 0);
            dailyValues.push(sum);
          } else {
            dailyValues.push(dayLogs[dayLogs.length - 1].value);
          }
        }
      });

      let mean = 0;
      let min = 0;
      let max = 0;
      const count = dailyValues.length;

      if (count > 0) {
        const sum = dailyValues.reduce((acc, v) => acc + v, 0);
        mean = Math.round((sum / count) * 10) / 10;
        min = Math.min(...dailyValues);
        max = Math.max(...dailyValues);
      }

      return {
        tracker,
        mean,
        min,
        max,
        loggedDays: count,
        hasData: count > 0,
      };
    });
  }, [trackers, logs]);

  // Weekly Summary comparison calculations (past 7 days vs previous 7 days)
  const weeklySummaryStats = useMemo(() => {
    const today = new Date();
    
    // Get past 7 days (including today)
    const last7Days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      last7Days.push(d.toISOString().split('T')[0]);
    }

    // Get previous 7 days (days 8-14)
    const prev7Days: string[] = [];
    for (let i = 7; i < 14; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      prev7Days.push(d.toISOString().split('T')[0]);
    }

    // Filter logs in last 7 days and prev 7 days
    const last7Logs = logs.filter(l => last7Days.includes(l.date));
    const prev7Logs = logs.filter(l => prev7Days.includes(l.date));

    const last7Count = last7Logs.length;
    const prev7Count = prev7Logs.length;

    const diff = last7Count - prev7Count;
    let percentChange = 0;
    if (prev7Count > 0) {
      percentChange = Math.round((diff / prev7Count) * 100);
    } else if (last7Count > 0) {
      percentChange = 100;
    }

    // Group tracker breakdowns for last 7 vs prev 7 days
    const trackerBreakdown = trackers.map(tracker => {
      const tLast7 = last7Logs.filter(l => l.trackerId === tracker.id).length;
      const tPrev7 = prev7Logs.filter(l => l.trackerId === tracker.id).length;
      const tDiff = tLast7 - tPrev7;
      return {
        tracker,
        last7: tLast7,
        prev7: tPrev7,
        diff: tDiff
      };
    });

    return {
      last7Count,
      prev7Count,
      diff,
      percentChange,
      trackerBreakdown
    };
  }, [trackers, logs]);

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

  // Calculate 7-day data for all trackers to use in "Weekly Trends" view
  const last7DaysData = useMemo(() => {
    const list: string[] = [];
    const today = new Date();
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      list.push(d.toISOString().split('T')[0]);
    }

    return list.map(dateStr => {
      const parts = dateStr.split('-');
      const mIndex = parseInt(parts[1]) - 1;
      const displayDate = `${monthNames[mIndex]} ${parts[2]}`;

      const dataPoint: any = {
        date: dateStr,
        displayDate,
      };

      trackers.forEach(tracker => {
        const dayLogs = logs.filter(l => l.trackerId === tracker.id && l.date === dateStr);
        let val = 0;
        if (tracker.type === 'counter') {
          val = dayLogs.reduce((sum, log) => sum + log.value, 0);
        } else if (dayLogs.length > 0) {
          val = dayLogs[dayLogs.length - 1].value;
        }
        dataPoint[tracker.id] = val;
      });

      return dataPoint;
    });
  }, [trackers, logs]);

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

  const renderTypeTrendChart = (
    title: string,
    description: string,
    typeTrackers: Tracker[],
    yDomain?: any,
    yTicks?: number[],
    isBoolean?: boolean
  ) => {
    if (typeTrackers.length === 0) {
      return (
        <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex flex-col h-[380px]">
          <div className="mb-4">
            <h4 className="font-serif font-medium text-base text-editorial-dark">{title}</h4>
            <p className="text-[11px] font-sans italic text-editorial-dark/50 mt-0.5">{description}</p>
          </div>
          <div className="flex-1 border border-dashed border-editorial-dark/20 flex flex-col items-center justify-center text-center p-6 bg-editorial-bg/30">
            <Info size={20} className="text-editorial-accent/50 stroke-[1.5px] mb-2" />
            <p className="text-xs font-serif font-medium text-editorial-dark/80">No Trackers Available</p>
            <p className="text-[10px] text-editorial-dark/55 max-w-[200px] leading-relaxed mt-1">
              Add a metric with this tracker type to visualize its 7-day progress!
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex flex-col h-[380px]">
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0 flex-1 pr-2">
            <h4 className="font-serif font-medium text-base text-editorial-dark truncate">{title}</h4>
            <p className="text-[11px] font-sans italic text-editorial-dark/50 mt-0.5 truncate">{description}</p>
          </div>
          <span className="text-[9px] font-mono font-medium text-editorial-accent bg-editorial-accent-light border border-editorial-accent/20 px-2 py-0.5 shrink-0">
            {typeTrackers.length} active
          </span>
        </div>

        <div className="flex-1 min-h-0 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last7DaysData} margin={{ top: 10, right: 15, left: -25, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="var(--color-editorial-dark)" strokeOpacity={0.1} />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 9, fill: 'var(--color-editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={yDomain || ['auto', 'auto']}
                ticks={yTicks}
                tick={{ fontSize: 9, fill: 'var(--color-editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                tickFormatter={isBoolean ? (v) => (v === 1 ? 'Yes' : v === 0 ? 'No' : '') : undefined}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-editorial-dark text-editorial-bg rounded-none p-4 shadow-md text-xs space-y-2 font-sans border border-editorial-accent/30 min-w-[180px]">
                        <p className="font-mono text-[10px] text-editorial-bg/60 border-b border-editorial-bg/15 pb-1 mb-1">{label}</p>
                        <div className="space-y-1.5">
                          {payload.map((p: any) => {
                            const tracker = typeTrackers.find(t => t.id === p.dataKey);
                            if (!tracker) return null;
                            const valText = isBoolean 
                              ? (p.value === 1 ? 'Yes' : 'No') 
                              : `${p.value} ${tracker.unit || ''}`;
                            return (
                              <div key={p.dataKey} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="w-2 h-2 shrink-0 animate-pulse" style={{ backgroundColor: p.stroke }} />
                                  <span className="truncate text-editorial-bg/90">{p.name}</span>
                                </div>
                                <span className="font-mono font-semibold text-editorial-accent">
                                  {valText}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={36}
                iconSize={8}
                iconType="circle"
                wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', opacity: 0.75, paddingTop: 10 }}
              />
              {typeTrackers.map(tracker => (
                <Line
                  key={tracker.id}
                  type="monotone"
                  dataKey={tracker.id}
                  name={tracker.name}
                  stroke={colorHexes[tracker.color] || '#8fa89b'}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const hexColor = colorHexes[activeColor] || '#c7b38f';

  return (
    <div className="space-y-6">
      {/* Analytics View Selector Tabs */}
      <div className="flex border-b border-editorial-dark/15 pb-px">
        <button
          type="button"
          id="tab-individual-view"
          onClick={() => setAnalyticsView('individual')}
          className={`px-5 py-2.5 border-b-2 font-serif text-sm font-medium transition-all cursor-pointer ${
            analyticsView === 'individual'
              ? 'border-editorial-accent text-editorial-accent'
              : 'border-transparent text-editorial-dark/60 hover:text-editorial-dark hover:border-editorial-dark/10'
          }`}
        >
          Individual Metrics
        </button>
        <button
          type="button"
          id="tab-weekly-view"
          onClick={() => setAnalyticsView('weekly')}
          className={`px-5 py-2.5 border-b-2 font-serif text-sm font-medium transition-all cursor-pointer ${
            analyticsView === 'weekly'
              ? 'border-editorial-accent text-editorial-accent'
              : 'border-transparent text-editorial-dark/60 hover:text-editorial-dark hover:border-editorial-dark/10'
          }`}
        >
          Weekly Trends (7D)
        </button>
      </div>

      {analyticsView === 'individual' ? (
        <>
          {/* AI Insights Section */}
      <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-editorial-dark/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-editorial-accent-light border border-editorial-accent/20 text-editorial-accent">
              <Sparkles size={20} className="stroke-[1.5px]" />
            </div>
            <div>
              <h3 className="font-serif font-medium text-lg text-editorial-dark">
                Gemini Performance Insights
              </h3>
              <p className="text-xs font-sans italic text-editorial-dark/60 mt-0.5">
                AI-powered analysis of your historical log patterns and progress
              </p>
            </div>
          </div>
          <div>
            <button
              onClick={generateInsights}
              disabled={loading}
              className="inline-flex items-center gap-2 bg-editorial-accent hover:bg-editorial-accent/90 disabled:bg-editorial-dark/10 disabled:text-editorial-dark/40 border border-editorial-accent/20 text-editorial-bg px-4 py-2 text-xs font-mono font-medium transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Analyzing Logs...</span>
                </>
              ) : insights.length > 0 ? (
                <>
                  <RefreshCw size={14} />
                  <span>Refresh Analysis</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Generate AI Insights</span>
                </>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
            <Loader2 size={36} className="text-editorial-accent animate-spin stroke-[1.5px]" />
            <div className="space-y-1.5 max-w-md">
              <p className="text-sm font-serif font-medium text-editorial-dark">Analyzing historical metrics...</p>
              <p className="text-xs font-sans italic text-editorial-dark/50 animate-pulse">
                Gemini is examining weekday-weekend shifts and correlating your logs to uncover hidden trends
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200/50 text-red-700 text-xs font-mono flex items-center gap-3">
            <Info size={16} className="text-red-600 animate-pulse" />
            <div className="flex-1">
              <p className="font-bold">Failed to analyze data</p>
              <p className="text-red-600/80 mt-0.5">{error}</p>
            </div>
            <button
              onClick={generateInsights}
              className="underline hover:text-red-900 cursor-pointer text-xs font-mono"
            >
              Retry
            </button>
          </div>
        ) : insights.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((insight, idx) => {
              const borderColors = {
                success: 'border-l-4 border-l-emerald-600 bg-emerald-500/5 border-editorial-dark/15',
                warning: 'border-l-4 border-l-amber-600 bg-amber-500/5 border-editorial-dark/15',
                info: 'border-l-4 border-l-indigo-600 bg-indigo-500/5 border-editorial-dark/15',
              };

              const iconTags = {
                success: <CheckCircle2 size={14} className="text-emerald-700 shrink-0" />,
                warning: <Info size={14} className="text-amber-700 shrink-0" />,
                info: <Info size={14} className="text-indigo-700 shrink-0" />,
              };

              const badgeColors = {
                success: 'bg-emerald-500/10 text-emerald-800 border-emerald-500/20',
                warning: 'bg-amber-500/10 text-amber-800 border-amber-500/20',
                info: 'bg-indigo-500/10 text-indigo-800 border-indigo-500/20',
              };

              return (
                <div
                  key={idx}
                  className={`p-5 flex flex-col justify-between border rounded-none transition-all hover:border-editorial-dark/30 ${
                    borderColors[insight.type] || borderColors.info
                  }`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[9px] font-mono font-medium text-editorial-dark/45 uppercase tracking-widest truncate">
                        {insight.trackerName}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[9px] font-mono font-medium px-2 py-0.5 border ${
                          badgeColors[insight.type] || badgeColors.info
                        }`}
                      >
                        {iconTags[insight.type]}
                        <span className="capitalize">{insight.type}</span>
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      <h4 className="font-serif font-medium text-[15px] text-editorial-dark leading-snug">
                        {insight.title}
                      </h4>
                      <p className="text-xs text-editorial-dark/75 leading-relaxed font-sans">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-8 border border-dashed border-editorial-dark/20 text-center flex flex-col items-center justify-center space-y-3 bg-editorial-bg/30">
            <Lightbulb size={24} className="text-editorial-accent/60 stroke-[1.5px]" />
            <div className="max-w-md">
              <p className="text-sm font-serif font-medium text-editorial-dark">Ready for Deep AI Analysis</p>
              <p className="text-xs text-editorial-dark/55 mt-1 leading-relaxed">
                Click the button above to let Gemini analyze your tracker settings and historical entries. We will search for correlations, streaks, and identify actionable improvements.
              </p>
            </div>
            <button
              onClick={generateInsights}
              className="mt-2 border border-editorial-dark/25 hover:border-editorial-accent text-editorial-dark hover:text-editorial-accent px-4 py-1.5 text-xs font-mono font-medium transition-all cursor-pointer bg-editorial-bg"
            >
              Analyze with Gemini
            </button>
          </div>
        )}
      </div>

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

        {/* Timeframe Range Picker */}
        <div className="flex flex-col gap-2.5 sm:items-end">
          <span className="text-[10px] font-mono font-medium text-editorial-dark/50 uppercase tracking-widest">Time Period</span>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex rounded-none bg-editorial-dark/5 p-1 border border-editorial-dark/10">
              {(['7', '30', '90'] as const).map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeMode(range)}
                  className={`rounded-none px-3.5 py-1.5 text-xs font-mono font-medium transition-all cursor-pointer ${
                    timeMode === range
                      ? 'bg-editorial-accent text-editorial-bg'
                      : 'text-editorial-dark/60 hover:text-editorial-dark'
                  }`}
                >
                  {range}D
                </button>
              ))}
              <button
                type="button"
                onClick={() => setTimeMode('custom')}
                className={`rounded-none px-3.5 py-1.5 text-xs font-mono font-medium transition-all cursor-pointer ${
                  timeMode === 'custom'
                    ? 'bg-editorial-accent text-editorial-bg'
                    : 'text-editorial-dark/60 hover:text-editorial-dark'
                }`}
              >
                Custom
              </button>
            </div>

            {/* Custom inputs */}
            {timeMode === 'custom' && (
              <div className="flex items-center gap-2 border border-editorial-dark/15 bg-editorial-bg/50 p-1">
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[9px] font-mono font-medium text-editorial-dark/40 uppercase">From</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    max={customEndDate || undefined}
                    className="rounded-none border border-editorial-dark/15 bg-editorial-bg px-2 py-0.5 text-xs font-mono text-editorial-dark focus:border-editorial-accent focus:outline-hidden"
                  />
                </div>
                <span className="text-editorial-dark/30 text-[10px] font-mono">—</span>
                <div className="flex items-center gap-1.5 px-1">
                  <span className="text-[9px] font-mono font-medium text-editorial-dark/40 uppercase">To</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    min={customStartDate || undefined}
                    max={new Date().toISOString().split('T')[0]}
                    className="rounded-none border border-editorial-dark/15 bg-editorial-bg px-2 py-0.5 text-xs font-mono text-editorial-dark focus:border-editorial-accent focus:outline-hidden"
                  />
                </div>
              </div>
            )}
          </div>
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
        </>
      ) : (
        /* Weekly Trends Grid View */
        <div className="space-y-6">
          <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-editorial-accent-light border border-editorial-accent/20 text-editorial-accent">
                <Activity size={20} className="stroke-[1.5px]" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-lg text-editorial-dark">
                  Weekly Trends (7-Day Progress)
                </h3>
                <p className="text-xs font-sans italic text-editorial-dark/60 mt-0.5">
                  Compare multi-tracker progress side-by-side grouped by metric type
                </p>
              </div>
            </div>
          </div>

          {/* Weekly Summary Card */}
          <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Overall Volume Metric Column */}
            <div className="md:col-span-1 flex flex-col justify-between border-b md:border-b-0 md:border-r border-editorial-dark/10 pb-6 md:pb-0 md:pr-6 space-y-4">
              <div>
                <span className="inline-flex items-center text-[10px] font-mono font-medium text-editorial-accent bg-editorial-accent-light border border-editorial-accent/25 px-2 py-0.5 rounded-none uppercase tracking-wider mb-2">
                  7-Day Aggregated Volume
                </span>
                <h4 className="font-serif font-medium text-xl text-editorial-dark leading-tight">
                  Log Entry Activity
                </h4>
                <p className="text-xs font-sans italic text-editorial-dark/60 mt-1">
                  Comparing all logged tracker entries over the past two weeks
                </p>
              </div>

              <div className="py-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-mono font-light text-editorial-dark leading-none">
                    {weeklySummaryStats.last7Count}
                  </span>
                  <span className="text-xs font-serif italic text-editorial-dark/60">entries</span>
                </div>
                
                <div className="flex items-center gap-2 mt-3.5">
                  {weeklySummaryStats.diff > 0 ? (
                    <div className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-xs font-mono px-2 py-0.5">
                      <TrendingUp size={14} className="stroke-[2px]" />
                      <span>+{weeklySummaryStats.percentChange}%</span>
                    </div>
                  ) : weeklySummaryStats.diff < 0 ? (
                    <div className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-800 text-xs font-mono px-2 py-0.5">
                      <TrendingDown size={14} className="stroke-[2px]" />
                      <span>{weeklySummaryStats.percentChange}%</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-1 bg-editorial-dark/5 border border-editorial-dark/10 text-editorial-dark/60 text-xs font-mono px-2 py-0.5">
                      <span>0% change</span>
                    </div>
                  )}
                  <span className="text-[11px] text-editorial-dark/55 font-sans">
                    vs. {weeklySummaryStats.prev7Count} in previous 7D
                  </span>
                </div>
              </div>

              <div className="text-[10px] font-mono text-editorial-dark/50 pt-2 border-t border-editorial-dark/5">
                Activity volume signals logging consistency and momentum.
              </div>
            </div>

            {/* Tracker-by-tracker Breakdown Column */}
            <div className="md:col-span-2 space-y-4">
              <div>
                <h5 className="font-serif font-medium text-sm text-editorial-dark">
                  Log Volume Breakdown by Tracker
                </h5>
                <p className="text-xs font-sans italic text-editorial-dark/60 mt-0.5">
                  Log frequency per tracker (last 7 days vs previous 7 days)
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                {weeklySummaryStats.trackerBreakdown.map(({ tracker, last7, prev7, diff }) => {
                  const colorStyles = COLOR_MAP[tracker.color] || COLOR_MAP.emerald;
                  return (
                    <div key={tracker.id} className="p-3 bg-editorial-accent-light/10 border border-editorial-dark/10 flex items-center justify-between gap-3 hover:bg-editorial-accent-light/25 transition-all">
                      <div className="flex items-center gap-2.5 truncate">
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-none text-white ${colorStyles.bg} border border-editorial-dark/10`}>
                          <LucideIcon name={tracker.icon} size={13} />
                        </div>
                        <div className="truncate">
                          <span className="font-serif font-medium text-xs text-editorial-dark block truncate leading-tight font-medium">
                            {tracker.name}
                          </span>
                          <span className="text-[8px] font-mono text-editorial-dark/40 uppercase tracking-wider block mt-0.5">
                            {tracker.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right font-mono">
                          <div className="text-xs font-medium text-editorial-dark">
                            {last7} <span className="text-[10px] text-editorial-dark/40">/ 7d</span>
                          </div>
                          <div className="text-[9px] text-editorial-dark/40">
                            {prev7} prev
                          </div>
                        </div>

                        <div className="w-12 text-right shrink-0">
                          {diff > 0 ? (
                            <span className="text-[10px] font-mono font-medium text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5">
                              +{diff}
                            </span>
                          ) : diff < 0 ? (
                            <span className="text-[10px] font-mono font-medium text-rose-700 bg-rose-500/10 border border-rose-500/20 px-1.5 py-0.5">
                              {diff}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-editorial-dark/45 bg-editorial-dark/5 border border-editorial-dark/10 px-1.5 py-0.5">
                              0
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {renderTypeTrendChart(
              'Counters & Tallies',
              'Sum of daily logged entries (e.g. water, reps)',
              counterTrackers
            )}
            {renderTypeTrendChart(
              'Numeric Metrics',
              'Last logged daily numerical value (e.g. weight, sleep hours)',
              numericTrackers
            )}
            {renderTypeTrendChart(
              'Habits & Booleans',
              'Daily completion status (Yes/No status)',
              booleanTrackers,
              [0, 1],
              [0, 1],
              true
            )}
            {renderTypeTrendChart(
              'Ratings & Quality',
              'Subjective daily rating scale (1-5 quality metric)',
              ratingTrackers,
              [1, 5],
              [1, 2, 3, 4, 5]
            )}
          </div>
        </div>
      )}

      {/* 30-Day Tracker Statistics Summary */}
      <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-6">
        <div className="flex items-center gap-2.5 border-b border-editorial-dark/10 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-editorial-accent-light border border-editorial-accent/20 text-editorial-accent">
            <Table size={20} className="stroke-[1.5px]" />
          </div>
          <div>
            <h3 className="font-serif font-medium text-lg text-editorial-dark">
              30-Day Tracker Statistics Summary
            </h3>
            <p className="text-xs font-sans italic text-editorial-dark/60 mt-0.5">
              Tabular breakdown of mean, minimum, and maximum values over the last 30 days
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-editorial-dark/10">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-editorial-dark/15 bg-editorial-accent-light/40 text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-wider">
                <th className="px-5 py-3">Tracker</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3 text-right">30D Mean</th>
                <th className="px-5 py-3 text-right">30D Min</th>
                <th className="px-5 py-3 text-right">30D Max</th>
                <th className="px-5 py-3 text-right">Days Logged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-editorial-dark/10 text-xs">
              {last30DaysStats.map(({ tracker, mean, min, max, loggedDays, hasData }) => {
                const colorStyles = COLOR_MAP[tracker.color] || COLOR_MAP.emerald;
                
                const formatVal = (val: number, isMinMax?: boolean) => {
                  if (tracker.type === 'boolean') {
                    if (isMinMax) {
                      return val === 1 ? 'Yes' : 'No';
                    }
                    return `${Math.round(val * 100)}% Yes`;
                  }
                  if (tracker.type === 'rating') {
                    return `${val} / 5`;
                  }
                  return `${val}${tracker.unit ? ` ${tracker.unit}` : ''}`;
                };

                return (
                  <tr key={tracker.id} className="hover:bg-editorial-accent-light/20 transition-colors">
                    {/* Tracker details */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-none text-white ${colorStyles.bg} border border-editorial-dark/10`}>
                          <LucideIcon name={tracker.icon} size={15} />
                        </div>
                        <div>
                          <span className="font-serif font-medium text-editorial-dark block leading-tight">
                            {tracker.name}
                          </span>
                          <span className="text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest mt-0.5 block">
                            {tracker.category}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Tracker Type */}
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center text-[10px] font-mono text-editorial-dark/60 bg-editorial-dark/5 border border-editorial-dark/10 px-2 py-0.5 capitalize font-medium">
                        {tracker.type}
                      </span>
                    </td>

                    {/* Mean */}
                    <td className="px-5 py-3.5 text-right font-mono text-editorial-dark font-medium">
                      {hasData ? formatVal(mean) : <span className="text-editorial-dark/35 font-sans">—</span>}
                    </td>

                    {/* Min */}
                    <td className="px-5 py-3.5 text-right font-mono text-editorial-dark">
                      {hasData ? formatVal(min, true) : <span className="text-editorial-dark/35 font-sans">—</span>}
                    </td>

                    {/* Max */}
                    <td className="px-5 py-3.5 text-right font-mono text-editorial-dark">
                      {hasData ? formatVal(max, true) : <span className="text-editorial-dark/35 font-sans">—</span>}
                    </td>

                    {/* Completion rate / Days Logged */}
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex flex-col items-end">
                        <span className="font-mono text-editorial-dark font-medium">
                          {loggedDays} / 30
                        </span>
                        <span className="text-[9px] font-sans italic text-editorial-dark/50">
                          ({Math.round((loggedDays / 30) * 100)}%)
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
