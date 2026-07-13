/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Tracker, LogEntry, COLOR_MAP } from '../types';
import { LucideIcon } from './LucideIcon';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, 
  Trophy, 
  Flame,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Link2,
  Info,
  HelpCircle,
  TrendingUp,
  Target
} from 'lucide-react';

interface GoalCompletionCalendarProps {
  trackers: Tracker[];
  logs: LogEntry[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
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

export function GoalCompletionCalendar({
  trackers,
  logs,
  selectedDate,
  onSelectDate
}: GoalCompletionCalendarProps) {
  // Parse year and month from the selectedDate, defaulting to current date if missing
  const dateParts = useMemo(() => {
    let dateToUse = selectedDate;
    if (!dateToUse || !dateToUse.includes('-')) {
      const todayObj = new Date();
      const tzOffset = todayObj.getTimezoneOffset() * 60000;
      dateToUse = new Date(todayObj.getTime() - tzOffset).toISOString().split('T')[0];
    }
    
    const parts = dateToUse.split('-');
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

  // Track calendar navigation month separately so user can explore without changing global selected date unless they click a cell
  const [navYear, setNavYear] = useState<number>(dateParts.year);
  const [navMonth, setNavMonth] = useState<number>(dateParts.month);

  // Sync nav state with selectedDate whenever selectedDate changes
  React.useEffect(() => {
    setNavYear(dateParts.year);
    setNavMonth(dateParts.month);
  }, [dateParts.year, dateParts.month]);

  // Total days in the navigated month
  const totalDays = useMemo(() => {
    const d = new Date(navYear, navMonth, 0);
    return isNaN(d.getTime()) ? 31 : d.getDate();
  }, [navYear, navMonth]);

  // List of YYYY-MM-DD strings for the navigated month
  const datesInMonth = useMemo(() => {
    const dates: string[] = [];
    for (let d = 1; d <= totalDays; d++) {
      dates.push(`${navYear}-${String(navMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return dates;
  }, [navYear, navMonth, totalDays]);

  // Filter logs for the navigated month
  const monthLogs = useMemo(() => {
    const prefix = `${navYear}-${String(navMonth).padStart(2, '0')}-`;
    return logs.filter(l => l.date.startsWith(prefix));
  }, [logs, navYear, navMonth]);

  // Determine trackers that have goals (i.e. targetValue defined)
  const trackersWithGoals = useMemo(() => {
    return trackers.filter(t => t.targetValue !== undefined && t.targetValue > 0);
  }, [trackers]);

  // Compute daily targets satisfaction for each day of the navigated month
  const dailyStats = useMemo(() => {
    return datesInMonth.map((dStr, index) => {
      let completedGoals = 0;
      const totalGoalsCount = trackersWithGoals.length;
      const metTrackerIds: string[] = [];

      trackersWithGoals.forEach(t => {
        const tLogs = monthLogs.filter(l => l.trackerId === t.id && l.date === dStr);
        const totalVal = t.type === 'counter'
          ? tLogs.reduce((sum, l) => sum + l.value, 0)
          : (tLogs.length > 0 ? tLogs[tLogs.length - 1].value : 0);

        if (t.targetValue !== undefined && totalVal >= t.targetValue) {
          completedGoals++;
          metTrackerIds.push(t.id);
        }
      });

      const isPerfect = totalGoalsCount > 0 && completedGoals === totalGoalsCount;
      const rate = totalGoalsCount > 0 ? Math.round((completedGoals / totalGoalsCount) * 100) : 0;

      return {
        date: dStr,
        dayNum: index + 1,
        completedGoals,
        totalGoals: totalGoalsCount,
        isPerfect,
        rate,
        metTrackerIds
      };
    });
  }, [datesInMonth, trackersWithGoals, monthLogs]);

  // Calculate streaks & metrics for the active month
  const streakMetrics = useMemo(() => {
    let perfectDaysCount = 0;
    let maxStreak = 0;
    let currentStreak = 0;
    let activeStreakAtEnd = 0; // streak ending on the last recorded day of the month

    // To find current active streak in the month ending at selected date or today
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const todayStr = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];

    dailyStats.forEach((day, idx) => {
      if (day.isPerfect) {
        perfectDaysCount++;
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
        }
      } else {
        currentStreak = 0;
      }
    });

    // Calculate current running streak from the navigated month (working backwards from selectedDate or today if it's the current month)
    let runningStreak = 0;
    let startChecking = false;
    
    // Find index of today or selectedDate to count backwards
    const targetDateStr = selectedDate && selectedDate.startsWith(`${navYear}-${String(navMonth).padStart(2, '0')}`) 
      ? selectedDate 
      : todayStr.startsWith(`${navYear}-${String(navMonth).padStart(2, '0')}`) ? todayStr : null;

    if (targetDateStr) {
      const targetDayNum = parseInt(targetDateStr.split('-')[2], 10);
      for (let i = targetDayNum - 1; i >= 0; i--) {
        if (dailyStats[i]?.isPerfect) {
          runningStreak++;
        } else {
          // If the target day itself is not logged/perfect, but a prior day was, check if it breaks the streak.
          // Allow today to not be perfect yet if we're counting backwards from today.
          if (i === targetDayNum - 1 && targetDateStr === todayStr) {
            continue; // Keep checking previous days
          }
          break;
        }
      }
    } else {
      // If we are looking at a past month, the running streak at the end of the month
      let tempStreak = 0;
      for (let i = dailyStats.length - 1; i >= 0; i--) {
        if (dailyStats[i].isPerfect) {
          tempStreak++;
        } else {
          break;
        }
      }
      runningStreak = tempStreak;
    }

    const integrityRate = dailyStats.length > 0 
      ? Math.round((perfectDaysCount / dailyStats.length) * 100) 
      : 0;

    return {
      perfectDaysCount,
      longestStreak: maxStreak,
      currentStreak: runningStreak,
      integrityRate
    };
  }, [dailyStats, selectedDate, navYear, navMonth]);

  // Navigate months
  const handlePrevMonth = () => {
    setNavMonth(prev => {
      if (prev === 1) {
        setNavYear(y => y - 1);
        return 12;
      }
      return prev - 1;
    });
  };

  const handleNextMonth = () => {
    setNavMonth(next => {
      if (next === 12) {
        setNavYear(y => y + 1);
        return 1;
      }
      return next + 1;
    });
  };

  // Month header text
  const monthName = useMemo(() => {
    const d = new Date(navYear, navMonth - 1, 1);
    if (isNaN(d.getTime())) return 'Current Month';
    try {
      return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    } catch (e) {
      return `${navYear}-${navMonth}`;
    }
  }, [navYear, navMonth]);

  // Calendar cells with padding for correct weekday alignment
  const calendarCells = useMemo(() => {
    const cells = [];
    const firstDayIndex = new Date(navYear, navMonth - 1, 1).getDay(); // 0 = Sun, 1 = Mon...

    // Add padding cells representing previous month's end
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({
        isPadding: true,
        key: `pad-${i}`,
        date: '',
        dayNum: 0,
        isPerfect: false,
        rate: 0,
        completedGoals: 0,
        totalGoals: 0,
        metTrackerIds: []
      });
    }

    // Add actual days
    dailyStats.forEach(day => {
      cells.push({
        isPadding: false,
        key: day.date,
        ...day
      });
    });

    return cells;
  }, [navYear, navMonth, dailyStats]);

  // Check if a cell is part of a consecutive streak in the same week row
  const getChainLinks = (cellIndex: number) => {
    if (cellIndex < 0 || cellIndex >= calendarCells.length) return { hasLeft: false, hasRight: false };
    const currentCell = calendarCells[cellIndex];
    if (currentCell.isPadding || !currentCell.isPerfect) return { hasLeft: false, hasRight: false };

    const rowNum = Math.floor(cellIndex / 7);
    const colNum = cellIndex % 7;

    // Left link condition: previous cell is perfect, exists, and is in the same row (colNum > 0)
    let hasLeft = false;
    if (colNum > 0) {
      const prevCell = calendarCells[cellIndex - 1];
      if (prevCell && !prevCell.isPadding && prevCell.isPerfect) {
        hasLeft = true;
      }
    }

    // Right link condition: next cell is perfect, exists, and is in the same row (colNum < 6)
    let hasRight = false;
    if (colNum < 6) {
      const nextCell = calendarCells[cellIndex + 1];
      if (nextCell && !nextCell.isPadding && nextCell.isPerfect) {
        hasRight = true;
      }
    }

    return { hasLeft, hasRight };
  };

  // If there are no goals configured, offer a friendly notice
  if (trackersWithGoals.length === 0) {
    return (
      <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 text-center py-10" id="goal-completion-calendar-empty">
        <HelpCircle size={32} className="mx-auto text-editorial-accent mb-3 stroke-[1.5]" />
        <h3 className="font-serif font-medium text-base text-editorial-dark">Goal Completion Calendar</h3>
        <p className="text-xs font-sans italic text-editorial-dark/60 mt-1 max-w-md mx-auto">
          No habits have daily targets configured. Please edit or add trackers and set a "Daily Target" value to begin tracking your "Don't Break the Chain" completion streaks.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-6" id="goal-completion-calendar">
      {/* Top Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-editorial-dark/10 pb-4 gap-4">
        <div>
          <span className="block text-[10px] font-mono font-medium text-editorial-accent uppercase tracking-widest">
            Habit Consistency Engine
          </span>
          <h3 className="font-serif font-medium text-lg text-editorial-dark mt-0.5 flex items-center gap-2">
            <Link2 size={18} className="text-editorial-accent rotate-45" />
            <span>Goal Completion Calendar</span>
          </h3>
          <p className="text-[10px] font-sans italic text-editorial-dark/60 mt-0.5">
            Visualize your daily habit targets with the long-term "Don't Break the Chain" grid
          </p>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-1 self-start sm:self-auto border border-editorial-dark/15 p-1 bg-editorial-bg">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-1 hover:bg-editorial-dark/5 text-editorial-dark transition-all cursor-pointer"
            title="Previous Month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-xs font-mono font-bold uppercase tracking-wider px-3 min-w-[120px] text-center text-editorial-dark">
            {monthName}
          </span>
          <button
            type="button"
            onClick={handleNextMonth}
            className="p-1 hover:bg-editorial-dark/5 text-editorial-dark transition-all cursor-pointer"
            title="Next Month"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Streak Dashboard Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Current Streak */}
        <div className="border border-editorial-dark/10 p-4 bg-editorial-dark/[0.01] flex flex-col justify-between">
          <div>
            <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45 flex items-center gap-1">
              <Flame size={10} className="text-editorial-orange fill-editorial-orange/10 animate-pulse" />
              Current Streak
            </span>
            <span className="font-mono text-3xl font-light text-editorial-dark mt-1 block leading-none">
              {streakMetrics.currentStreak} <span className="text-xs font-serif italic text-editorial-dark/50">days</span>
            </span>
          </div>
          <span className="text-[8px] font-sans italic text-editorial-dark/50 mt-1">
            Consecutive days with 100% goals met
          </span>
        </div>

        {/* Metric 2: Longest Streak */}
        <div className="border border-editorial-dark/10 p-4 bg-editorial-dark/[0.01] flex flex-col justify-between">
          <div>
            <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45 flex items-center gap-1">
              <Trophy size={10} className="text-editorial-amber" />
              Longest Streak
            </span>
            <span className="font-mono text-3xl font-light text-editorial-dark mt-1 block leading-none">
              {streakMetrics.longestStreak} <span className="text-xs font-serif italic text-editorial-dark/50">days</span>
            </span>
          </div>
          <span className="text-[8px] font-sans italic text-editorial-dark/50 mt-1">
            Your best run of flawless days this month
          </span>
        </div>

        {/* Metric 3: Flawless Days */}
        <div className="border border-editorial-dark/10 p-4 bg-editorial-dark/[0.01] flex flex-col justify-between">
          <div>
            <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45 flex items-center gap-1">
              <Check size={10} className="text-editorial-emerald" />
              Flawless Days
            </span>
            <span className="font-mono text-3xl font-light text-editorial-emerald mt-1 block leading-none">
              {streakMetrics.perfectDaysCount} <span className="text-xs font-serif italic text-editorial-dark/50">of {totalDays}</span>
            </span>
          </div>
          <span className="text-[8px] font-sans italic text-editorial-dark/50 mt-1">
            Days you completed 100% of set habits
          </span>
        </div>

        {/* Metric 4: Chain Integrity Rate */}
        <div className="border border-editorial-dark/10 p-4 bg-editorial-dark/[0.01] flex flex-col justify-between">
          <div>
            <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45 flex items-center gap-1">
              <TrendingUp size={10} className="text-editorial-accent" />
              Chain Integrity
            </span>
            <span className="font-mono text-3xl font-light text-editorial-accent mt-1 block leading-none">
              {streakMetrics.integrityRate}%
            </span>
          </div>
          <div className="space-y-1 mt-1">
            <div className="h-1 w-full bg-editorial-dark/10 rounded-none overflow-hidden">
              <div 
                className="h-full bg-editorial-accent" 
                style={{ width: `${streakMetrics.integrityRate}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid Area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Grid - Left side (8 cols) */}
        <div className="lg:col-span-8 border border-editorial-dark/15 p-5 bg-editorial-bg relative">
          
          {/* Grid Headers: Sunday to Saturday */}
          <div className="grid grid-cols-7 gap-2 mb-2 text-center border-b border-editorial-dark/10 pb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayName, idx) => (
              <span 
                key={dayName} 
                className={`text-[9px] font-mono uppercase tracking-wider font-semibold ${
                  idx === 0 || idx === 6 ? 'text-editorial-dark/40' : 'text-editorial-dark/60'
                }`}
              >
                {dayName}
              </span>
            ))}
          </div>

          {/* Grid Days with Chains */}
          <div className="grid grid-cols-7 gap-y-3.5 gap-x-2 relative z-10">
            {calendarCells.map((cell, idx) => {
              if (cell.isPadding) {
                return (
                  <div 
                    key={cell.key} 
                    className="aspect-square bg-transparent border border-dashed border-editorial-dark/5 opacity-30 rounded-none"
                  />
                );
              }

              const { hasLeft, hasRight } = getChainLinks(idx);
              const isSelected = selectedDate === cell.date;

              return (
                <div 
                  key={cell.key} 
                  className="aspect-square relative flex items-center justify-center"
                >
                  {/* Left horizontal link connector */}
                  {hasLeft && (
                    <div className="absolute left-[-10px] right-[50%] h-3 bg-editorial-accent/30 border-y border-editorial-accent/15 z-0" />
                  )}

                  {/* Right horizontal link connector */}
                  {hasRight && (
                    <div className="absolute left-[50%] right-[-10px] h-3 bg-editorial-accent/30 border-y border-editorial-accent/15 z-0" />
                  )}

                  {/* Calendar Cell Button */}
                  <button
                    type="button"
                    onClick={() => onSelectDate(cell.date)}
                    className={`h-11 w-11 flex flex-col items-center justify-center relative rounded-full border transition-all cursor-pointer z-10 select-none ${
                      cell.isPerfect 
                        ? 'bg-editorial-accent text-editorial-bg border-editorial-accent shadow-sm hover:scale-105 active:scale-95' 
                        : cell.rate > 0
                          ? 'bg-editorial-accent-light text-editorial-dark border-editorial-accent/30 hover:bg-editorial-accent/20'
                          : 'bg-editorial-dark/[0.02] text-editorial-dark/50 border-editorial-dark/10 hover:bg-editorial-dark/[0.06]'
                    } ${
                      isSelected 
                        ? 'ring-2 ring-editorial-accent ring-offset-2 ring-offset-editorial-bg font-bold scale-105' 
                        : ''
                    }`}
                    title={`${safeFormatDate(cell.date)}: ${cell.completedGoals}/${cell.totalGoals} goals met (${cell.rate}%)`}
                  >
                    {/* Day Number */}
                    <span className="text-xs font-mono font-bold block">{cell.dayNum}</span>

                    {/* Badge Icon or Progress mini text */}
                    {cell.isPerfect ? (
                      <span className="absolute bottom-1 flex items-center justify-center text-[8px]">
                        <Link2 size={7} className="stroke-[3.5] rotate-45 text-editorial-bg" />
                      </span>
                    ) : cell.totalGoals > 0 ? (
                      <span className="text-[7px] font-mono opacity-80 mt-0.5 leading-none">
                        {cell.completedGoals}/{cell.totalGoals}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Guide legend */}
          <div className="mt-5 pt-3 border-t border-editorial-dark/5 flex items-center justify-between flex-wrap gap-2 text-[9px] font-mono">
            <span className="text-editorial-dark/45 uppercase tracking-wider">Legend & Guides:</span>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-editorial-accent border border-editorial-accent flex items-center justify-center text-[5px] text-white">
                  <Link2 size={5} className="rotate-45" />
                </span>
                <span className="text-editorial-dark/65 font-medium">Perfect Chain Day (100% goals met)</span>
              </div>
              
              <div className="flex items-center gap-1.5">
                <span className="relative h-3 w-8 flex items-center justify-between">
                  <span className="h-3 w-3 rounded-full bg-editorial-accent" />
                  <span className="absolute left-1.5 right-1.5 h-1.5 bg-editorial-accent/30" />
                  <span className="h-3 w-3 rounded-full bg-editorial-accent" />
                </span>
                <span className="text-editorial-dark/65 font-medium">Active Chain Link</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full bg-editorial-accent-light border border-editorial-accent/30" />
                <span className="text-editorial-dark/65 font-medium">Partial Completion</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Day Stats Breakdown - Right side (4 cols) */}
        <div className="lg:col-span-4 border border-editorial-dark/15 p-5 bg-editorial-bg flex flex-col justify-between">
          <div>
            <div className="border-b border-editorial-dark/10 pb-2 mb-3 flex items-center justify-between">
              <h4 className="text-[10px] font-mono text-editorial-dark/75 tracking-widest uppercase font-semibold">
                Daily Breakdown
              </h4>
              <span className="text-[9px] font-sans font-medium text-editorial-accent bg-editorial-accent-light px-1.5 py-0.5">
                {safeFormatDate(selectedDate, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {/* Compute selected date info */}
            {(() => {
              const activeDayStats = dailyStats.find(d => d.date === selectedDate);
              if (!activeDayStats) {
                return (
                  <p className="text-xs font-sans italic text-editorial-dark/50 text-center py-6">
                    Tap any day on the calendar grid to see target performance details.
                  </p>
                );
              }

              return (
                <div className="space-y-4">
                  {/* Performance Header */}
                  <div className="bg-editorial-dark/[0.02] p-3 border border-editorial-dark/5">
                    <span className="block text-[8px] font-mono uppercase tracking-wider text-editorial-dark/45">Goal Achievement</span>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="font-mono text-2xl font-bold text-editorial-dark">
                        {activeDayStats.completedGoals} of {activeDayStats.totalGoals}
                      </span>
                      <span className="text-xs font-sans italic text-editorial-dark/60">
                        ({activeDayStats.rate}% complete)
                      </span>
                    </div>

                    {/* Progress Indicator */}
                    <div className="h-1.5 w-full bg-editorial-dark/5 rounded-none overflow-hidden mt-2">
                      <div 
                        className={`h-full transition-all duration-300 ${
                          activeDayStats.isPerfect ? 'bg-editorial-accent' : 'bg-editorial-dark/30'
                        }`}
                        style={{ width: `${activeDayStats.rate}%` }}
                      />
                    </div>
                  </div>

                  {/* Goal Lists */}
                  <div className="space-y-3">
                    <span className="block text-[9px] font-mono uppercase tracking-widest text-editorial-dark/50 font-bold">
                      Habit Statuses:
                    </span>
                    
                    <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                      {trackersWithGoals.map(tracker => {
                        const isMet = activeDayStats.metTrackerIds.includes(tracker.id);
                        const colorStyles = COLOR_MAP[tracker.color] || COLOR_MAP.emerald;
                        
                        // Find current value logged
                        const tLogs = monthLogs.filter(l => l.trackerId === tracker.id && l.date === activeDayStats.date);
                        const loggedValue = tracker.type === 'counter'
                          ? tLogs.reduce((sum, l) => sum + l.value, 0)
                          : (tLogs.length > 0 ? tLogs[tLogs.length - 1].value : 0);

                        return (
                          <div 
                            key={tracker.id} 
                            className="flex items-center justify-between p-2 border border-editorial-dark/5 bg-editorial-bg text-xs gap-3"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`h-5 w-5 flex items-center justify-center shrink-0 text-white ${colorStyles.bg}`}>
                                <LucideIcon name={tracker.icon} size={10} />
                              </div>
                              <span className="font-serif font-bold text-editorial-dark truncate">
                                {tracker.name}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 text-right">
                              <span className="font-mono text-[10px]">
                                {loggedValue} / {tracker.targetValue} {tracker.unit || ''}
                              </span>
                              
                              <span className={`h-4.5 w-4.5 flex items-center justify-center rounded-full text-white ${
                                isMet ? 'bg-editorial-accent' : 'bg-editorial-dark/10 text-editorial-dark/30'
                              }`}>
                                <Check size={10} className="stroke-[3]" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="text-[10px] font-mono text-editorial-dark/45 bg-editorial-dark/[0.02] border border-editorial-dark/5 p-3 leading-relaxed mt-4">
            <span className="font-bold flex items-center gap-1 text-editorial-accent mb-0.5 uppercase tracking-wide">
              <Sparkles size={11} />
              Don't Break the Chain
            </span>
            <span>
              Maintaining a consecutive chain strengthens habits. Logging even a single unit is a victory over zero! Set daily targets on your habits and watch the golden chains grow.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
