/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Tracker, LogEntry, COLOR_MAP } from '../types';
import { LucideIcon } from './LucideIcon';
import { Plus, Minus, Check, MessageSquare, AlertCircle, Flame, ArrowUp, ArrowDown, LineChart as LineChartIcon, X, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

interface TrackerCardProps {
  key?: string;
  tracker: Tracker;
  logs: LogEntry[];
  selectedDate: string;
  onLogValue: (trackerId: string, value: number, note?: string) => void;
  onDeleteLog?: (logId: string) => void;
}

export function TrackerCard({ tracker, logs, selectedDate, onLogValue, onDeleteLog }: TrackerCardProps) {
  // Filter logs for this tracker on the selected date
  const trackerLogs = logs.filter(l => l.trackerId === tracker.id && l.date === selectedDate);

  // Calculate current value based on tracker type
  // Counter: Sum of all logs on this date
  // Numeric, Boolean, Rating: Last logged value on this date
  let currentValue = 0;
  if (tracker.type === 'counter') {
    currentValue = trackerLogs.reduce((sum, log) => sum + log.value, 0);
  } else {
    // Show latest log value
    currentValue = trackerLogs.length > 0 ? trackerLogs[trackerLogs.length - 1].value : 0;
  }

  // Calculate daily trend data (comparing today's value with yesterday's value)
  const trendData = React.useMemo(() => {
    const prevDateObj = new Date(selectedDate + 'T12:00:00');
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDateStr = prevDateObj.toISOString().split('T')[0];

    const prevDayLogs = logs.filter(l => l.trackerId === tracker.id && l.date === prevDateStr);
    
    let prevValue = 0;
    if (tracker.type === 'counter') {
      prevValue = prevDayLogs.reduce((sum, log) => sum + log.value, 0);
    } else {
      prevValue = prevDayLogs.length > 0 ? prevDayLogs[prevDayLogs.length - 1].value : 0;
    }

    const hasTodayLogs = trackerLogs.length > 0;
    const hasYesterdayLogs = prevDayLogs.length > 0;

    // We only show comparison if at least one of the days has logs.
    if (!hasTodayLogs && !hasYesterdayLogs) {
      return null;
    }

    const diff = currentValue - prevValue;
    let trend: 'up' | 'down' | 'equal' = 'equal';
    if (diff > 0.0001) trend = 'up';
    else if (diff < -0.0001) trend = 'down';

    return {
      prevValue,
      currentValue,
      diff,
      trend,
    };
  }, [tracker, logs, selectedDate, currentValue, trackerLogs.length]);

  const latestLogNote = trackerLogs.length > 0 ? trackerLogs[trackerLogs.length - 1].note : '';

  // Calculate current streak of goal met or logged consecutively backward from selectedDate
  const streak = React.useMemo(() => {
    const isGoalMetOnDate = (dateStr: string) => {
      const tLogs = logs.filter(l => l.trackerId === tracker.id && l.date === dateStr);
      if (tLogs.length === 0) return false;
      
      let val = 0;
      if (tracker.type === 'counter') {
        val = tLogs.reduce((sum, l) => sum + l.value, 0);
      } else {
        val = tLogs[tLogs.length - 1].value;
      }
      
      const targetVal = tracker.targetValue;
      if (targetVal !== undefined && targetVal > 0) {
        return val >= targetVal;
      }
      // For trackers without targetValue, streak is counted by having at least 1 log entry
      return tLogs.length > 0;
    };

    let count = 0;
    let streakCount = 0;
    let currentDateObj = new Date(selectedDate + 'T12:00:00');
    const safetyLimit = Math.max(365, logs.length + 5);

    const metToday = isGoalMetOnDate(selectedDate);
    if (metToday) {
      streakCount = 1;
      while (count < safetyLimit) {
        currentDateObj.setDate(currentDateObj.getDate() - 1);
        const prevDateStr = currentDateObj.toISOString().split('T')[0];
        if (isGoalMetOnDate(prevDateStr)) {
          streakCount++;
        } else {
          break;
        }
        count++;
      }
    } else {
      currentDateObj.setDate(currentDateObj.getDate() - 1);
      const prevDateStr = currentDateObj.toISOString().split('T')[0];
      if (isGoalMetOnDate(prevDateStr)) {
        streakCount = 1;
        while (count < safetyLimit) {
          currentDateObj.setDate(currentDateObj.getDate() - 1);
          const nextPrevDateStr = currentDateObj.toISOString().split('T')[0];
          if (isGoalMetOnDate(nextPrevDateStr)) {
            streakCount++;
          } else {
            break;
          }
          count++;
        }
      }
    }
    return streakCount;
  }, [tracker, logs, selectedDate]);

  // Input states for custom forms
  const [numInput, setNumInput] = useState<string>('');
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  // Calculate the last 30 days data
  const last30DaysData = React.useMemo(() => {
    const refDate = new Date(selectedDate + 'T12:00:00');
    const data = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(refDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split('T')[0];
      const dayLogs = logs.filter(l => l.trackerId === tracker.id && l.date === dateStr);

      let val = 0;
      if (tracker.type === 'counter') {
        val = dayLogs.reduce((sum, log) => sum + log.value, 0);
      } else {
        val = dayLogs.length > 0 ? dayLogs[dayLogs.length - 1].value : 0;
      }

      const displayDate = d.toLocaleDateString(undefined, { 
        month: 'short', 
        day: 'numeric' 
      });

      data.push({
        date: dateStr,
        displayDate,
        value: val,
        hasLogs: dayLogs.length > 0,
      });
    }

    return data;
  }, [logs, tracker, selectedDate]);

  const colorStyles = COLOR_MAP[tracker.color] || COLOR_MAP.emerald;

  // Percentage completion for progress bars
  const target = tracker.targetValue;
  const isCompleted = target ? currentValue >= target : false;
  const completionPercent = target ? Math.min(Math.round((currentValue / target) * 100), 100) : 0;

  // Custom quick increment buttons based on unit types
  const getQuickIncrements = () => {
    const unit = tracker.unit?.toLowerCase();
    if (unit === 'ml') return [250, 500, 750];
    if (unit === 'steps') return [1000, 2500, 5000];
    if (unit === 'hrs' || unit === 'hours') return [0.5, 1, 2];
    if (unit === 'cal' || unit === 'calories') return [100, 250, 500];
    return [1, 5, 10];
  };

  const handleCounterAdjust = (amount: number) => {
    // For counter, log the incremental amount directly
    // This adds a new log entry, which gets summed
    onLogValue(tracker.id, amount, noteText || undefined);
    setNoteText('');
    setShowNoteForm(false);
  };

  const handleNumericSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(numInput);
    if (!isNaN(val)) {
      onLogValue(tracker.id, val, noteText || undefined);
      setNumInput('');
      setNoteText('');
      setShowNoteForm(false);
    }
  };

  const handleBooleanToggle = () => {
    const nextValue = currentValue === 1 ? 0 : 1;
    onLogValue(tracker.id, nextValue, noteText || undefined);
    setNoteText('');
    setShowNoteForm(false);
  };

  const handleRatingClick = (rating: number) => {
    onLogValue(tracker.id, rating, noteText || undefined);
    setNoteText('');
    setShowNoteForm(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={isCompleted ? {
        opacity: 1,
        y: [0, -8, 3, -1, 0],
        scale: [1, 1.03, 0.98, 1.01, 1]
      } : {
        opacity: 1,
        y: 0,
        scale: 1
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{
        duration: isCompleted ? 0.65 : 0.3,
        ease: isCompleted ? "easeInOut" : "easeOut"
      }}
      className={`relative flex flex-col rounded-none border p-5 transition-all duration-300 ${
        isCompleted
          ? `${colorStyles.border} bg-editorial-accent-light/10 ring-1 ring-editorial-accent/30`
          : 'border-editorial-dark/15 bg-editorial-bg'
      }`}
    >
      {/* Card Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-none text-white ${colorStyles.bg}`}>
            <LucideIcon name={tracker.icon} size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-serif font-medium text-base text-editorial-dark line-clamp-1 leading-tight">{tracker.name}</h4>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="text-editorial-dark/35 hover:text-editorial-accent p-0.5 hover:bg-editorial-accent-light/40 transition-colors shrink-0 cursor-pointer"
                title="View 30-Day History"
              >
                <LineChartIcon size={13} />
              </button>
            </div>
            <p className="text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest mt-0.5">{tracker.category} tracker</p>
          </div>
        </div>

        {/* Goal Badge or Completion */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          {target && (
            <span className="text-[10px] font-mono font-medium text-editorial-accent bg-editorial-accent-light/50 border border-editorial-accent/20 rounded-none px-2.5 py-1">
              Goal: {target} {tracker.unit}
            </span>
          )}
          {tracker.targetValue !== undefined && tracker.targetValue > 0 && streak > 0 ? (
            <span 
              className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-editorial-orange bg-editorial-orange-light/35 border border-editorial-orange/20 rounded-none px-2.5 py-1 select-none"
              title={`${streak} day goal achievement streak`}
            >
              <Flame size={12} className="fill-current animate-pulse text-editorial-orange" />
              <span>Current Streak: {streak} {streak === 1 ? 'day' : 'days'}</span>
            </span>
          ) : (
            tracker.targetValue === undefined && streak > 0 && (
              <span 
                className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-editorial-dark/50 bg-editorial-dark/[0.03] border border-editorial-dark/15 rounded-none px-2 py-0.5 select-none"
                title={`${streak} consecutive logging days`}
              >
                <Flame size={11} className="fill-current text-editorial-dark/30" />
                <span>{streak}d Streak</span>
              </span>
            )
          )}
          {trendData && (
            <span 
              className={`inline-flex items-center gap-1 text-[10px] font-mono font-medium border rounded-none px-2 py-0.5 select-none cursor-help ${
                trendData.trend === 'up'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800'
                  : trendData.trend === 'down'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-800'
                  : 'bg-editorial-dark/5 border-editorial-dark/10 text-editorial-dark/60'
              }`}
              title={`Yesterday: ${trendData.prevValue}${tracker.unit ? ` ${tracker.unit}` : ''} | Today: ${trendData.currentValue}${tracker.unit ? ` ${tracker.unit}` : ''}`}
            >
              {trendData.trend === 'up' ? (
                <>
                  <ArrowUp size={11} className="stroke-[2.5px] text-emerald-600" />
                  <span>
                    {tracker.type === 'boolean' ? 'Active' : `+${Math.round(trendData.diff * 100) / 100}`}
                  </span>
                </>
              ) : trendData.trend === 'down' ? (
                <>
                  <ArrowDown size={11} className="stroke-[2.5px] text-rose-600" />
                  <span>
                    {tracker.type === 'boolean' ? 'Inactive' : `${Math.round(trendData.diff * 100) / 100}`}
                  </span>
                </>
              ) : (
                <>
                  <Minus size={11} className="stroke-[2.5px] text-editorial-dark/40" />
                  <span>Stable</span>
                </>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {tracker.description && (
        <p className="text-xs font-sans italic text-editorial-dark/60 line-clamp-2 mb-4 h-8">
          {tracker.description}
        </p>
      )}

      {/* Main logging interactive widget */}
      <div className="flex-1 flex flex-col justify-center items-center py-2">
        {/* COUNTER WIDGET */}
        {tracker.type === 'counter' && (
          <div className="w-full flex flex-col items-center gap-3">
            <div className="flex items-center justify-between w-full max-w-[220px] bg-editorial-accent-light/30 rounded-none p-1.5 border border-editorial-dark/10">
              <button
                type="button"
                onClick={() => handleCounterAdjust(-1)}
                className="flex h-10 w-10 items-center justify-center rounded-none bg-editorial-bg border border-editorial-dark/20 text-editorial-dark hover:bg-editorial-accent-light transition-colors"
              >
                <Minus size={16} />
              </button>
              <div className="text-center flex-1">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-2xl font-mono font-medium text-editorial-dark block leading-none">{currentValue}</span>
                  {trendData && trendData.trend !== 'equal' && (
                    <span 
                      className={`inline-flex items-center justify-center cursor-help`}
                      title={`Yesterday: ${trendData.prevValue} | Change: ${trendData.diff > 0 ? '+' : ''}${Math.round(trendData.diff * 100) / 100}`}
                    >
                      {trendData.trend === 'up' ? (
                        <ArrowUp size={16} className="stroke-[3px] text-emerald-600 animate-bounce" />
                      ) : (
                        <ArrowDown size={16} className="stroke-[3px] text-rose-600 animate-bounce" />
                      )}
                    </span>
                  )}
                </div>
                {tracker.unit && (
                  <span className="text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest block mt-1">{tracker.unit}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleCounterAdjust(1)}
                className="flex h-10 w-10 items-center justify-center rounded-none bg-editorial-bg border border-editorial-dark/20 text-editorial-dark hover:bg-editorial-accent-light transition-colors"
              >
                <Plus size={16} />
              </button>
            </div>

            {/* Quick addition buttons */}
            <div className="flex gap-1.5 flex-wrap justify-center mt-1">
              {getQuickIncrements().map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => handleCounterAdjust(amt)}
                  className="text-[10px] font-mono px-2.5 py-1 rounded-none border bg-editorial-bg border-editorial-dark/20 text-editorial-dark/80 hover:bg-editorial-accent-light transition-colors hover:border-editorial-accent hover:text-editorial-accent"
                >
                  +{amt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* NUMERIC WIDGET */}
        {tracker.type === 'numeric' && (
          <div className="w-full flex flex-col items-center gap-2">
            <form onSubmit={handleNumericSubmit} className="flex items-center w-full max-w-[240px] gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  step="any"
                  placeholder={currentValue > 0 ? `${currentValue}` : "Log amount"}
                  value={numInput}
                  onChange={(e) => setNumInput(e.target.value)}
                  className="w-full rounded-none border border-editorial-dark/20 px-3 py-2 text-sm text-center bg-editorial-bg font-mono outline-hidden focus:border-editorial-accent transition-all"
                />
                {tracker.unit && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono font-medium text-editorial-dark/50">
                    {tracker.unit}
                  </span>
                )}
              </div>
              <button
                type="submit"
                disabled={!numInput}
                className="px-4 py-2 bg-editorial-dark hover:bg-editorial-accent text-editorial-bg rounded-none text-xs font-mono transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </form>
            {currentValue > 0 && (
              <span className="text-xs text-editorial-dark/60 mt-1 font-sans flex items-center justify-center gap-1.5">
                <span>Current:</span>
                <strong className="text-editorial-dark font-mono font-semibold">{currentValue} {tracker.unit}</strong>
                {trendData && trendData.trend !== 'equal' && (
                  <span 
                    className="inline-flex items-center cursor-help"
                    title={`Yesterday: ${trendData.prevValue} ${tracker.unit} | Change: ${trendData.diff > 0 ? '+' : ''}${Math.round(trendData.diff * 100) / 100}`}
                  >
                    {trendData.trend === 'up' ? (
                      <ArrowUp size={13} className="stroke-[3px] text-emerald-600" />
                    ) : (
                      <ArrowDown size={13} className="stroke-[3px] text-rose-600" />
                    )}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* BOOLEAN WIDGET */}
        {tracker.type === 'boolean' && (
          <div className="w-full flex flex-col items-center gap-2 py-2">
            <button
              type="button"
              onClick={handleBooleanToggle}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-none border text-xs font-mono font-semibold transition-all duration-300 transform active:scale-95 ${
                currentValue === 1
                  ? `${colorStyles.accent} ${colorStyles.border}`
                  : 'bg-editorial-bg border-editorial-dark/20 text-editorial-dark hover:bg-editorial-accent-light'
              }`}
            >
              {currentValue === 1 ? (
                <>
                  <Check size={16} className="stroke-[2.5px]" />
                  Completed
                </>
              ) : (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-editorial-accent animate-pulse" />
                  Mark Complete
                </>
              )}
            </button>
            {trendData && trendData.trend !== 'equal' && (
              <span className="text-[10px] text-editorial-dark/50 font-mono flex items-center gap-1 mt-1">
                <span>Trend:</span>
                {trendData.trend === 'up' ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-0.5 cursor-help" title="Completed today but not yesterday">
                    <ArrowUp size={11} className="stroke-[2.5px]" /> Improved
                  </span>
                ) : (
                  <span className="text-rose-600 font-semibold flex items-center gap-0.5 cursor-help" title="Completed yesterday but not today">
                    <ArrowDown size={11} className="stroke-[2.5px]" /> Declined
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {/* RATING WIDGET */}
        {tracker.type === 'rating' && (
          <div className="w-full flex flex-col items-center gap-2">
            <div className="flex gap-1.5 justify-center py-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = star <= currentValue;
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleRatingClick(star)}
                    className="group relative transition-transform duration-100 hover:scale-125 focus:outline-hidden"
                  >
                    <LucideIcon
                      name="Smile"
                      size={26}
                      className={`stroke-[1.5px] transition-all duration-300 ${
                        isActive
                          ? `${colorStyles.text} fill-current`
                          : 'text-editorial-dark/15 hover:text-editorial-dark/40'
                      }`}
                    />
                    <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-semibold text-editorial-dark/50 opacity-0 group-hover:opacity-100 transition-opacity">
                      {star}
                    </span>
                  </button>
                );
              })}
            </div>
            {currentValue > 0 && (
              <span className="text-xs text-editorial-dark/60 mt-2 font-mono flex items-center justify-center gap-1.5">
                <span>Today's rating:</span>
                <strong className="text-editorial-dark font-semibold">{currentValue}/5</strong>
                {trendData && trendData.trend !== 'equal' && (
                  <span 
                    className="inline-flex items-center cursor-help"
                    title={`Yesterday's rating: ${trendData.prevValue}/5 | Change: ${trendData.diff > 0 ? '+' : ''}${Math.round(trendData.diff * 100) / 100}`}
                  >
                    {trendData.trend === 'up' ? (
                      <ArrowUp size={13} className="stroke-[3px] text-emerald-600" />
                    ) : (
                      <ArrowDown size={13} className="stroke-[3px] text-rose-600" />
                    )}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress towards goal bar */}
      {target && (
        <div className="mt-4 space-y-1.5">
          <div className="flex justify-between text-[9px] font-mono font-medium text-editorial-dark/50 uppercase tracking-wider">
            <span>Progress</span>
            <span>{completionPercent}%</span>
          </div>
          <div className="h-1 w-full bg-editorial-dark/10 rounded-none overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${completionPercent}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              className={`h-full rounded-none ${colorStyles.bg}`}
            />
          </div>
        </div>
      )}

      {/* Streak Fire and Progress visualization */}
      {streak > 0 && (
        <div className="mt-4 p-3.5 bg-editorial-orange/5 border border-editorial-orange/15 rounded-none flex flex-col gap-2.5 relative overflow-hidden">
          {/* Animated pulsing ember dots background to simulate heat / fire glow */}
          <div className="absolute inset-0 pointer-events-none opacity-40 overflow-hidden">
            <motion.div 
              animate={{ 
                scale: [1, 1.2, 1],
                opacity: [0.2, 0.5, 0.2],
                x: [0, 6, -4, 0],
                y: [0, -6, 4, 0]
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              className="absolute -right-4 -bottom-4 w-12 h-12 rounded-full bg-editorial-orange/20 blur-xl"
            />
          </div>

          <div className="flex items-center justify-between z-10">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-editorial-orange flex items-center gap-1">
              <Flame size={12} className="fill-editorial-orange animate-bounce" />
              <span>Consecutive Streak</span>
            </span>
            <span className="text-[10px] font-mono font-bold text-editorial-orange bg-editorial-orange/10 px-1.5 py-0.5 border border-editorial-orange/25">
              {streak} {streak === 1 ? 'day' : 'days'}
            </span>
          </div>

          {/* Individual Day Dot Badges (last 7 days checklist streak visualization) */}
          <div className="flex items-center justify-between gap-1 z-10 px-0.5">
            {Array.from({ length: 7 }).map((_, index) => {
              // Day index backwards: 6 is today, 0 is 6 days ago
              const dayOffset = 6 - index;
              const dateObj = new Date(selectedDate + 'T12:00:00');
              dateObj.setDate(dateObj.getDate() - dayOffset);
              const dateStr = dateObj.toISOString().split('T')[0];

              // Check if goal was met or logged on that date
              const tLogs = logs.filter(l => l.trackerId === tracker.id && l.date === dateStr);
              let wasMet = false;
              if (tLogs.length > 0) {
                let val = 0;
                if (tracker.type === 'counter') {
                  val = tLogs.reduce((sum, l) => sum + l.value, 0);
                } else {
                  val = tLogs[tLogs.length - 1].value;
                }
                const targetVal = tracker.targetValue;
                if (targetVal !== undefined && targetVal > 0) {
                  wasMet = val >= targetVal;
                } else {
                  wasMet = tLogs.length > 0;
                }
              }

              return (
                <div 
                  key={index} 
                  className="flex flex-col items-center gap-1 flex-1"
                  title={`${dateObj.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${wasMet ? 'Goal Met' : 'Not Met'}`}
                >
                  <div className="text-[7px] font-mono text-editorial-dark/40 font-bold uppercase tracking-wider">
                    {dateObj.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </div>
                  <motion.div 
                    animate={wasMet ? {
                      scale: [1, 1.15, 1],
                      rotate: [0, 4, -4, 0],
                    } : {}}
                    transition={{ duration: 0.4, delay: index * 0.04 }}
                    className={`h-4.5 w-full flex items-center justify-center border transition-all ${
                      wasMet 
                        ? 'bg-editorial-orange text-editorial-bg border-editorial-orange' 
                        : 'bg-editorial-bg/30 border-editorial-dark/10 text-editorial-dark/20'
                    }`}
                  >
                    {wasMet ? (
                      <Flame size={10} className="fill-editorial-bg" />
                    ) : (
                      <span className="w-1 h-1 rounded-full bg-editorial-dark/15" />
                    )}
                  </motion.div>
                </div>
              );
            })}
          </div>

          {/* Next major streak level milestone indicator */}
          {(() => {
            const milestones = [3, 7, 14, 30, 60, 90, 120, 150, 180, 365];
            const nextMilestone = milestones.find(m => m > streak) || (Math.floor(streak / 30) + 1) * 30;
            const prevMilestone = milestones.slice().reverse().find(m => m <= streak) || 0;
            const totalRange = nextMilestone - prevMilestone;
            const currentOffset = streak - prevMilestone;
            const milestonePercent = Math.min(Math.round((currentOffset / totalRange) * 100), 100);

            return (
              <div className="space-y-1 mt-0.5 z-10">
                <div className="flex justify-between text-[7px] font-mono text-editorial-orange/60 font-semibold uppercase tracking-wider">
                  <span>Milestone track</span>
                  <span>{streak} / {nextMilestone} days</span>
                </div>
                <div className="h-1 w-full bg-editorial-orange/15 overflow-hidden relative">
                  <motion.div
                    animate={{
                      left: ["0%", "100%", "0%"],
                      opacity: [0.2, 0.7, 0.2]
                    }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute top-0 bottom-0 w-2.5 bg-white/40 blur-xs pointer-events-none"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${milestonePercent}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="h-full bg-editorial-orange"
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Note indicator and edit note input */}
      <div className="mt-4 border-t border-editorial-dark/10 pt-3">
        <AnimatePresence initial={false}>
          {showNoteForm ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden"
            >
              <textarea
                rows={1}
                placeholder="Add daily note/comment..."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="w-full text-xs rounded-none border border-editorial-dark/20 px-3 py-1.5 bg-editorial-bg/50 focus:bg-editorial-bg outline-hidden focus:border-editorial-accent transition-colors resize-none"
              />
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowNoteForm(false);
                    setNoteText('');
                  }}
                  className="text-[10px] font-mono font-medium text-editorial-dark/60 hover:text-editorial-dark px-2 py-1 rounded-none hover:bg-editorial-accent-light"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (noteText.trim()) {
                      // If there is existing value logged, update latest log note
                      if (trackerLogs.length > 0) {
                        const latestLog = trackerLogs[trackerLogs.length - 1];
                        onLogValue(tracker.id, latestLog.value, noteText.trim());
                      } else {
                        // Log a default base value depending on tracker type with note
                        const baseVal = tracker.type === 'boolean' ? 1 : tracker.type === 'rating' ? 3 : 0;
                        onLogValue(tracker.id, baseVal, noteText.trim());
                      }
                      setShowNoteForm(false);
                      setNoteText('');
                    }
                  }}
                  className="text-[10px] font-mono font-semibold bg-editorial-dark text-editorial-bg hover:bg-editorial-accent px-2.5 py-1 rounded-none transition-colors"
                >
                  Save Note
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-between text-[11px] text-editorial-dark/50">
              <span className="italic truncate max-w-[80%] flex items-center gap-1">
                {latestLogNote ? (
                  <>
                    <MessageSquare size={12} className="text-editorial-accent shrink-0" />
                    <span className="text-editorial-dark/80 truncate">{latestLogNote}</span>
                  </>
                ) : (
                  'No notes added'
                )}
              </span>
              <button
                type="button"
                onClick={() => {
                  setNoteText(latestLogNote || '');
                  setShowNoteForm(true);
                }}
                className="text-editorial-dark/70 hover:text-editorial-dark flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider transition-colors cursor-pointer"
              >
                {latestLogNote ? 'Edit Note' : '+ Note'}
              </button>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* 30-Day History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-editorial-dark/70 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="relative w-full max-w-2xl bg-editorial-bg border border-editorial-dark/20 p-6 md:p-8 space-y-6 shadow-2xl z-10 max-h-[90vh] overflow-y-auto"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="absolute top-4 right-4 text-editorial-dark/50 hover:text-editorial-dark hover:bg-editorial-dark/5 p-1.5 transition-colors border border-transparent hover:border-editorial-dark/10 cursor-pointer"
              >
                <X size={18} />
              </button>

              {/* Modal Header */}
              <div className="flex items-center gap-3.5 border-b border-editorial-dark/10 pb-4.5 pr-8">
                <div className={`flex h-12 w-12 items-center justify-center text-white shrink-0 ${colorStyles.bg}`}>
                  <LucideIcon name={tracker.icon} size={24} />
                </div>
                <div>
                  <h3 className="font-serif font-medium text-lg text-editorial-dark">
                    {tracker.name} History
                  </h3>
                  <p className="text-xs font-mono text-editorial-dark/50 uppercase tracking-wider mt-0.5">
                    30-Day Progress Journal & Analytics
                  </p>
                </div>
              </div>

              {/* Stats Overview */}
              {(() => {
                const totalLogs = last30DaysData.filter(d => d.hasLogs).length;
                const loggedValues = last30DaysData.filter(d => d.hasLogs).map(d => d.value);
                const averageValue = loggedValues.length > 0 
                  ? Math.round((loggedValues.reduce((a, b) => a + b, 0) / loggedValues.length) * 10) / 10
                  : 0;
                const maxValue = loggedValues.length > 0 ? Math.max(...loggedValues) : 0;
                
                // Calculate target compliance rate if there is a goal
                let complianceRate = 0;
                if (tracker.targetValue !== undefined && tracker.targetValue > 0) {
                  const targetMetDays = last30DaysData.filter(d => d.hasLogs && d.value >= (tracker.targetValue ?? 0)).length;
                  complianceRate = Math.round((targetMetDays / 30) * 100);
                } else {
                  complianceRate = Math.round((totalLogs / 30) * 100);
                }

                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="border border-editorial-dark/10 p-3 bg-editorial-bg/50">
                      <span className="block text-[8px] font-mono text-editorial-dark/45 uppercase tracking-widest">Logged Days</span>
                      <p className="text-xl font-mono font-medium text-editorial-dark mt-1">
                        {totalLogs} <span className="text-[10px] font-sans font-normal text-editorial-dark/40">/ 30 d</span>
                      </p>
                    </div>
                    <div className="border border-editorial-dark/10 p-3 bg-editorial-bg/50">
                      <span className="block text-[8px] font-mono text-editorial-dark/45 uppercase tracking-widest">
                        {tracker.targetValue ? 'Goal Compliance' : 'Activity Rate'}
                      </span>
                      <p className="text-xl font-mono font-medium text-editorial-accent mt-1">
                        {complianceRate}%
                      </p>
                    </div>
                    <div className="border border-editorial-dark/10 p-3 bg-editorial-bg/50">
                      <span className="block text-[8px] font-mono text-editorial-dark/45 uppercase tracking-widest">Active Avg</span>
                      <p className="text-xl font-mono font-medium text-editorial-dark mt-1">
                        {averageValue} <span className="text-[9px] font-sans font-normal text-editorial-dark/50 lowercase">{tracker.unit || ''}</span>
                      </p>
                    </div>
                    <div className="border border-editorial-dark/10 p-3 bg-editorial-bg/50">
                      <span className="block text-[8px] font-mono text-editorial-dark/45 uppercase tracking-widest">30d Peak</span>
                      <p className="text-xl font-mono font-medium text-editorial-dark mt-1">
                        {maxValue} <span className="text-[9px] font-sans font-normal text-editorial-dark/50 lowercase">{tracker.unit || ''}</span>
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Chart Container */}
              <div className="space-y-2">
                <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-editorial-dark/45">
                  Visual History (Last 30 Days)
                </span>
                <div className="h-[220px] w-full border border-editorial-dark/10 p-4 bg-editorial-bg/50">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={last30DaysData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="var(--color-editorial-dark)" strokeOpacity={0.08} />
                      <XAxis
                        dataKey="displayDate"
                        tick={{ fontSize: 8, fill: 'var(--color-editorial-dark)', opacity: 0.5, fontFamily: 'monospace' }}
                        axisLine={false}
                        tickLine={false}
                        interval={4}
                      />
                      <YAxis
                        tick={{ fontSize: 8, fill: 'var(--color-editorial-dark)', opacity: 0.5, fontFamily: 'monospace' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-editorial-dark text-editorial-bg rounded-none p-3 shadow-md text-xs space-y-1 font-sans border border-editorial-accent/30 text-left">
                                <p className="font-mono text-[9px] text-editorial-bg/60 border-b border-editorial-bg/15 pb-1 mb-1">
                                  {new Date(data.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                </p>
                                <p className="font-serif text-xs">
                                  Value: <span className="font-mono font-bold text-editorial-accent">{data.value} {tracker.unit || ''}</span>
                                </p>
                                {!data.hasLogs && (
                                  <p className="text-[9px] text-editorial-bg/40 italic">No direct logs entered</p>
                                )}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="value"
                        stroke="#cca08a"
                        strokeWidth={2}
                        dot={({ cx, cy, payload }) => {
                          if (!payload.hasLogs) return <circle cx={cx} cy={cy} r={0} key={payload.date} />;
                          return <circle cx={cx} cy={cy} r={3.5} fill="#cca08a" stroke="#ffffff" strokeWidth={1} key={payload.date} />;
                        }}
                        activeDot={{ r: 5, fill: '#8fa89b', strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Logs Journal (Recent 30-day entries list) */}
              <div className="space-y-2">
                <span className="block text-[9px] font-mono font-bold uppercase tracking-wider text-editorial-dark/45">
                  Historical Log & Notes (Last 30 Days)
                </span>
                {(() => {
                  // Get all logs in the last 30 days for this tracker
                  const refDate = new Date(selectedDate + 'T12:00:00');
                  const d30Ago = new Date(refDate.getTime() - 29 * 24 * 60 * 60 * 1000);
                  const d30AgoStr = d30Ago.toISOString().split('T')[0];

                  const recentLogs = logs
                    .filter(l => l.trackerId === tracker.id && l.date >= d30AgoStr && l.date <= selectedDate)
                    .sort((a, b) => b.date.localeCompare(a.date));

                  if (recentLogs.length === 0) {
                    return (
                      <div className="text-center py-6 border border-dashed border-editorial-dark/15 text-editorial-dark/40 text-xs italic font-serif">
                        No entries recorded in the last 30 days.
                      </div>
                    );
                  }

                  return (
                    <div className="max-h-[160px] overflow-y-auto border border-editorial-dark/10 divide-y divide-editorial-dark/5 bg-editorial-bg/40 text-left">
                      {recentLogs.map((log, index) => {
                        const logDate = new Date(log.date + 'T12:00:00');
                        return (
                          <div key={log.id || index} className="p-2.5 flex items-start justify-between gap-3 text-xs">
                            <div className="space-y-0.5">
                              <span className="font-mono text-[9px] text-editorial-dark/45">
                                {logDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                              {log.note && (
                                <p className="text-editorial-dark/80 italic font-sans">{log.note}</p>
                              )}
                            </div>
                            <span className="font-mono font-semibold text-editorial-dark shrink-0">
                              {log.value} {tracker.unit || ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="border-t border-editorial-dark/10 pt-4 flex justify-between items-center text-[10px] font-mono text-editorial-dark/40">
                <span className="flex items-center gap-1">
                  <Info size={11} className="text-editorial-accent" />
                  <span>Showing relative 30d timeline from {new Date(selectedDate + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="font-bold uppercase tracking-wider text-editorial-dark hover:text-editorial-accent transition-colors cursor-pointer"
                >
                  Close View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
