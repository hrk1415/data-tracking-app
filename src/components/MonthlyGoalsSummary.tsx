/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Tracker, LogEntry, COLOR_MAP } from '../types';
import { LucideIcon } from './LucideIcon';
import { motion } from 'motion/react';
import { 
  Calendar, 
  Trophy, 
  TrendingUp, 
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Target,
  Award,
  Sparkles
} from 'lucide-react';

interface MonthlyGoalsSummaryProps {
  trackers: Tracker[];
  logs: LogEntry[];
  selectedDate: string;
  onSelectDate?: (date: string) => void;
}

function safeFormatDate(dateInput: Date | string | null | undefined, options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
  if (!dateInput) return '—';
  let d: Date;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else {
    if (dateInput.includes('-')) {
      const parts = dateInput.split('T')[0].split('-');
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const dVal = parseInt(parts[2], 10);
      if (!isNaN(y) && !isNaN(m) && !isNaN(dVal)) {
        d = new Date(y, m, dVal, 12, 0, 0);
      } else {
        d = new Date(dateInput);
      }
    } else {
      d = new Date(dateInput);
    }
  }

  if (isNaN(d.getTime())) {
    return '—';
  }
  try {
    return d.toLocaleDateString(undefined, options);
  } catch (e) {
    return '—';
  }
}

