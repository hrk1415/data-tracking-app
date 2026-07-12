/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Tracker, LogEntry, DailyReflection, COLOR_MAP } from '../types';
import { TrackerCard } from './TrackerCard';
import { 
  BookOpen, 
  Flag, 
  TrendingUp, 
  HelpCircle, 
  Sparkles,
  Trophy,
  ArrowRight,
  TrendingDown
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { motion } from 'motion/react';

interface DateComparisonDashboardViewProps {
  trackers: Tracker[];
  filteredTrackers: Tracker[];
  logs: LogEntry[];
  reflections: DailyReflection[];
  selectedDate: string;
  comparisonDate: string;
  formattedSelectedDate: string;
  formattedComparisonDate: string;
  dailyStats: {
    activeCount: number;
    withGoals: number;
    completedGoals: number;
    completionRate: number;
  };
  comparisonDailyStats: {
    activeCount: number;
    withGoals: number;
    completedGoals: number;
    completionRate: number;
  };
  comparisonChartData: Array<{
    name: string;
    valueA: number;
    valueB: number;
    unit: string;
  }>;
  onLogValue: (trackerId: string, value: number, note?: string) => void;
  onDeleteLog?: (logId: string) => void;
  onSaveGoalNote?: (date: string, trackerId: string, noteText: string) => void;
  onSaveMilestone?: (trackerId: string, date: string, milestoneText: string | undefined) => void;
}

export function DateComparisonDashboardView({
  trackers,
  filteredTrackers,
  logs,
  reflections,
  selectedDate,
  comparisonDate,
  formattedSelectedDate,
  formattedComparisonDate,
  dailyStats,
  comparisonDailyStats,
  comparisonChartData,
  onLogValue,
  onDeleteLog,
  onSaveGoalNote,
  onSaveMilestone
}: DateComparisonDashboardViewProps) {

  // Calculate high level comparisons
  const rateDiff = dailyStats.completionRate - comparisonDailyStats.completionRate;
  
  // Count logged variables on both days
  const loggedCountA = useMemo(() => {
    return new Set(logs.filter(l => l.date === selectedDate).map(l => l.trackerId)).size;
  }, [logs, selectedDate]);

  const loggedCountB = useMemo(() => {
    return new Set(logs.filter(l => l.date === comparisonDate).map(l => l.trackerId)).size;
  }, [logs, comparisonDate]);

  const logsDiff = loggedCountA - loggedCountB;

  // Render a custom Recharts Tooltip specifically styled for side-by-side comparison
  const CustomComparisonTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const unit = payload[0]?.payload?.unit || '';
      return (
        <div className="bg-editorial-dark text-editorial-bg border border-editorial-accent/20 p-3.5 shadow-xl rounded-none text-xs font-sans space-y-2 min-w-[200px]">
          <p className="font-mono text-[9px] text-editorial-bg/65 border-b border-editorial-bg/10 pb-1 mb-1 font-bold uppercase tracking-wider">
            {label}
          </p>
          <div className="flex items-center justify-between gap-4">
            <span className="text-editorial-bg/85 font-serif">{formattedSelectedDate} (A):</span>
            <span className="font-mono font-bold text-editorial-accent">
              {payload[0]?.value} {unit}
            </span>
          </div>
          {payload[1] && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-editorial-bg/85 font-serif">{formattedComparisonDate} (B):</span>
              <span className="font-mono font-bold text-editorial-amber">
                {payload[1]?.value} {unit}
              </span>
            </div>
          )}
          {payload[1] !== undefined && (
            <div className="border-t border-editorial-bg/10 pt-1.5 mt-1 text-[10px] font-mono flex items-center justify-between">
              <span className="text-editorial-bg/50">Variance (A - B):</span>
              <span className={`font-bold ${payload[0].value - payload[1].value >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {payload[0].value - payload[1].value > 0 ? '+' : ''}
                {Math.round((payload[0].value - payload[1].value) * 100) / 100} {unit}
              </span>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Editorial High-Level Delta Analytics Block */}
      <div className="bg-editorial-bg border border-editorial-dark/15 p-6 rounded-none space-y-4">
        <span className="block text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-widest">
          Comparative Analysis & Deltas
        </span>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Completion Rate Comparison */}
          <div className="border border-editorial-dark/10 p-4 bg-editorial-dark/[0.01] flex flex-col justify-between space-y-3">
            <div>
              <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45">Goal Completion Delta</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-mono font-bold text-editorial-dark">
                  {dailyStats.completionRate}%
                </span>
                <span className="text-xs text-editorial-dark/45 font-mono">vs</span>
                <span className="text-base font-mono text-editorial-dark/65">
                  {comparisonDailyStats.completionRate}%
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              {rateDiff > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 px-2 py-0.5 border border-emerald-500/15">
                  <TrendingUp size={11} />
                  <span>+{rateDiff}% Improvement</span>
                </span>
              ) : rateDiff < 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-rose-500/10 text-rose-700 px-2 py-0.5 border border-rose-500/15">
                  <TrendingDown size={11} />
                  <span>{rateDiff}% Regression</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-editorial-dark/5 text-editorial-dark/60 px-2 py-0.5 border border-editorial-dark/10">
                  <span>No Variance</span>
                </span>
              )}
            </div>
          </div>

          {/* Active Log Volume Comparison */}
          <div className="border border-editorial-dark/10 p-4 bg-editorial-dark/[0.01] flex flex-col justify-between space-y-3">
            <div>
              <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45">Logged Metrics Volume</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-mono font-bold text-editorial-dark">
                  {loggedCountA}
                </span>
                <span className="text-xs text-editorial-dark/45 font-mono">vs</span>
                <span className="text-base font-mono text-editorial-dark/65">
                  {loggedCountB}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5">
              {logsDiff > 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-700 px-2 py-0.5 border border-emerald-500/15">
                  <TrendingUp size={11} />
                  <span>+{logsDiff} more metrics tracked</span>
                </span>
              ) : logsDiff < 0 ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-rose-500/10 text-rose-700 px-2 py-0.5 border border-rose-500/15">
                  <TrendingDown size={11} />
                  <span>{Math.abs(logsDiff)} fewer metrics tracked</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-editorial-dark/5 text-editorial-dark/60 px-2 py-0.5 border border-editorial-dark/10">
                  <span>Identical engagement volume</span>
                </span>
              )}
            </div>
          </div>

          {/* Milestone Achievements Comparison */}
          <div className="border border-editorial-dark/10 p-4 bg-editorial-dark/[0.01] flex flex-col justify-between space-y-3">
            {(() => {
              const milestonesA = reflections.find(r => r.date === selectedDate)?.milestones?.length || 0;
              const milestonesB = reflections.find(r => r.date === comparisonDate)?.milestones?.length || 0;
              const msDiff = milestonesA - milestonesB;

              return (
                <>
                  <div>
                    <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45">Milestones Achieved</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-2xl font-mono font-bold text-editorial-amber">
                        {milestonesA}
                      </span>
                      <span className="text-xs text-editorial-dark/45 font-mono">vs</span>
                      <span className="text-base font-mono text-editorial-dark/65">
                        {milestonesB}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    {msDiff > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-500/10 text-amber-800 px-2 py-0.5 border border-amber-500/15">
                        <Trophy size={11} className="fill-amber-500/10" />
                        <span>+{msDiff} Achievements boost</span>
                      </span>
                    ) : msDiff < 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-editorial-dark/5 text-editorial-dark/50 px-2 py-0.5 border border-editorial-dark/10">
                        <span>Yesterday logged more peaks</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-editorial-dark/5 text-editorial-dark/60 px-2 py-0.5 border border-editorial-dark/10">
                        <span>Constant achievement rate</span>
                      </span>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Dynamic Side-by-Side Recharts Bar Chart */}
        {filteredTrackers.length > 0 && (
          <div className="pt-4 border-t border-editorial-dark/10 space-y-2">
            <h4 className="text-[10px] font-mono text-editorial-accent tracking-widest uppercase font-semibold flex items-center gap-1">
              <TrendingUp size={11} />
              Side-By-Side Visual Metric Levels
            </h4>
            
            <div className="h-60 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={comparisonChartData}
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
                    tick={{ fontSize: 9, fill: 'var(--editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                    axisLine={{ stroke: 'var(--editorial-dark)', strokeOpacity: 0.15 }}
                    tickLine={false}
                  />
                  <Tooltip content={<CustomComparisonTooltip />} cursor={{ fill: 'var(--editorial-dark)', opacity: 0.02 }} />
                  <Legend 
                    verticalAlign="top"
                    height={36}
                    iconType="rect"
                    iconSize={10}
                    wrapperStyle={{ fontSize: 10, fontFamily: 'monospace', textTransform: 'uppercase', opacity: 0.8 }}
                  />
                  <Bar 
                    name={`${formattedSelectedDate} (A)`}
                    dataKey="valueA" 
                    fill="var(--editorial-accent)" 
                    maxBarSize={24} 
                  />
                  <Bar 
                    name={`${formattedComparisonDate} (B)`}
                    dataKey="valueB" 
                    fill="#b38364" 
                    maxBarSize={24} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Dual Column Layout (Split Screen) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: SELECTED DATE (DATE A) */}
        {/* ========================================================= */}
        <div className="space-y-6">
          <div className="bg-editorial-accent text-editorial-bg px-4 py-3 font-serif font-semibold text-sm flex items-center justify-between shadow-xs">
            <span className="flex items-center gap-1.5">
              <Sparkles size={14} />
              <span>{formattedSelectedDate} (Date A)</span>
            </span>
            <span className="font-mono text-xs">{dailyStats.completionRate}% Habit Goals Met</span>
          </div>

          {/* Date A Habit Progress bar */}
          <div className="bg-editorial-bg p-5 border border-editorial-dark/15 space-y-3">
            <span className="block text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest">
              Daily Goal Checklist Progress
            </span>
            <div className="flex items-center justify-between text-xs font-mono font-semibold text-editorial-dark">
              <span>{dailyStats.completedGoals} of {dailyStats.withGoals} Met</span>
              <span>{dailyStats.completionRate}%</span>
            </div>
            <div className="h-2 w-full bg-editorial-dark/5 border border-editorial-dark/10 rounded-none overflow-hidden">
              <div className="h-full bg-editorial-accent" style={{ width: `${dailyStats.completionRate}%` }} />
            </div>
          </div>

          {/* Date A Reflection Card */}
          <div className="bg-editorial-bg p-5 border border-editorial-dark/15 space-y-3 min-h-[110px]">
            <span className="block text-[9px] font-mono text-editorial-accent uppercase tracking-widest flex items-center gap-1.5 font-bold">
              <BookOpen size={12} />
              Daily Reflection
            </span>
            {reflections.some(r => r.date === selectedDate) ? (
              <p className="text-xs font-serif italic text-editorial-dark leading-relaxed whitespace-pre-wrap pl-3.5 border-l-2 border-editorial-accent">
                "{reflections.find(r => r.date === selectedDate)?.text}"
              </p>
            ) : (
              <p className="text-xs font-sans text-editorial-dark/40 italic">No reflection entry recorded for Date A.</p>
            )}
          </div>

          {/* Date A Milestones Checklist */}
          <div className="bg-editorial-bg p-5 border border-editorial-dark/15 space-y-3 min-h-[110px]">
            <span className="block text-[9px] font-mono text-editorial-accent uppercase tracking-widest flex items-center gap-1.5 font-bold">
              <Flag size={12} />
              Timestamped Milestones
            </span>
            {reflections.find(r => r.date === selectedDate)?.milestones?.length ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {[...reflections.find(r => r.date === selectedDate)!.milestones!]
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((ms) => (
                    <div key={ms.id} className="text-xs font-sans text-editorial-dark/85 border-b border-editorial-dark/5 pb-1 flex items-start gap-2.5">
                      <span className="shrink-0 font-mono text-[9px] font-bold bg-editorial-accent/10 text-editorial-accent px-1.5 py-0.5 border border-editorial-accent/15 leading-none mt-0.5">
                        {ms.time}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-serif italic font-medium text-editorial-dark leading-tight">{ms.text}</span>
                        {ms.notes && <p className="text-[10px] text-editorial-dark/50 italic mt-0.5">{ms.notes}</p>}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs font-sans text-editorial-dark/40 italic">No timestamped milestones recorded for Date A.</p>
            )}
          </div>

          {/* Interactive Metric Cards for Date A */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-mono text-editorial-accent tracking-widest uppercase font-bold pl-0.5">Interactive Trackers (Date A)</h4>
            <div className="grid grid-cols-1 gap-5">
              {filteredTrackers.map((tracker) => {
                const dateReflection = reflections.find(r => r.date === selectedDate);
                const goalNote = dateReflection?.goalNotes?.[tracker.id] || '';
                return (
                  <TrackerCard
                    key={`comparison-A-${tracker.id}`}
                    tracker={tracker}
                    logs={logs}
                    selectedDate={selectedDate}
                    onLogValue={onLogValue}
                    onDeleteLog={onDeleteLog}
                    goalNote={goalNote}
                    onSaveGoalNote={onSaveGoalNote}
                    onSaveMilestone={onSaveMilestone}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: COMPARISON DATE (DATE B) */}
        {/* ========================================================= */}
        <div className="space-y-6">
          <div className="bg-editorial-dark text-editorial-bg px-4 py-3 font-serif font-semibold text-sm flex items-center justify-between shadow-xs">
            <span className="flex items-center gap-1.5">
              <Trophy size={14} className="text-editorial-amber" />
              <span>{formattedComparisonDate} (Date B)</span>
            </span>
            <span className="font-mono text-xs text-editorial-amber">{comparisonDailyStats.completionRate}% Habit Goals Met</span>
          </div>

          {/* Date B Habit Progress bar */}
          <div className="bg-editorial-bg p-5 border border-editorial-dark/15 space-y-3">
            <span className="block text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest">
              Daily Goal Checklist Progress
            </span>
            <div className="flex items-center justify-between text-xs font-mono font-semibold text-editorial-dark">
              <span>{comparisonDailyStats.completedGoals} of {comparisonDailyStats.withGoals} Met</span>
              <span>{comparisonDailyStats.completionRate}%</span>
            </div>
            <div className="h-2 w-full bg-editorial-dark/5 border border-editorial-dark/10 rounded-none overflow-hidden">
              <div className="h-full bg-editorial-amber" style={{ width: `${comparisonDailyStats.completionRate}%` }} />
            </div>
          </div>

          {/* Date B Reflection Card */}
          <div className="bg-editorial-bg p-5 border border-editorial-dark/15 space-y-3 min-h-[110px]">
            <span className="block text-[9px] font-mono text-editorial-amber uppercase tracking-widest flex items-center gap-1.5 font-bold">
              <BookOpen size={12} />
              Daily Reflection
            </span>
            {reflections.some(r => r.date === comparisonDate) ? (
              <p className="text-xs font-serif italic text-editorial-dark leading-relaxed whitespace-pre-wrap pl-3.5 border-l-2 border-editorial-amber">
                "{reflections.find(r => r.date === comparisonDate)?.text}"
              </p>
            ) : (
              <p className="text-xs font-sans text-editorial-dark/40 italic">No reflection entry recorded for Date B.</p>
            )}
          </div>

          {/* Date B Milestones Checklist */}
          <div className="bg-editorial-bg p-5 border border-editorial-dark/15 space-y-3 min-h-[110px]">
            <span className="block text-[9px] font-mono text-editorial-amber uppercase tracking-widest flex items-center gap-1.5 font-bold">
              <Flag size={12} />
              Timestamped Milestones
            </span>
            {reflections.find(r => r.date === comparisonDate)?.milestones?.length ? (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {[...reflections.find(r => r.date === comparisonDate)!.milestones!]
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map((ms) => (
                    <div key={ms.id} className="text-xs font-sans text-editorial-dark/85 border-b border-editorial-dark/5 pb-1 flex items-start gap-2.5">
                      <span className="shrink-0 font-mono text-[9px] font-bold bg-editorial-amber/10 text-editorial-amber px-1.5 py-0.5 border border-editorial-amber/15 leading-none mt-0.5">
                        {ms.time}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-serif italic font-medium text-editorial-dark leading-tight">{ms.text}</span>
                        {ms.notes && <p className="text-[10px] text-editorial-dark/50 italic mt-0.5">{ms.notes}</p>}
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-xs font-sans text-editorial-dark/40 italic">No timestamped milestones recorded for Date B.</p>
            )}
          </div>

          {/* Interactive Metric Cards for Date B */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-mono text-editorial-amber tracking-widest uppercase font-bold pl-0.5">Interactive Trackers (Date B)</h4>
            <div className="grid grid-cols-1 gap-5">
              {filteredTrackers.map((tracker) => {
                const dateReflection = reflections.find(r => r.date === comparisonDate);
                const goalNote = dateReflection?.goalNotes?.[tracker.id] || '';
                return (
                  <TrackerCard
                    key={`comparison-B-${tracker.id}`}
                    tracker={tracker}
                    logs={logs}
                    selectedDate={comparisonDate}
                    onLogValue={onLogValue}
                    onDeleteLog={onDeleteLog}
                    goalNote={goalNote}
                    onSaveGoalNote={onSaveGoalNote}
                    onSaveMilestone={onSaveMilestone}
                  />
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
