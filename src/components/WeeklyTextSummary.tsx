/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Tracker, LogEntry, COLOR_MAP } from '../types';
import { LucideIcon } from './LucideIcon';
import { motion } from 'motion/react';
import { Sparkles, Flame, TrendingUp, Award, Calendar, BookOpen, AlertCircle } from 'lucide-react';

interface WeeklyTextSummaryProps {
  trackers: Tracker[];
  logs: LogEntry[];
  selectedDate?: string;
}

export function WeeklyTextSummary({ trackers, logs, selectedDate }: WeeklyTextSummaryProps) {
  // Use selectedDate or fall back to today's date
  const referenceDateStr = useMemo(() => {
    if (selectedDate) return selectedDate;
    return new Date().toISOString().split('T')[0];
  }, [selectedDate]);

  // Streak helper (same logic as TrackerCard)
  const calculateStreakForTracker = (tracker: Tracker, allLogs: LogEntry[], refDateStr: string) => {
    const isGoalMetOnDate = (dStr: string) => {
      const tLogs = allLogs.filter(l => l.trackerId === tracker.id && l.date === dStr);
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
      return tLogs.length > 0;
    };

    let count = 0;
    let streakCount = 0;
    let currentDateObj = new Date(refDateStr + 'T12:00:00');
    const safetyLimit = Math.max(365, allLogs.length + 5);

    const metToday = isGoalMetOnDate(refDateStr);
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
  };

  const analysis = useMemo(() => {
    const refDateObj = new Date(referenceDateStr + 'T12:00:00');
    
    // Get past 7 days (including refDate)
    const last7Days: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(refDateObj.getTime() - i * 24 * 60 * 60 * 1000);
      last7Days.push(d.toISOString().split('T')[0]);
    }

    // Get previous 7 days
    const prev7Days: string[] = [];
    for (let i = 7; i < 14; i++) {
      const d = new Date(refDateObj.getTime() - i * 24 * 60 * 60 * 1000);
      prev7Days.push(d.toISOString().split('T')[0]);
    }

    const currentWeekLogs = logs.filter(l => last7Days.includes(l.date));
    const prevWeekLogs = logs.filter(l => prev7Days.includes(l.date));

    // Calculate details for each tracker
    const trackerStats = trackers.map(tracker => {
      const thisWeekLogs = currentWeekLogs.filter(l => l.trackerId === tracker.id);
      const lastWeekLogs = prevWeekLogs.filter(l => l.trackerId === tracker.id);
      const streak = calculateStreakForTracker(tracker, logs, referenceDateStr);

      const countDiff = thisWeekLogs.length - lastWeekLogs.length;
      let pctChange = 0;
      if (lastWeekLogs.length > 0) {
        pctChange = Math.round((countDiff / lastWeekLogs.length) * 100);
      } else if (thisWeekLogs.length > 0) {
        pctChange = 100;
      }

      return {
        tracker,
        thisWeekCount: thisWeekLogs.length,
        lastWeekCount: lastWeekLogs.length,
        countDiff,
        pctChange,
        streak
      };
    });

    // 1. Highest Streak Tracker
    const sortedByStreak = [...trackerStats].sort((a, b) => b.streak - a.streak);
    const highestStreak = sortedByStreak[0]?.streak > 0 ? sortedByStreak[0] : null;

    // 2. Most Improved Tracker (highest countDiff > 0)
    const improvedTrackers = trackerStats.filter(s => s.countDiff > 0);
    const sortedByImprovement = [...improvedTrackers].sort((a, b) => {
      if (b.countDiff !== a.countDiff) {
        return b.countDiff - a.countDiff;
      }
      return b.pctChange - a.pctChange;
    });
    const mostImproved = sortedByImprovement[0] || null;

    // 3. Overall Activity Summary & Insights
    const totalCurrentLogs = currentWeekLogs.length;
    const totalPrevLogs = prevWeekLogs.length;
    const overallDiff = totalCurrentLogs - totalPrevLogs;
    let overallPct = 0;
    if (totalPrevLogs > 0) {
      overallPct = Math.round((overallDiff / totalPrevLogs) * 100);
    } else if (totalCurrentLogs > 0) {
      overallPct = 100;
    }

    // Active trackers this week vs total
    const activeTrackerIdsThisWeek = new Set(currentWeekLogs.map(l => l.trackerId));
    const activeTrackersCount = activeTrackerIdsThisWeek.size;

    return {
      trackerStats,
      highestStreak,
      mostImproved,
      totalCurrentLogs,
      totalPrevLogs,
      overallDiff,
      overallPct,
      activeTrackersCount,
      referenceDate: refDateObj
    };
  }, [trackers, logs, referenceDateStr]);

  // Generate dynamic prose/summary text based on the calculations
  const summaryProse = useMemo(() => {
    const { totalCurrentLogs, totalPrevLogs, overallDiff, activeTrackersCount, mostImproved, highestStreak } = analysis;
    
    if (trackers.length === 0) {
      return "Start by creating your first metric tracker to begin gathering weekly progress insights.";
    }

    if (totalCurrentLogs === 0) {
      return "No entries have been recorded yet for the current week. Try logging your first activity today to jumpstart your streak and generate personalized progress analytics.";
    }

    const trackerWord = activeTrackersCount === 1 ? 'tracker' : 'trackers';
    
    let text = `Throughout this week, you maintained active engagement across **${activeTrackersCount} different ${trackerWord}**, registering a total of **${totalCurrentLogs} logs**. `;

    if (overallDiff > 0) {
      text += `This marks an impressive **increase of ${overallDiff} entries** compared to the prior week, indicating substantial growth in your routine and tracking momentum. `;
    } else if (overallDiff < 0) {
      text += `While your overall log volume saw a slight decrease of ${Math.abs(overallDiff)} entries compared to last week, you successfully sustained consistency across several core habits. `;
    } else {
      text += `Your log frequency matched last week's volume perfectly with exactly ${totalCurrentLogs} entries, demonstrating a balanced and steady habit cadence. `;
    }

    if (mostImproved) {
      text += `Your most notable progress occurred with your **${mostImproved.tracker.name}** tracker, which saw the largest upswing in logging frequency (${mostImproved.thisWeekCount} logs this week, up from ${mostImproved.lastWeekCount} last week). `;
    }

    if (highestStreak && highestStreak.streak >= 3) {
      text += `Furthermore, your dedication is beautifully reflected in your **${highestStreak.tracker.name}** tracker, which is currently leading with an outstanding consecutive streak of **${highestStreak.streak} days**! `;
    } else if (highestStreak) {
      text += `You are also nurturing a fresh, promising consecutive streak of **${highestStreak.streak} days** on your **${highestStreak.tracker.name}** habit. Keep this momentum going to solidify the behavior. `;
    }

    return text;
  }, [analysis, trackers]);

  const { mostImproved, highestStreak, totalCurrentLogs, overallDiff, activeTrackersCount } = analysis;

  const getIntensityText = () => {
    if (totalCurrentLogs > 25) return "High Momentum";
    if (totalCurrentLogs > 10) return "Sustained Routine";
    if (totalCurrentLogs > 0) return "Establishing Habits";
    return "Quiescent Period";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
      className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-5"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-editorial-dark/10 pb-4.5 gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center bg-editorial-dark/5 border border-editorial-dark/10 text-editorial-dark">
            <BookOpen size={14} className="stroke-[1.5px]" />
          </div>
          <h3 className="font-serif font-medium text-base text-editorial-dark">
            Weekly Editorial Summary
          </h3>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-editorial-dark/50">
          <Calendar size={11} />
          <span>Week Ending {analysis.referenceDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>

      {trackers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center text-editorial-dark/50 border border-dashed border-editorial-dark/15 p-4">
          <AlertCircle size={24} className="mb-2 text-editorial-dark/30" />
          <p className="text-xs font-serif italic">No metric trackers defined yet.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Main prose text */}
          <div className="text-xs font-sans text-editorial-dark/85 leading-relaxed bg-editorial-accent-light/5 p-4 border-l-2 border-editorial-accent">
            <p dangerouslySetInnerHTML={{ 
              __html: summaryProse
                .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-editorial-dark">$1</strong>') 
            }} />
          </div>

          {/* Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* MOST IMPROVED METRIC BOX */}
            <div className="border border-editorial-dark/10 p-4.5 relative overflow-hidden bg-editorial-bg/50">
              <span className="block text-[8px] font-mono font-bold uppercase tracking-widest text-editorial-dark/40 mb-3 flex items-center gap-1">
                <TrendingUp size={11} className="text-emerald-600" />
                Most Improved Habit
              </span>

              {mostImproved ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center text-white ${COLOR_MAP[mostImproved.tracker.color]?.bg || 'bg-editorial-accent'} border border-editorial-dark/10`}>
                      <LucideIcon name={mostImproved.tracker.icon} size={15} />
                    </div>
                    <div>
                      <h4 className="font-serif font-medium text-sm text-editorial-dark leading-tight">
                        {mostImproved.tracker.name}
                      </h4>
                      <span className="text-[8px] font-mono text-editorial-dark/45 uppercase tracking-wider block mt-0.5">
                        {mostImproved.tracker.category}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-editorial-dark/5">
                    <div>
                      <span className="block text-[8px] font-mono text-editorial-dark/40 uppercase">This Week</span>
                      <span className="font-mono text-sm font-semibold text-editorial-dark">{mostImproved.thisWeekCount} logs</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-mono text-editorial-dark/40 uppercase">Last Week</span>
                      <span className="font-mono text-sm text-editorial-dark/60">{mostImproved.lastWeekCount} logs</span>
                    </div>
                    <div>
                      <span className="block text-[8px] font-mono text-editorial-dark/40 uppercase font-medium text-emerald-600">Growth</span>
                      <span className="font-mono text-sm font-bold text-emerald-600">
                        +{mostImproved.countDiff} ({mostImproved.pctChange}%)
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center text-center">
                  <p className="text-[11px] font-sans italic text-editorial-dark/50">
                    No upward trends compared to last week yet. Keep recording log entries daily to reveal improvements!
                  </p>
                </div>
              )}
            </div>

            {/* HIGHEST STREAK BOX */}
            <div className="border border-editorial-dark/10 p-4.5 relative overflow-hidden bg-editorial-bg/50">
              <span className="block text-[8px] font-mono font-bold uppercase tracking-widest text-editorial-dark/40 mb-3 flex items-center gap-1">
                <Flame size={11} className="text-editorial-orange fill-editorial-orange animate-bounce" />
                Highest Active Streak
              </span>

              {highestStreak ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center text-white ${COLOR_MAP[highestStreak.tracker.color]?.bg || 'bg-editorial-orange'} border border-editorial-dark/10`}>
                      <LucideIcon name={highestStreak.tracker.icon} size={15} />
                    </div>
                    <div>
                      <h4 className="font-serif font-medium text-sm text-editorial-dark leading-tight">
                        {highestStreak.tracker.name}
                      </h4>
                      <span className="text-[8px] font-mono text-editorial-dark/45 uppercase tracking-wider block mt-0.5">
                        {highestStreak.tracker.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-editorial-dark/5">
                    <div>
                      <span className="block text-[8px] font-mono text-editorial-dark/40 uppercase">Consecutive Streak</span>
                      <span className="font-mono text-sm font-bold text-editorial-orange flex items-center gap-1 mt-0.5">
                        <Flame size={13} className="fill-editorial-orange shrink-0" />
                        <span>{highestStreak.streak} {highestStreak.streak === 1 ? 'day' : 'days'}</span>
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center text-[8px] font-mono font-semibold text-editorial-orange bg-editorial-orange/10 border border-editorial-orange/20 px-2 py-0.5">
                        ACTIVE METRIC
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center text-center">
                  <p className="text-[11px] font-sans italic text-editorial-dark/50">
                    No active streaks. Meet your tracker goals or record logs on consecutive days to ignite a habit streak!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Quick takeaway summary footer */}
          <div className="flex items-center justify-between text-[10px] font-mono text-editorial-dark/40 border-t border-editorial-dark/5 pt-3">
            <span className="flex items-center gap-1.5">
              <Award size={12} className="text-editorial-accent shrink-0" />
              <span>Routine State: <strong>{getIntensityText()}</strong></span>
            </span>
            <span>{activeTrackersCount} of {trackers.length} Trackers Active</span>
          </div>
        </div>
      )}
    </motion.div>
  );
}