export function MonthlyGoalsSummary({
  trackers,
  logs,
  selectedDate,
  onSelectDate
}: MonthlyGoalsSummaryProps) {
  // Parse year and month from the active selectedDate (YYYY-MM-DD)
  const dateParts = useMemo(() => {
    if (!selectedDate || !selectedDate.includes('-')) return { year: 2026, month: 7, day: 1 };
    const parts = selectedDate.split('-');
    if (parts.length < 3) return { year: 2026, month: 7, day: 1 };
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    return {
      year: isNaN(y) ? 2026 : y,
      month: isNaN(m) ? 7 : m,
      day: isNaN(d) ? 1 : d
    };
  }, [selectedDate]);

  const { year, month } = dateParts;

  // Total days in the month
  const totalDays = useMemo(() => {
    const d = new Date(year, month, 0);
    return isNaN(d.getTime()) ? 31 : d.getDate();
  }, [year, month]);

  // Generate list of all YYYY-MM-DD date strings for the active month
  const datesInMonth = useMemo(() => {
    const dates: string[] = [];
    for (let d = 1; d <= totalDays; d++) {
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return dates;
  }, [year, month, totalDays]);

  // Filter logs to only those within the active month
  const monthLogs = useMemo(() => {
    const prefix = `${year}-${String(month).padStart(2, '0')}-`;
    return logs.filter(l => l.date.startsWith(prefix));
  }, [logs, year, month]);

  // Calculate daily target satisfaction across the active month
  const dailyStats = useMemo(() => {
    return datesInMonth.map(dStr => {
      let completedGoals = 0;
      let trackersWithGoals = 0;

      trackers.forEach(t => {
        if (t.targetValue) {
          trackersWithGoals++;
          const tLogs = monthLogs.filter(l => l.trackerId === t.id && l.date === dStr);
          const totalVal = t.type === 'counter'
            ? tLogs.reduce((sum, l) => sum + l.value, 0)
            : (tLogs.length > 0 ? tLogs[tLogs.length - 1].value : 0);

          if (totalVal >= t.targetValue) {
            completedGoals++;
          }
        }
      });

      const rate = trackersWithGoals > 0 ? Math.round((completedGoals / trackersWithGoals) * 100) : 0;

      return {
        date: dStr,
        dayNum: parseInt(dStr.split('-')[2], 10),
        completed: completedGoals,
        total: trackersWithGoals,
        rate
      };
    });
  }, [trackers, monthLogs, datesInMonth]);

  // Aggregate stats for the month
  const monthlyMetrics = useMemo(() => {
    let grandTotalCompletedGoals = 0;
    let grandTotalExpectedGoals = 0;
    let perfectDaysCount = 0;
    let loggedDaysCount = 0;

    dailyStats.forEach(day => {
      grandTotalCompletedGoals += day.completed;
      grandTotalExpectedGoals += day.total;
      
      if (day.total > 0) {
        if (day.completed === day.total) {
          perfectDaysCount++;
        }
        
        // Count as a logged day if at least one tracker log exists for that day in this month
        const hasLogs = monthLogs.some(l => l.date === day.date);
        if (hasLogs) {
          loggedDaysCount++;
        }
      }
    });

    const averageAchievementRate = grandTotalExpectedGoals > 0 
      ? Math.round((grandTotalCompletedGoals / grandTotalExpectedGoals) * 100) 
      : 0;

    // Calculate longest perfect days streak in this month
    let maxStreak = 0;
    let currentStreak = 0;
    dailyStats.forEach(day => {
      if (day.total > 0 && day.completed === day.total) {
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    });

    return {
      totalCompletedGoals: grandTotalCompletedGoals,
      totalExpectedGoals: grandTotalExpectedGoals,
      perfectDaysCount,
      loggedDaysCount,
      averageAchievementRate,
      perfectDaysStreak: maxStreak
    };
  }, [dailyStats, monthLogs]);

  // Tracker-by-tracker progress in this month
  const trackersBreakdown = useMemo(() => {
    return trackers
      .filter(t => t.targetValue)
      .map(t => {
        let daysCompleted = 0;
        let totalLoggedValue = 0;
        let logEntriesCount = 0;

        datesInMonth.forEach(dStr => {
          const tLogs = monthLogs.filter(l => l.trackerId === t.id && l.date === dStr);
          logEntriesCount += tLogs.length;

          const dayTotal = t.type === 'counter'
            ? tLogs.reduce((sum, l) => sum + l.value, 0)
            : (tLogs.length > 0 ? tLogs[tLogs.length - 1].value : 0);

          totalLoggedValue += dayTotal;

          if (t.targetValue && dayTotal >= t.targetValue) {
            daysCompleted++;
          }
        });

        const successRate = Math.round((daysCompleted / totalDays) * 100);

        return {
          id: t.id,
          name: t.name,
          color: t.color,
          icon: t.icon,
          targetValue: t.targetValue!,
          unit: t.unit || '',
          daysCompleted,
          totalDays,
          successRate,
          averageValue: logEntriesCount > 0 ? (totalLoggedValue / totalDays).toFixed(1) : '0'
        };
      })
      .sort((a, b) => b.successRate - a.successRate); // Sort by success rate descending
  }, [trackers, monthLogs, datesInMonth, totalDays]);

  // Month labels and navigation helpers
  const monthName = useMemo(() => {
    const d = new Date(year, month - 1, 1);
    if (isNaN(d.getTime())) return 'July 2026';
    try {
      return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch (e) {
      return 'July 2026';
    }
  }, [year, month]);

  const handlePrevMonth = () => {
    if (!onSelectDate) return;
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth < 1) {
      prevMonth = 12;
      prevYear--;
    }
    onSelectDate(`${prevYear}-${String(prevMonth).padStart(2, '0')}-01`);
  };

  const handleNextMonth = () => {
    if (!onSelectDate) return;
    let nextYear = year;
    let nextMonth = month + 1;
    if (nextMonth > 12) {
      nextMonth = 1;
      nextYear++;
    }
    onSelectDate(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01`);
  };

  // Build calendar matrix (padded by week day names)
  const calendarCells = useMemo(() => {
    const cells = [];
    const d = new Date(year, month - 1, 1);
    const firstDayIndex = isNaN(d.getTime()) ? 0 : d.getDay(); // 0 is Sunday, 1 is Monday

    // Padding cells before the 1st
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ isPadding: true, key: `pad-${i}` });
    }

    // Actual day cells
    dailyStats.forEach(day => {
      cells.push({
        isPadding: false,
        key: day.date,
        ...day
      });
    });

    return cells;
  }, [year, month, dailyStats]);

  // Return early if there are no trackers with goals defined
  const trackersWithGoalsCount = trackers.filter(t => t.targetValue).length;
  if (trackersWithGoalsCount === 0) {
    return null;
  }

  return (
    <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-6">
      {/* Header section with Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-editorial-dark/10 pb-4 gap-4">
        <div>
          <span className="block text-[10px] font-mono font-medium text-editorial-accent uppercase tracking-widest">
            Performance Architecture
          </span>
          <h3 className="font-serif font-medium text-lg text-editorial-dark mt-0.5 flex items-center gap-2">
            <Calendar size={18} className="text-editorial-accent" />
            <span>Monthly Goals Summary</span>
          </h3>
          <p className="text-[10px] font-sans italic text-editorial-dark/60 mt-0.5">
            Holistic target completion overview and monthly baseline achievement
          </p>
        </div>

        {/* Month Selector Buttons */}
        {onSelectDate && (
          <div className="flex items-center gap-1 self-start sm:self-auto border border-editorial-dark/15 p-1 bg-editorial-bg">
            <button
              type="button"
              onClick={handlePrevMonth}
              title="Previous Month"
              className="p-1 hover:bg-editorial-dark/5 text-editorial-dark transition-all cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-mono font-bold uppercase tracking-wider px-2 text-editorial-dark">
              {monthName}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              title="Next Month"
              className="p-1 hover:bg-editorial-dark/5 text-editorial-dark transition-all cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Aggregate Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric: Average Achievement */}
        <div className="border border-editorial-dark/10 p-4 bg-editorial-dark/[0.01] flex flex-col justify-between space-y-3">
          <div>
            <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45">Monthly Achievement</span>
            <span className="font-mono text-3xl font-light text-editorial-dark mt-1 block leading-none">
              {monthlyMetrics.averageAchievementRate}%
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="h-1 w-full bg-editorial-dark/10 rounded-none overflow-hidden">
              <div 
                className="h-full bg-editorial-accent transition-all duration-500" 
                style={{ width: `${monthlyMetrics.averageAchievementRate}%` }} 
              />
            </div>
            <span className="text-[9px] font-sans italic text-editorial-dark/50 block">
              Average target completion rate
            </span>
          </div>
        </div>

        {/* Metric: Total Goals Met */}
        <div className="border border-editorial-dark/10 p-4 bg-editorial-dark/[0.01] flex flex-col justify-between space-y-3">
          <div>
            <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45">Total Goals Completed</span>
            <span className="font-mono text-3xl font-light text-editorial-dark mt-1 block leading-none">
              {monthlyMetrics.totalCompletedGoals}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-editorial-dark/55">
            <Target size={11} className="text-editorial-accent" />
            <span>of {monthlyMetrics.totalExpectedGoals} potential goal items met</span>
          </div>
        </div>

        {/* Metric: Perfect Days */}
        <div className="border border-editorial-dark/10 p-4 bg-editorial-dark/[0.01] flex flex-col justify-between space-y-3">
          <div>
            <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45">Perfect Daily Streaks</span>
            <span className="font-mono text-3xl font-light text-editorial-emerald mt-1 block leading-none">
              {monthlyMetrics.perfectDaysCount}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-editorial-emerald">
            <CheckCircle size={11} />
            <span>{monthlyMetrics.perfectDaysCount} days with 100% goals satisfied</span>
          </div>
        </div>

        {/* Metric: Longest Perfect Streak */}
        <div className="border border-editorial-dark/10 p-4 bg-editorial-dark/[0.01] flex flex-col justify-between space-y-3">
          <div>
            <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45">Longest Perfect Run</span>
            <span className="font-mono text-3xl font-light text-editorial-amber mt-1 block leading-none">
              {monthlyMetrics.perfectDaysStreak}d
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-mono text-editorial-amber">
            <Trophy size={11} className="fill-editorial-amber/15" />
            <span>Consecutive 100% days this month</span>
          </div>
        </div>
      </div>

      {/* Main Core Section: Calendar View vs Tracker Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Grid Section (7 Columns) */}
        <div className="lg:col-span-7 space-y-3 border border-editorial-dark/15 p-5 bg-editorial-bg">
          <div className="flex items-center justify-between border-b border-editorial-dark/10 pb-2 mb-2">
            <h4 className="text-[10px] font-mono text-editorial-dark/75 tracking-widest uppercase font-semibold">
              {monthName} Calendar Grid
            </h4>
            <span className="text-[9px] font-sans italic text-editorial-dark/50">
              Click any cell to jump to that day
            </span>
          </div>

          {/* Calendar grid wrapper */}
          <div className="space-y-2">
            {/* Weekday labels */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, idx) => (
                <span 
                  key={dayName} 
                  className={`text-[8px] font-mono uppercase tracking-wider ${
                    idx === 0 || idx === 6 ? 'text-editorial-dark/40' : 'text-editorial-dark/60'
                  }`}
                >
                  {dayName}
                </span>
              ))}
            </div>

            {/* Grid days */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarCells.map((cell, index) => {
                if (cell.isPadding) {
                  return (
                    <div 
                      key={cell.key} 
                      className="aspect-square bg-transparent border border-dashed border-editorial-dark/5"
                    />
                  );
                }

                // Determine styling based on daily rate
                const rate = cell.rate || 0;
                let bgStyle = 'bg-editorial-dark/[0.02] border-editorial-dark/10 text-editorial-dark/45 hover:bg-editorial-dark/[0.06]';
                let dotColor = 'bg-editorial-dark/15';

                if (rate > 0) {
                  if (rate === 100) {
                    bgStyle = 'bg-editorial-accent text-editorial-bg border-editorial-accent hover:opacity-90';
                    dotColor = 'bg-editorial-bg/60';
                  } else if (rate >= 67) {
                    bgStyle = 'bg-editorial-accent/60 text-editorial-bg border-editorial-accent/50 hover:bg-editorial-accent/70';
                    dotColor = 'bg-editorial-bg/50';
                  } else if (rate >= 34) {
                    bgStyle = 'bg-editorial-accent/35 text-editorial-dark border-editorial-accent/25 hover:bg-editorial-accent/45';
                    dotColor = 'bg-editorial-accent/40';
                  } else {
                    bgStyle = 'bg-editorial-accent/15 text-editorial-dark border-editorial-accent/15 hover:bg-editorial-accent/25';
                    dotColor = 'bg-editorial-accent/30';
                  }
                }

                const isActiveDay = selectedDate === cell.date;

                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => onSelectDate && onSelectDate(cell.date)}
                    className={`aspect-square relative p-1 text-[11px] font-mono font-bold flex flex-col justify-between transition-all cursor-pointer select-none rounded-none border ${bgStyle} ${
                      isActiveDay ? 'ring-2 ring-editorial-accent ring-offset-2 ring-offset-editorial-bg' : ''
                    }`}
                    title={`${safeFormatDate(cell.date)}: ${cell.completed}/${cell.total} goals satisfied (${rate}%)`}
                  >
                    {/* Day Number */}
                    <span className="block leading-none text-left">{cell.dayNum}</span>

                    {/* Completion indicator dot */}
                    {cell.total > 0 && (
                      <span className="flex items-center gap-0.5 justify-end w-full">
                        <span className={`h-1 w-1 rounded-full ${dotColor}`} />
                        <span className="text-[7px] font-normal scale-90 origin-bottom-right leading-none opacity-80">
                          {cell.completed}/{cell.total}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color Key */}
          <div className="pt-3 border-t border-editorial-dark/5 flex items-center justify-between flex-wrap gap-2 text-[9px] font-mono">
            <span className="text-editorial-dark/45 uppercase tracking-wider font-semibold">Goal Completion scale:</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 bg-editorial-dark/[0.02] border border-editorial-dark/10" />
                <span className="text-editorial-dark/60">0%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 bg-editorial-accent/15 border border-editorial-accent/15" />
                <span className="text-editorial-dark/60">1-33%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 bg-editorial-accent/35 border border-editorial-accent/25" />
                <span className="text-editorial-dark/60">34-66%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 bg-editorial-accent/60 border border-editorial-accent/50" />
                <span className="text-editorial-dark/60">67-99%</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 bg-editorial-accent border border-editorial-accent" />
                <span className="text-editorial-dark/60">100%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Goals Progress breakdown (5 Columns) */}
        <div className="lg:col-span-5 space-y-4 border border-editorial-dark/15 p-5 bg-editorial-bg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-editorial-dark/10 pb-2 mb-3">
              <h4 className="text-[10px] font-mono text-editorial-dark/75 tracking-widest uppercase font-semibold">
                Tracker Target Breakdown
              </h4>
              <span className="text-[9px] font-sans italic text-editorial-dark/50">
                Sorted by consistency
              </span>
            </div>

            <div className="space-y-3.5 max-h-[250px] overflow-y-auto pr-1">
              {trackersBreakdown.map(tracker => {
                const colorStyles = COLOR_MAP[tracker.color] || COLOR_MAP.emerald;
                
                return (
                  <div key={tracker.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={`h-6 w-6 flex shrink-0 items-center justify-center text-white border border-editorial-dark/10 ${colorStyles.bg}`}>
                          <LucideIcon name={tracker.icon} size={11} />
                        </div>
                        <span className="font-serif font-semibold text-editorial-dark leading-tight truncate">
                          {tracker.name}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-mono font-bold text-editorial-dark">
                          {tracker.daysCompleted}/{tracker.totalDays} days
                        </span>
                        <span className="block text-[8px] font-mono text-editorial-dark/45 uppercase tracking-wider">
                          Target: &ge; {tracker.targetValue} {tracker.unit}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar with Percentage Tag */}
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 bg-editorial-dark/5 h-2 rounded-none overflow-hidden">
                        <div 
                          className={`h-full ${colorStyles.bg} transition-all duration-300`} 
                          style={{ width: `${tracker.successRate}%` }}
                        />
                      </div>
                      <span className="font-mono text-[10px] font-bold text-editorial-dark w-8 text-right">
                        {tracker.successRate}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-[10px] font-mono text-editorial-dark/45 bg-editorial-dark/[0.02] border border-editorial-dark/5 p-3 leading-relaxed mt-4">
            <span className="font-bold flex items-center gap-1 text-editorial-accent mb-0.5 uppercase tracking-wide">
              <Sparkles size={11} />
              Monthly Insights
            </span>
            <span>
              Your most consistent goal is <strong className="font-serif font-bold text-editorial-dark">{trackersBreakdown[0]?.name || '—'}</strong> with an impressive <strong className="font-semibold text-editorial-dark">{trackersBreakdown[0]?.successRate || 0}%</strong> consistency. Tap calendar cells to log missing items.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
