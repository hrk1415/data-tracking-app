/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { Tracker, LogEntry, COLOR_MAP, CATEGORIES } from '../types';
import { LucideIcon } from './LucideIcon';
import { ActivityConsistencySnapshot } from './ActivityConsistencySnapshot';
import { WeeklyTextSummary } from './WeeklyTextSummary';
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
  Table,
  Download
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
  const [analyticsView, setAnalyticsView] = useState<'individual' | 'weekly' | 'heatmap' | 'category_baselines' | 'monthly_overview'>('individual');
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

  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const availableMonths = useMemo(() => {
    const list: { value: string; label: string }[] = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleDateString('default', { month: 'long', year: 'numeric' });
      list.push({
        value: `${year}-${month}`,
        label
      });
    }
    return list;
  }, []);

  const [selectedMonth, setSelectedMonth] = useState<string>(
    availableMonths[0]?.value || new Date().toISOString().slice(0, 7)
  );

  // Determine duration of currently selected period in days
  const periodDays = useMemo(() => {
    if (timeMode !== 'custom') {
      return parseInt(timeMode);
    }
    if (customStartDate && customEndDate) {
      const start = new Date(customStartDate + 'T00:00:00');
      const end = new Date(customEndDate + 'T00:00:00');
      return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1);
    }
    return 7;
  }, [timeMode, customStartDate, customEndDate]);

  const weeklyTrackers = useMemo(() => {
    if (selectedCategory === 'all') return trackers;
    return trackers.filter(t => t.category === selectedCategory);
  }, [trackers, selectedCategory]);

  const filteredCounterTrackers = useMemo(() => weeklyTrackers.filter(t => t.type === 'counter'), [weeklyTrackers]);
  const filteredNumericTrackers = useMemo(() => weeklyTrackers.filter(t => t.type === 'numeric'), [weeklyTrackers]);
  const filteredBooleanTrackers = useMemo(() => weeklyTrackers.filter(t => t.type === 'boolean'), [weeklyTrackers]);
  const filteredRatingTrackers = useMemo(() => weeklyTrackers.filter(t => t.type === 'rating'), [weeklyTrackers]);

  const counterTrackers = useMemo(() => trackers.filter(t => t.type === 'counter'), [trackers]);
  const numericTrackers = useMemo(() => trackers.filter(t => t.type === 'numeric'), [trackers]);
  const booleanTrackers = useMemo(() => trackers.filter(t => t.type === 'boolean'), [trackers]);
  const ratingTrackers = useMemo(() => trackers.filter(t => t.type === 'rating'), [trackers]);

  // Monthly Overview calculations
  const monthlyOverviewStats = useMemo(() => {
    if (!selectedMonth) return null;
    const [year, month] = selectedMonth.split('-').map(Number);
    const totalDays = new Date(year, month, 0).getDate();
    
    // Generate all date strings for the month (YYYY-MM-DD)
    const monthDates: string[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      monthDates.push(dateStr);
    }

    // Filter logs for this month
    const monthLogs = logs.filter(l => l.date && l.date.startsWith(selectedMonth));

    // Calculate details for each tracker
    const trackersStats = trackers.map(tracker => {
      const trackerLogs = monthLogs.filter(l => l.trackerId === tracker.id);
      const loggedDates = new Set(trackerLogs.map(l => l.date));
      const loggedDaysCount = loggedDates.size;

      // Calculate total value and average value
      let totalValue = 0;
      let averageValue = 0;

      if (tracker.type === 'counter') {
        // Counter sum
        totalValue = trackerLogs.reduce((sum, l) => sum + l.value, 0);
        averageValue = totalDays > 0 ? Math.round((totalValue / totalDays) * 10) / 10 : 0;
      } else if (tracker.type === 'boolean') {
        // Boolean sum
        totalValue = trackerLogs.filter(l => l.value > 0).length;
        averageValue = totalDays > 0 ? Math.round((totalValue / totalDays) * 100) : 0; // percentage of days completed
      } else {
        // Numeric and Rating - average of logged days
        totalValue = trackerLogs.reduce((sum, l) => sum + l.value, 0);
        averageValue = loggedDaysCount > 0 ? Math.round((totalValue / loggedDaysCount) * 10) / 10 : 0;
      }

      // Goal success rate
      let goalsMetCount = 0;
      const hasGoal = tracker.targetValue !== undefined && tracker.targetValue > 0;

      if (hasGoal) {
        monthDates.forEach(dateStr => {
          const dayLogs = trackerLogs.filter(l => l.date === dateStr);
          if (dayLogs.length > 0) {
            let dayVal = 0;
            if (tracker.type === 'counter') {
              dayVal = dayLogs.reduce((sum, l) => sum + l.value, 0);
            } else {
              dayVal = dayLogs[dayLogs.length - 1].value;
            }
            if (dayVal >= tracker.targetValue!) {
              goalsMetCount++;
            }
          }
        });
      }

      const goalSuccessRate = hasGoal ? Math.round((goalsMetCount / totalDays) * 100) : null;

      // Consecutive logging streak strictly within this month
      let longestStreak = 0;
      let currentStreak = 0;
      monthDates.forEach(dateStr => {
        if (loggedDates.has(dateStr)) {
          currentStreak++;
          if (currentStreak > longestStreak) {
            longestStreak = currentStreak;
          }
        } else {
          currentStreak = 0;
        }
      });

      return {
        ...tracker,
        totalLogs: trackerLogs.length,
        loggedDaysCount,
        averageValue,
        goalSuccessRate,
        goalsMetCount,
        longestStreak,
      };
    });

    // Overall Month Summary Stats
    const totalMonthLogsCount = monthLogs.length;
    
    // Consistency: average logging rate of all trackers
    const avgLoggingRate = trackers.length > 0
      ? Math.round((trackersStats.reduce((sum, t) => sum + (t.loggedDaysCount / totalDays), 0) / trackers.length) * 100)
      : 0;

    // Goals met across all trackers with goals
    const trackersWithGoals = trackersStats.filter(t => t.targetValue !== undefined && t.targetValue > 0);
    const totalGoalsPossible = trackersWithGoals.length * totalDays;
    const totalGoalsMet = trackersWithGoals.reduce((sum, t) => sum + t.goalsMetCount, 0);
    const overallGoalSuccessRate = totalGoalsPossible > 0
      ? Math.round((totalGoalsMet / totalGoalsPossible) * 100)
      : 0;

    // Peak Logging Day
    const dayLogCounts: Record<string, number> = {};
    monthLogs.forEach(l => {
      dayLogCounts[l.date] = (dayLogCounts[l.date] || 0) + 1;
    });

    let peakDay = 'N/A';
    let peakCount = 0;
    Object.entries(dayLogCounts).forEach(([dateStr, count]) => {
      if (count > peakCount) {
        peakCount = count;
        peakDay = dateStr;
      }
    });

    return {
      selectedMonth,
      totalDays,
      trackersStats,
      totalMonthLogsCount,
      avgLoggingRate,
      overallGoalSuccessRate,
      peakDay,
      peakCount,
    };
  }, [trackers, logs, selectedMonth]);

  const filteredMonthlyTrackerStats = useMemo(() => {
    if (!monthlyOverviewStats) return [];
    if (selectedCategory === 'all') return monthlyOverviewStats.trackersStats;
    return monthlyOverviewStats.trackersStats.filter(t => t.category === selectedCategory);
  }, [monthlyOverviewStats, selectedCategory]);

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

  // Daily average values for each tracker category over the selected range
  const categoryBaselineStats = useMemo(() => {
    return CATEGORIES.map(category => {
      // Find trackers in this category
      const catTrackers = trackers.filter(t => t.category === category.id);
      
      const trackerStats = catTrackers.map(tracker => {
        let totalValue = 0;
        let loggedDays = 0;
        
        dateRangeList.forEach(dateStr => {
          const dayLogs = logs.filter(l => l.trackerId === tracker.id && l.date === dateStr);
          if (dayLogs.length > 0) {
            loggedDays++;
            if (tracker.type === 'counter') {
              totalValue += dayLogs.reduce((sum, l) => sum + l.value, 0);
            } else {
              totalValue += dayLogs[dayLogs.length - 1].value;
            }
          }
        });
        
        let average = 0;
        if (tracker.type === 'counter') {
          average = dateRangeList.length > 0 ? Math.round((totalValue / dateRangeList.length) * 10) / 10 : 0;
        } else if (tracker.type === 'boolean') {
          average = dateRangeList.length > 0 ? Math.round((totalValue / dateRangeList.length) * 100) : 0;
        } else {
          average = loggedDays > 0 ? Math.round((totalValue / loggedDays) * 10) / 10 : 0;
        }

        // Goal completion rate
        let targetMetDays = 0;
        if (tracker.targetValue !== undefined && tracker.targetValue > 0) {
          dateRangeList.forEach(dateStr => {
            const dayLogs = logs.filter(l => l.trackerId === tracker.id && l.date === dateStr);
            let dayVal = 0;
            if (dayLogs.length > 0) {
              if (tracker.type === 'counter') {
                dayVal = dayLogs.reduce((sum, l) => sum + l.value, 0);
              } else {
                dayVal = dayLogs[dayLogs.length - 1].value;
              }
            }
            if (dayVal >= tracker.targetValue!) {
              targetMetDays++;
            }
          });
        }
        const goalSuccessRate = tracker.targetValue !== undefined && tracker.targetValue > 0 && dateRangeList.length > 0
          ? Math.round((targetMetDays / dateRangeList.length) * 100)
          : null;

        return {
          ...tracker,
          average,
          loggedDays,
          goalSuccessRate,
        };
      });

      // Calculate Category Level baseline aggregates
      const totalLogs = logs.filter(l => 
        catTrackers.some(t => t.id === l.trackerId) && 
        dateRangeList.includes(l.date)
      ).length;
      
      const avgDailyLogs = dateRangeList.length > 0 
        ? Math.round((totalLogs / dateRangeList.length) * 10) / 10 
        : 0;

      return {
        category,
        trackers: trackerStats,
        avgDailyLogs,
        totalTrackers: catTrackers.length,
      };
    });
  }, [trackers, logs, dateRangeList]);

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

  // Weekly Summary comparison calculations (past periodDays days vs previous periodDays days)
  const weeklySummaryStats = useMemo(() => {
    const today = new Date();
    
    // Get past periodDays days (including today)
    const last7Days: string[] = [];
    for (let i = 0; i < periodDays; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      last7Days.push(d.toISOString().split('T')[0]);
    }

    // Get previous periodDays days
    const prev7Days: string[] = [];
    for (let i = periodDays; i < 2 * periodDays; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      prev7Days.push(d.toISOString().split('T')[0]);
    }

    // Filter logs in last 7 days and prev 7 days for the weeklyTrackers
    const last7Logs = logs.filter(l => last7Days.includes(l.date) && weeklyTrackers.some(wt => wt.id === l.trackerId));
    const prev7Logs = logs.filter(l => prev7Days.includes(l.date) && weeklyTrackers.some(wt => wt.id === l.trackerId));

    const last7Count = last7Logs.length;
    const prev7Count = prev7Logs.length;

    const diff = last7Count - prev7Count;
    let percentChange = 0;
    if (prev7Count > 0) {
      percentChange = Math.round((diff / prev7Count) * 100);
    } else if (last7Count > 0) {
      percentChange = 100;
    }

    // Group tracker breakdowns for last period vs prev period
    const trackerBreakdown = weeklyTrackers.map(tracker => {
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
  }, [weeklyTrackers, logs, periodDays]);

  // Memoize heatmap data for all trackers
  const trackerHeatmaps = useMemo(() => {
    const today = new Date();
    
    // Find Monday of the current week
    const currentDay = today.getDay(); // 0 = Sun, 1 = Mon, ...
    const currentWeekdayIndex = currentDay === 0 ? 6 : currentDay - 1;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - currentWeekdayIndex);
    
    // Find Monday of Week 1 (3 weeks ago)
    const startMonday = new Date(currentMonday);
    startMonday.setDate(currentMonday.getDate() - 21);

    const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    return trackers.reduce((acc, tracker) => {
      // Filter logs for this tracker
      const trackerLogs = logs.filter(l => l.trackerId === tracker.id);

      // Collect daily sums and counts for relative scaling
      const dailySums: Record<string, number> = {};
      const dailyCounts: Record<string, number> = {};
      
      trackerLogs.forEach(log => {
        dailySums[log.date] = (dailySums[log.date] || 0) + log.value;
        dailyCounts[log.date] = (dailyCounts[log.date] || 0) + 1;
      });

      const allValues = Object.values(dailySums);
      const maxDayValue = allValues.length > 0 ? Math.max(...allValues) : 0;

      const grid: {
        dateStr: string;
        dayName: string;
        weekName: string;
        valueSum: number;
        logsCount: number;
        intensity: 0 | 1 | 2 | 3 | 4;
        isFuture: boolean;
        isToday: boolean;
        logs: LogEntry[];
      }[][] = [];

      for (let r = 0; r < 7; r++) {
        const rowCells = [];
        for (let c = 0; c < 4; c++) {
          // Calculate the specific date for this cell
          const cellDate = new Date(startMonday);
          cellDate.setDate(startMonday.getDate() + c * 7 + r);
          
          const dateStr = cellDate.toISOString().split('T')[0];
          const isFuture = cellDate.getTime() > today.getTime();
          const isToday = dateStr === today.toISOString().split('T')[0];

          const dayLogs = trackerLogs.filter(l => l.date === dateStr);
          const logsCount = dayLogs.length;
          
          let valueSum = 0;
          if (tracker.type === 'counter') {
            valueSum = dayLogs.reduce((sum, l) => sum + l.value, 0);
          } else if (dayLogs.length > 0) {
            // For rating/numeric, take the latest logged value on that day
            valueSum = dayLogs[dayLogs.length - 1].value;
          }

          // Compute intensity (0 to 4)
          let intensity: 0 | 1 | 2 | 3 | 4 = 0;
          if (logsCount > 0 && !isFuture) {
            if (tracker.type === 'boolean') {
              const hasTrue = dayLogs.some(l => l.value > 0);
              intensity = hasTrue ? 4 : 2;
            } else if (tracker.type === 'rating') {
              const ratingVal = valueSum;
              if (ratingVal <= 1) intensity = 1;
              else if (ratingVal <= 2) intensity = 2;
              else if (ratingVal <= 4) intensity = 3;
              else intensity = 4;
            } else {
              if (maxDayValue === 0) {
                intensity = 2;
              } else {
                const ratio = valueSum / maxDayValue;
                if (ratio <= 0.25) intensity = 1;
                else if (ratio <= 0.5) intensity = 2;
                else if (ratio <= 0.75) intensity = 3;
                else intensity = 4;
              }
            }
          }

          rowCells.push({
            dateStr,
            dayName: weekdayNames[r],
            weekName: `W${c + 1}`,
            valueSum,
            logsCount,
            intensity,
            isFuture,
            isToday,
            logs: dayLogs
          });
        }
        grid.push(rowCells);
      }

      // Filter month logs
      const monthLogs = trackerLogs.filter(l => {
        const d = new Date(l.date);
        return d >= startMonday && d <= today;
      });

      const uniqueLoggedDates = new Set(monthLogs.map(l => l.date));

      acc[tracker.id] = {
        grid,
        maxDayValue,
        totalLogsInMonth: monthLogs.length,
        activeDaysCount: uniqueLoggedDates.size
      };

      return acc;
    }, {} as Record<string, {
      grid: {
        dateStr: string;
        dayName: string;
        weekName: string;
        valueSum: number;
        logsCount: number;
        intensity: 0 | 1 | 2 | 3 | 4;
        isFuture: boolean;
        isToday: boolean;
        logs: LogEntry[];
      }[][];
      maxDayValue: number;
      totalLogsInMonth: number;
      activeDaysCount: number;
    }>);
  }, [trackers, logs]);

  // Category Trend Analysis calculations based on selected timeframe
  const categoryTrends = useMemo(() => {
    const today = new Date();
    
    // Last periodDays days
    const last7Days: string[] = [];
    for (let i = 0; i < periodDays; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      last7Days.push(d.toISOString().split('T')[0]);
    }

    // Previous periodDays days
    const prev7Days: string[] = [];
    for (let i = periodDays; i < 2 * periodDays; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      prev7Days.push(d.toISOString().split('T')[0]);
    }

    return CATEGORIES.map(cat => {
      // Get all trackers belonging to this category
      const catTrackers = trackers.filter(t => t.category === cat.id);
      const trackerIds = catTrackers.map(t => t.id);

      // Filter logs for trackers in this category
      const last7Logs = logs.filter(l => trackerIds.includes(l.trackerId) && last7Days.includes(l.date));
      const prev7Logs = logs.filter(l => trackerIds.includes(l.trackerId) && prev7Days.includes(l.date));

      const last7Count = last7Logs.length;
      const prev7Count = prev7Logs.length;

      const diff = last7Count - prev7Count;
      let percentChange = 0;
      if (prev7Count > 0) {
        percentChange = Math.round((diff / prev7Count) * 100);
      } else if (last7Count > 0) {
        percentChange = 100;
      }

      // Check for improvement/decline
      let trendStatus: 'improving' | 'declining' | 'stable' = 'stable';
      if (diff > 0) {
        trendStatus = 'improving';
      } else if (diff < 0) {
        trendStatus = 'declining';
      }

      // Calculate Goal Completion Rates if there are trackers with daily goals
      const trackersWithGoals = catTrackers.filter(t => t.targetValue !== undefined && t.targetValue > 0);
      
      let last7GoalRate: number | null = null;
      let prev7GoalRate: number | null = null;
      let goalRateDiff: number | null = null;

      if (trackersWithGoals.length > 0) {
        const getCompletionRate = (dates: string[], periodLogs: LogEntry[]) => {
          let metCount = 0;
          let totalCount = 0;

          dates.forEach(dateStr => {
            trackersWithGoals.forEach(t => {
              totalCount++;
              const dayLogs = periodLogs.filter(l => l.trackerId === t.id && l.date === dateStr);
              let totalValue = 0;
              if (t.type === 'counter') {
                totalValue = dayLogs.reduce((sum, l) => sum + l.value, 0);
              } else if (dayLogs.length > 0) {
                totalValue = dayLogs[dayLogs.length - 1].value;
              }
              if (totalValue >= t.targetValue!) {
                metCount++;
              }
            });
          });

          return totalCount > 0 ? Math.round((metCount / totalCount) * 100) : 0;
        };

        last7GoalRate = getCompletionRate(last7Days, logs);
        prev7GoalRate = getCompletionRate(prev7Days, logs);
        goalRateDiff = last7GoalRate - prev7GoalRate;
      }

      return {
        category: cat,
        trackersCount: catTrackers.length,
        last7Count,
        prev7Count,
        diff,
        percentChange,
        trendStatus,
        last7GoalRate,
        prev7GoalRate,
        goalRateDiff,
      };
    });
  }, [trackers, logs, periodDays]);

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

  // Generate and download a printable PDF report of current dashboard and trends
  const handleDownloadPDF = () => {
    const doc = new jsPDF();
    let y = 20;
    let pageCount = 2;

    const checkNewPage = (heightNeeded: number) => {
      if (y + heightNeeded > 275) {
        doc.addPage();
        y = 20;
        // Running Header on new page
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text("Personal Metrics & Trends Report", 15, 12);
        doc.text(`Page ${pageCount}`, 195, 12, { align: 'right' });
        doc.setDrawColor(220, 220, 220);
        doc.line(15, 14, 195, 14);
        y = 22;
        pageCount++;
      }
    };

    // --- TITLE BLOCK ---
    doc.setFont("times", "bold");
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text("PERSONAL METRICS & TRENDS", 15, y);
    y += 8;

    doc.setFont("times", "italic");
    doc.setFontSize(11);
    doc.setTextColor(161, 130, 74);
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    doc.text(`Generated on ${dateStr} • Client-Side Ledger & Analytics`, 15, y);
    y += 5;

    // Divider
    doc.setDrawColor(161, 130, 74);
    doc.setLineWidth(0.5);
    doc.line(15, y, 195, y);
    y += 10;

    // --- SECTION 1: OVERALL LOGGING VOLUME ---
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text("1. Overall Activity & Volume Summary", 15, y);
    y += 6;

    // Draw a nice warm background box for Overall Summary
    doc.setFillColor(249, 248, 246);
    doc.rect(15, y, 180, 28, "F");
    doc.setDrawColor(230, 225, 215);
    doc.rect(15, y, 180, 28, "S");

    // Content inside the box
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Total Active Trackers configured:`, 20, y + 8);
    doc.setFont("courier", "bold");
    doc.text(`${trackers.length}`, 85, y + 8);

    doc.setFont("helvetica", "normal");
    doc.text(`Total logged entries in database:`, 20, y + 14);
    doc.setFont("courier", "bold");
    doc.text(`${logs.length}`, 85, y + 14);

    doc.setFont("helvetica", "normal");
    doc.text(`7-Day Logging volume trends:`, 110, y + 8);
    doc.setFont("courier", "bold");
    doc.text(`${weeklySummaryStats.last7Count} logs vs ${weeklySummaryStats.prev7Count} in prior 7D`, 110, y + 14);

    const changeTxt = weeklySummaryStats.diff > 0 
      ? `+${weeklySummaryStats.percentChange}% growth (Improving)` 
      : weeklySummaryStats.diff < 0 
        ? `${weeklySummaryStats.percentChange}% decrease (Declining)` 
        : `0% change (Stable)`;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 110);
    doc.text(`Relative Growth: ${changeTxt}`, 110, y + 20);

    y += 36;

    // --- SECTION 2: CATEGORY TRENDS TABLE ---
    checkNewPage(65);
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text("2. Weekly Category Trend Analysis (Last 7 Days vs Prior 7 Days)", 15, y);
    y += 6;

    // Draw Category Trends Table Headers
    doc.setFillColor(240, 238, 233);
    doc.rect(15, y, 180, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text("Category", 18, y + 5.5);
    doc.text("Active Trackers", 55, y + 5.5);
    doc.text("Logs (7D / Prior)", 85, y + 5.5);
    doc.text("Activity Growth", 122, y + 5.5);
    doc.text("Goal Completion %", 155, y + 5.5);
    y += 8;

    categoryTrends.forEach((trend) => {
      checkNewPage(12);
      // Row background
      doc.setFillColor(253, 252, 250);
      doc.rect(15, y, 180, 8, "F");
      doc.setDrawColor(240, 240, 240);
      doc.line(15, y + 8, 195, y + 8);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      doc.text(trend.category.name, 18, y + 5.5);

      doc.setFont("courier", "normal");
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      doc.text(`${trend.trackersCount}`, 55, y + 5.5);
      doc.text(`${trend.last7Count} / ${trend.prev7Count}`, 85, y + 5.5);

      // Growth status
      let growthTxt = trend.diff > 0 ? `+${trend.percentChange}%` : `${trend.percentChange}%`;
      if (trend.diff === 0) growthTxt = "0%";
      doc.setFont("courier", "bold");
      if (trend.trendStatus === 'improving') {
        doc.setTextColor(16, 122, 87); // Emerald dark
        growthTxt += " ▲";
      } else if (trend.trendStatus === 'declining') {
        doc.setTextColor(190, 24, 74); // Rose dark
        growthTxt += " ▼";
      } else {
        doc.setTextColor(100, 100, 100);
      }
      doc.text(growthTxt, 122, y + 5.5);

      // Goal Rate
      doc.setFont("courier", "normal");
      doc.setTextColor(60, 60, 60);
      if (trend.last7GoalRate !== null) {
        let diffText = "";
        if (trend.goalRateDiff !== null && trend.goalRateDiff > 0) diffText = ` (+${trend.goalRateDiff}%)`;
        else if (trend.goalRateDiff !== null && trend.goalRateDiff < 0) diffText = ` (${trend.goalRateDiff}%)`;
        doc.text(`${trend.last7GoalRate}%${diffText}`, 155, y + 5.5);
      } else {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(140, 140, 140);
        doc.text("No active goals", 155, y + 5.5);
      }

      y += 8;
    });

    y += 10;

    // --- SECTION 3: INDIVIDUAL TRACKER PERFORMANCE ---
    checkNewPage(45);
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text("3. Individual Tracker Performance & Metric Breakdown", 15, y);
    y += 6;

    trackers.forEach((tracker, idx) => {
      // Calculate individual stats for this tracker
      const trackerLogs = logs.filter(l => l.trackerId === tracker.id);
      
      // Let's filter dates to build a basic dataset
      const today = new Date();
      const trackerDates: string[] = [];
      const numDays = 14; // Let's look at 14 days of logs
      for (let i = numDays - 1; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        trackerDates.push(d.toISOString().split('T')[0]);
      }

      const activeLogs = trackerLogs.filter(l => trackerDates.includes(l.date));
      const totalLoggedValue = activeLogs.reduce((acc, log) => acc + log.value, 0);
      const avgVal = activeLogs.length > 0 ? parseFloat((totalLoggedValue / numDays).toFixed(1)) : 0;
      
      // Calculate current streak
      let streak = 0;
      let streakDate = new Date();
      let hasLogTodayOrYesterday = false;

      // Find logs per date
      const logDatesSet = new Set(trackerLogs.map(l => l.date));
      const todayStr = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (logDatesSet.has(todayStr)) {
        hasLogTodayOrYesterday = true;
      } else if (logDatesSet.has(yesterdayStr)) {
        hasLogTodayOrYesterday = true;
        streakDate = yesterday;
      }

      if (hasLogTodayOrYesterday) {
        let currentStreakDate = streakDate;
        while (true) {
          const dateString = currentStreakDate.toISOString().split('T')[0];
          if (logDatesSet.has(dateString)) {
            streak++;
            currentStreakDate = new Date(currentStreakDate.getTime() - 86400000);
          } else {
            break;
          }
        }
      }

      // Find Best Value
      let bestValue = 0;
      let bestDate = 'N/A';
      if (trackerLogs.length > 0) {
        if (tracker.type === 'counter') {
          // Find max summed day
          const daySums: Record<string, number> = {};
          trackerLogs.forEach(l => {
            daySums[l.date] = (daySums[l.date] || 0) + l.value;
          });
          const sorted = Object.entries(daySums).sort((a, b) => b[1] - a[1]);
          if (sorted.length > 0) {
            bestValue = sorted[0][1];
            bestDate = sorted[0][0];
          }
        } else {
          const sorted = [...trackerLogs].sort((a, b) => b.value - a.value);
          bestValue = sorted[0].value;
          bestDate = sorted[0].date;
        }
      }

      checkNewPage(45);
      
      // Draw sub-header for this specific tracker
      doc.setFillColor(247, 246, 241);
      doc.rect(15, y, 180, 7, "F");
      
      doc.setFont("times", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(40, 40, 40);
      doc.text(`${idx + 1}. ${tracker.name}`, 18, y + 5);

      const catName = CATEGORIES.find(c => c.id === tracker.category)?.name || tracker.category;
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(140, 140, 140);
      doc.text(`Category: ${catName} | Type: ${tracker.type.toUpperCase()}`, 110, y + 5);

      y += 7;

      // Card border
      doc.setDrawColor(230, 225, 215);
      doc.rect(15, y, 180, 28, "S");

      // Stats inside card
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      
      // Left Column
      doc.text("Current Streak:", 20, y + 7);
      doc.setFont("courier", "bold");
      doc.text(`${streak} days`, 55, y + 7);

      doc.setFont("helvetica", "normal");
      doc.text("Total Logs (All-time):", 20, y + 14);
      doc.setFont("courier", "bold");
      doc.text(`${trackerLogs.length} times`, 55, y + 14);

      doc.setFont("helvetica", "normal");
      doc.text("Defined Goal Target:", 20, y + 21);
      doc.setFont("courier", "bold");
      doc.text(tracker.targetValue ? `${tracker.targetValue} ${tracker.unit || ''}` : "None", 55, y + 21);

      // Right Column
      doc.setFont("helvetica", "normal");
      doc.text("Peak Performance:", 105, y + 7);
      doc.setFont("courier", "bold");
      doc.text(bestValue > 0 ? `${bestValue} (${bestDate})` : "N/A", 140, y + 7);

      doc.setFont("helvetica", "normal");
      doc.text("Recent Avg (14D):", 105, y + 14);
      doc.setFont("courier", "bold");
      doc.text(`${avgVal} ${tracker.unit || ''}`, 140, y + 14);

      doc.setFont("helvetica", "normal");
      doc.text("Goal Target Met:", 105, y + 21);
      doc.setFont("courier", "bold");
      if (tracker.targetValue) {
        // Count days goal reached in last 14 days
        let metDays = 0;
        trackerDates.forEach(dateStr => {
          const dayLogs = trackerLogs.filter(l => l.date === dateStr);
          let val = 0;
          if (tracker.type === 'counter') {
            val = dayLogs.reduce((acc, l) => acc + l.value, 0);
          } else if (dayLogs.length > 0) {
            val = dayLogs[dayLogs.length - 1].value;
          }
          if (val >= tracker.targetValue!) metDays++;
        });
        const pct = Math.round((metDays / numDays) * 100);
        doc.text(`${metDays}/${numDays} days (${pct}%)`, 140, y + 21);
      } else {
        doc.text("N/A", 140, y + 21);
      }

      y += 33;
    });

    // Footer signature / disclaimer on final page
    checkNewPage(15);
    y += 5;
    doc.setDrawColor(240, 240, 240);
    doc.line(15, y, 195, y);
    y += 6;
    doc.setFont("times", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(140, 140, 140);
    doc.text("This report is generated locally and stored securely on your client-side ledger.", 15, y);
    doc.text("Data Tracker © 2026. All rights reserved.", 195, y, { align: 'right' });

    // Save PDF
    doc.save(`Metrics_Report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Calculate dynamic data for all trackers to use in "Weekly Trends" view based on selected timeframe
  const last7DaysData = useMemo(() => {
    const list = [...dateRangeList];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return list.map(dateStr => {
      const parts = dateStr.split('-');
      const mIndex = parseInt(parts[1]) - 1;
      const displayDate = `${monthNames[mIndex]} ${parts[2]}`;

      const dataPoint: any = {
        date: dateStr,
        displayDate,
      };

      weeklyTrackers.forEach(tracker => {
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
  }, [weeklyTrackers, logs, dateRangeList]);

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
              Add a metric with this tracker type to visualize its progress over the selected timeframe!
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-editorial-dark/15 pb-px gap-4">
        <div className="flex flex-wrap">
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
            {timeMode === '7' ? 'Weekly Trends (7D)' : timeMode === '30' ? 'Monthly Trends (30D)' : timeMode === '90' ? 'Quarterly Trends (90D)' : 'Custom Trends'}
          </button>
          <button
            type="button"
            id="tab-heatmap-view"
            onClick={() => setAnalyticsView('heatmap')}
            className={`px-5 py-2.5 border-b-2 font-serif text-sm font-medium transition-all cursor-pointer ${
              analyticsView === 'heatmap'
                ? 'border-editorial-accent text-editorial-accent'
                : 'border-transparent text-editorial-dark/60 hover:text-editorial-dark hover:border-editorial-dark/10'
            }`}
          >
            Weekly Habit Heatmap
          </button>
          <button
            type="button"
            id="tab-category-baselines"
            onClick={() => setAnalyticsView('category_baselines')}
            className={`px-5 py-2.5 border-b-2 font-serif text-sm font-medium transition-all cursor-pointer ${
              analyticsView === 'category_baselines'
                ? 'border-editorial-accent text-editorial-accent'
                : 'border-transparent text-editorial-dark/60 hover:text-editorial-dark hover:border-editorial-dark/10'
            }`}
          >
            Category Baselines
          </button>
          <button
            type="button"
            id="tab-monthly-overview"
            onClick={() => setAnalyticsView('monthly_overview')}
            className={`px-5 py-2.5 border-b-2 font-serif text-sm font-medium transition-all cursor-pointer ${
              analyticsView === 'monthly_overview'
                ? 'border-editorial-accent text-editorial-accent'
                : 'border-transparent text-editorial-dark/60 hover:text-editorial-dark hover:border-editorial-dark/10'
            }`}
          >
            Monthly Overview
          </button>
        </div>

        <div className="pb-2.5 sm:pb-0 flex shrink-0">
          <button
            type="button"
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 border border-editorial-dark/20 hover:border-editorial-accent text-editorial-dark hover:text-editorial-accent px-4 py-1.5 text-xs font-mono font-medium transition-all cursor-pointer bg-editorial-bg shadow-xs"
            title="Download Printable PDF Report"
          >
            <Download size={14} className="stroke-[1.5px] text-editorial-accent" />
            <span>Download PDF Report</span>
          </button>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-editorial-bg p-4 border border-editorial-dark/15 rounded-none shadow-xs">
        {/* Timeframe Dropdown Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-mono font-medium text-editorial-dark/50 uppercase tracking-wider shrink-0">Timeframe:</span>
          <div className="relative">
            <select
              id="analytics-timeframe-select"
              value={timeMode}
              onChange={(e) => setTimeMode(e.target.value as TimeMode)}
              className="appearance-none rounded-none border border-editorial-dark/20 bg-editorial-bg pl-4 pr-10 py-1.5 text-xs font-serif font-medium text-editorial-dark focus:border-editorial-accent transition-all outline-hidden cursor-pointer"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
              <option value="custom">Custom Range</option>
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-editorial-dark/50 pointer-events-none" size={13} />
          </div>

          {/* Custom Date Inputs */}
          {timeMode === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 border border-editorial-dark/15 bg-editorial-bg/50 p-1">
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

        {/* Category Filter */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-medium text-editorial-dark/50 uppercase tracking-wider shrink-0">Category:</span>
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none rounded-none border border-editorial-dark/20 bg-editorial-bg pl-4 pr-10 py-1.5 text-xs font-serif font-medium text-editorial-dark focus:border-editorial-accent transition-all outline-hidden cursor-pointer"
            >
              <option value="all">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-editorial-dark/50 pointer-events-none" size={13} />
          </div>
        </div>
      </div>

      {/* 7-Day Activity Consistency Snapshot (Weekly Bar Chart) */}
      <ActivityConsistencySnapshot logs={logs} />

      {/* Weekly Text-Based Editorial Progress Summary */}
      <WeeklyTextSummary trackers={trackers} logs={logs} />

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
      <div className="bg-editorial-bg p-5 rounded-none border border-editorial-dark/15">
        {/* Tracker Selection Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-medium text-editorial-dark/50 uppercase tracking-wider shrink-0">Metrics for:</span>
            <div className="relative">
              <select
                value={selectedTrackerId}
                onChange={(e) => setSelectedTrackerId(e.target.value)}
                className="appearance-none rounded-none border border-editorial-dark/20 bg-editorial-bg pl-4 pr-10 py-2 text-sm font-serif font-medium text-editorial-dark focus:border-editorial-accent transition-all outline-hidden cursor-pointer"
              >
                {weeklyTrackers.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-editorial-dark/50 pointer-events-none" size={15} />
            </div>
          </div>
          <span className="text-xs font-sans italic text-editorial-dark/50">
            Currently analyzing data across the active {periodDays}-day timeframe
          </span>
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

      {/* Individual Tracker Heatmap Section */}
      <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-4">
        <div className="flex items-center gap-2.5 border-b border-editorial-dark/10 pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-editorial-accent-light border border-editorial-accent/20 text-editorial-accent">
            <Calendar size={20} className="stroke-[1.5px]" />
          </div>
          <div>
            <h3 className="font-serif font-medium text-lg text-editorial-dark">
              Past Month Consistency (7x4 Habit Grid)
            </h3>
            <p className="text-xs font-sans italic text-editorial-dark/60 mt-0.5">
              Visualize completion frequency and intensity for <strong>{selectedTracker.name}</strong> over the past 28 days
            </p>
          </div>
        </div>

        {/* Heatmap implementation for single tracker */}
        {(() => {
          const heatmap = trackerHeatmaps[selectedTracker.id];
          if (!heatmap) return null;
          const { grid, totalLogsInMonth, activeDaysCount } = heatmap;
          const consistencyRate = Math.round((activeDaysCount / 28) * 100);

          return (
            <div className="flex flex-col md:flex-row items-center gap-8 justify-between p-4 bg-editorial-dark/[0.01]">
              <div className="flex gap-4 items-center">
                {/* Weekday labels */}
                <div className="flex flex-col justify-between text-[10px] font-mono text-editorial-dark/45 py-2 select-none h-44">
                  <span>M</span>
                  <span>T</span>
                  <span>W</span>
                  <span>T</span>
                  <span>F</span>
                  <span>S</span>
                  <span>S</span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, colIdx) => {
                    const weekLabels = ["3W Ago", "2W Ago", "Last Wk", "This Wk"];
                    return (
                      <div key={colIdx} className="flex flex-col gap-2">
                        <span className="text-[9px] font-mono text-editorial-dark/40 text-center uppercase tracking-wider mb-1">
                          {weekLabels[colIdx]}
                        </span>
                        {Array.from({ length: 7 }).map((_, rowIdx) => {
                          const cell = grid[rowIdx][colIdx];
                          if (!cell) return null;

                          let cellStyle: React.CSSProperties = {};
                          let cellClasses = "w-8 h-8 transition-all border cursor-help";

                          if (cell.isFuture) {
                            cellClasses += " bg-editorial-dark/[0.01] border-editorial-dark/5 opacity-20 cursor-not-allowed";
                          } else if (cell.intensity === 0) {
                            cellClasses += " bg-editorial-dark/[0.04] border-editorial-dark/10 hover:border-editorial-dark/30";
                          } else {
                            cellClasses += " border-editorial-dark/15 hover:scale-105 hover:shadow-xs";
                            let opacity = 0.2;
                            if (cell.intensity === 2) opacity = 0.45;
                            if (cell.intensity === 3) opacity = 0.75;
                            if (cell.intensity === 4) opacity = 1.0;

                            cellStyle = {
                              backgroundColor: `var(--editorial-${selectedTracker.color})`,
                              opacity: opacity,
                            };
                          }

                          if (cell.isToday) {
                            cellClasses += " ring-2 ring-editorial-accent ring-offset-2";
                          }

                          let tooltipMsg = `${cell.dayName}, ${new Date(cell.dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                          if (cell.isFuture) {
                            tooltipMsg += " (Future)";
                          } else if (cell.logsCount === 0) {
                            tooltipMsg += " (No logs)";
                          } else {
                            tooltipMsg += `: Logged ${cell.logsCount} time(s). `;
                            if (selectedTracker.type === 'counter') {
                              tooltipMsg += `Total: ${cell.valueSum} ${selectedTracker.unit || ''}`;
                            } else if (selectedTracker.type === 'rating') {
                              tooltipMsg += `Rating: ${cell.valueSum}/5`;
                            } else if (selectedTracker.type === 'boolean') {
                              tooltipMsg += cell.valueSum > 0 ? "Completed" : "Logged";
                            } else {
                              tooltipMsg += `Value: ${cell.valueSum} ${selectedTracker.unit || ''}`;
                            }
                          }

                          return (
                            <div
                              key={rowIdx}
                              className={cellClasses}
                              style={cellStyle}
                              title={tooltipMsg}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Sidebar stats card */}
              <div className="flex-1 max-w-sm w-full border border-editorial-dark/10 bg-editorial-bg p-5 flex flex-col justify-between space-y-4">
                <div>
                  <h4 className="font-serif font-medium text-base text-editorial-dark mb-1">Consistency Statistics</h4>
                  <p className="text-xs font-sans italic text-editorial-dark/60">Aggregated logs from the past 28 days</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-editorial-dark/60 font-sans">Active Days</span>
                    <span className="font-mono font-bold text-editorial-dark">{activeDaysCount} / 28 days</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-editorial-dark/60 font-sans">Consistency Rate</span>
                    <span className="font-mono font-bold text-editorial-dark">{consistencyRate}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-editorial-dark/60 font-sans">Total Logs Saved</span>
                    <span className="font-mono font-bold text-editorial-dark">{totalLogsInMonth} logs</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="w-full bg-editorial-dark/10 h-1.5 rounded-none overflow-hidden">
                    <div 
                      className={`h-full ${colorStyles.bg}`} 
                      style={{ width: `${consistencyRate}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-mono text-editorial-dark/45">
                    <span>Less</span>
                    <div className="flex items-center gap-1 select-none">
                      <span className="w-2 h-2 bg-editorial-dark/[0.04] border border-editorial-dark/10" />
                      <span className="w-2 h-2" style={{ backgroundColor: `var(--editorial-${selectedTracker.color})`, opacity: 0.2 }} />
                      <span className="w-2 h-2" style={{ backgroundColor: `var(--editorial-${selectedTracker.color})`, opacity: 0.45 }} />
                      <span className="w-2 h-2" style={{ backgroundColor: `var(--editorial-${selectedTracker.color})`, opacity: 0.75 }} />
                      <span className="w-2 h-2" style={{ backgroundColor: `var(--editorial-${selectedTracker.color})`, opacity: 1.0 }} />
                    </div>
                    <span>More</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
        </>
      ) : analyticsView === 'weekly' ? (
        /* Weekly Trends Grid View */
        <div className="space-y-6">
          <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-editorial-accent-light border border-editorial-accent/20 text-editorial-accent">
                <Activity size={20} className="stroke-[1.5px]" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-lg text-editorial-dark">
                  {timeMode === '7' ? 'Weekly' : timeMode === '30' ? 'Monthly' : timeMode === '90' ? 'Quarterly' : 'Custom'} Trends ({periodDays}-Day Progress)
                </h3>
                <p className="text-xs font-sans italic text-editorial-dark/60 mt-0.5">
                  Compare multi-tracker progress side-by-side grouped by metric type for the past {periodDays} days
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
                  {periodDays}-Day Aggregated Volume
                </span>
                <h4 className="font-serif font-medium text-xl text-editorial-dark leading-tight">
                  Log Entry Activity
                </h4>
                <p className="text-xs font-sans italic text-editorial-dark/60 mt-1">
                  Comparing all logged tracker entries for the current period against the prior period of the same length
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
                    vs. {weeklySummaryStats.prev7Count} in previous {periodDays}D
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
                  Log frequency per tracker (last {periodDays} days vs previous {periodDays} days)
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
                            {last7} <span className="text-[10px] text-editorial-dark/40">/ {periodDays}d</span>
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

          {/* Weekly Category Trend Analysis */}
          <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-5">
            <div>
              <h4 className="font-serif font-medium text-lg text-editorial-dark flex items-center gap-2">
                {timeMode === '7' ? 'Weekly' : timeMode === '30' ? 'Monthly' : timeMode === '90' ? 'Quarterly' : 'Custom'} Category Trend Analysis
                <span className="inline-flex items-center text-[9px] font-mono text-editorial-accent bg-editorial-accent-light border border-editorial-accent/25 px-2 py-0.5 rounded-none">
                  Last {periodDays} Days vs Prior {periodDays} Days
                </span>
              </h4>
              <p className="text-xs font-sans italic text-editorial-dark/60 mt-1">
                Calculates percentage growth and target goal progress trends for each tracker category compared to the prior period of the same length
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryTrends.map(({ category, trackersCount, last7Count, prev7Count, diff, percentChange, trendStatus, last7GoalRate, prev7GoalRate, goalRateDiff }) => {
                const colorStyles = COLOR_MAP[category.color] || COLOR_MAP.emerald;
                
                return (
                  <div 
                    key={category.id} 
                    className="p-5 bg-editorial-bg border border-editorial-dark/12 flex flex-col justify-between hover:border-editorial-dark/30 transition-all space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex items-center justify-between gap-2 border-b border-editorial-dark/5 pb-3">
                      <div className="flex items-center gap-2.5 truncate">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-none text-white ${colorStyles.bg} border border-editorial-dark/10`}>
                          <LucideIcon name={category.icon} size={15} />
                        </div>
                        <span className="font-serif font-semibold text-sm text-editorial-dark truncate">
                          {category.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-editorial-dark/45 uppercase tracking-wider shrink-0">
                        {trackersCount} {trackersCount === 1 ? 'tracker' : 'trackers'}
                      </span>
                    </div>

                    {/* Middle Section: Logging Volume Trend */}
                    <div className="space-y-1.5">
                      <span className="block text-[9px] font-mono font-semibold uppercase tracking-widest text-editorial-dark/40">
                        Logging Activity Volume
                      </span>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-2xl font-mono font-light text-editorial-dark">
                            {diff > 0 ? `+${percentChange}%` : `${percentChange}%`}
                          </span>
                          <span className="text-[10px] font-mono text-editorial-dark/50">growth</span>
                        </div>

                        {/* Trend Status Badge */}
                        {trendStatus === 'improving' ? (
                          <div className="inline-flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 text-[10px] font-mono font-semibold px-2 py-0.5">
                            <TrendingUp size={12} className="stroke-[2.5px] text-emerald-700" />
                            <span>Improving</span>
                          </div>
                        ) : trendStatus === 'declining' ? (
                          <div className="inline-flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 text-rose-800 text-[10px] font-mono font-semibold px-2 py-0.5">
                            <TrendingDown size={12} className="stroke-[2.5px] text-rose-700" />
                            <span>Declining</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1 bg-editorial-dark/5 border border-editorial-dark/10 text-editorial-dark/50 text-[10px] font-mono px-2 py-0.5">
                            <span>Stable</span>
                          </div>
                        )}
                      </div>

                      <div className="text-[11px] font-sans text-editorial-dark/65 flex justify-between">
                        <span>Selected Period: <strong className="font-mono text-editorial-dark">{last7Count}</strong> logs</span>
                        <span className="text-editorial-dark/40">vs {prev7Count} prior</span>
                      </div>
                    </div>

                    {/* Bottom Section: Target Goal Progress Trend */}
                    <div className="pt-3 border-t border-editorial-dark/5 bg-editorial-dark/[0.01] -mx-5 -mb-5 p-4 mt-auto">
                      <span className="block text-[9px] font-mono font-semibold uppercase tracking-widest text-editorial-dark/45 mb-1.5">
                        Target Habit Success
                      </span>

                      {last7GoalRate !== null ? (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-serif font-medium text-editorial-dark">
                              Goal Success Rate: <span className="font-mono text-editorial-accent font-bold">{last7GoalRate}%</span>
                            </span>
                            
                            {/* Visual Comparison Indicator */}
                            {goalRateDiff !== null && goalRateDiff > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-500/5 px-1.5 py-0.5 border border-emerald-500/10">
                                ▲ +{goalRateDiff}%
                              </span>
                            ) : goalRateDiff !== null && goalRateDiff < 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-bold text-rose-700 bg-rose-500/5 px-1.5 py-0.5 border border-rose-500/10">
                                ▼ {goalRateDiff}%
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] font-mono text-editorial-dark/45 bg-editorial-dark/5 px-1.5 py-0.5">
                                Stable (0%)
                              </span>
                            )}
                          </div>
                          <div className="w-full bg-editorial-dark/10 h-1.5 rounded-none overflow-hidden">
                            <div 
                              className={`h-full ${colorStyles.bg}`} 
                              style={{ width: `${last7GoalRate}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-[9px] font-mono text-editorial-dark/40">
                            <span>Prior period: {prev7GoalRate}% success</span>
                            {goalRateDiff !== null && (
                              <span>
                                {goalRateDiff > 0 ? 'Improving trend' : goalRateDiff < 0 ? 'Declining trend' : 'Consistent performance'}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] font-sans italic text-editorial-dark/40 block py-1">
                          No active daily goals configured
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {renderTypeTrendChart(
              'Counters & Tallies',
              'Sum of daily logged entries (e.g. water, reps)',
              filteredCounterTrackers
            )}
            {renderTypeTrendChart(
              'Numeric Metrics',
              'Last logged daily numerical value (e.g. weight, sleep hours)',
              filteredNumericTrackers
            )}
            {renderTypeTrendChart(
              'Habits & Booleans',
              'Daily completion status (Yes/No status)',
              filteredBooleanTrackers,
              [0, 1],
              [0, 1],
              true
            )}
            {renderTypeTrendChart(
              'Ratings & Quality',
              'Subjective daily rating scale (1-5 quality metric)',
              filteredRatingTrackers,
              [1, 5],
              [1, 2, 3, 4, 5]
            )}
          </div>
        </div>
      ) : analyticsView === 'category_baselines' ? (
        /* Category Baselines View */
        <div className="space-y-8">
          {/* Header Block */}
          <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15">
            <h3 className="font-serif font-medium text-lg text-editorial-dark">
              Category Daily Baselines & Performance
            </h3>
            <p className="text-xs font-sans italic text-editorial-dark/60 mt-1">
              Analyze your baseline daily averages, goal accomplishment ratios, and log consistency grouped by tracker category over the selected {periodDays}-day period.
            </p>
          </div>

          {/* Grid of Categories */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {categoryBaselineStats.map(({ category, trackers: catTrackers, avgDailyLogs, totalTrackers }) => {
              const themeColor = category.color; // e.g. emerald, blue, indigo, violet, amber, rose
              
              return (
                <div 
                  key={category.id} 
                  className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex flex-col justify-between"
                  style={{
                    borderLeft: `3px solid var(--editorial-${themeColor}, #c7b38f)`
                  }}
                >
                  <div className="space-y-5">
                    {/* Category Header */}
                    <div className="flex items-center justify-between border-b border-editorial-dark/5 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none"
                          style={{
                            backgroundColor: `var(--editorial-${themeColor}-light, #f7f5f0)`,
                            color: `var(--editorial-${themeColor}, #c7b38f)`,
                            border: `1px solid var(--editorial-${themeColor}-border, rgba(0,0,0,0.1))`
                          }}
                        >
                          <LucideIcon name={category.icon} size={16} />
                        </div>
                        <div>
                          <h4 className="font-serif font-medium text-sm text-editorial-dark">
                            {category.name}
                          </h4>
                          <span className="text-[10px] font-mono text-editorial-dark/45 uppercase tracking-wider">
                            {totalTrackers} {totalTrackers === 1 ? 'Tracker' : 'Trackers'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className="inline-flex items-center text-[10px] font-mono font-medium text-editorial-dark/65 bg-editorial-dark/5 border border-editorial-dark/10 px-2 py-0.5">
                          Avg {avgDailyLogs} logs / day
                        </span>
                      </div>
                    </div>

                    {/* Trackers List */}
                    <div className="space-y-4">
                      {catTrackers.length === 0 ? (
                        <div className="py-6 text-center border border-dashed border-editorial-dark/10 bg-editorial-dark/[0.01]">
                          <p className="text-xs font-sans italic text-editorial-dark/40">
                            No trackers configured in this category
                          </p>
                        </div>
                      ) : (
                        catTrackers.map(tracker => {
                          const isBoolean = tracker.type === 'boolean';
                          const isRating = tracker.type === 'rating';
                          const isCounter = tracker.type === 'counter';
                          const hasGoal = tracker.targetValue !== undefined && tracker.targetValue > 0;

                          return (
                            <div key={tracker.id} className="border-b border-editorial-dark/5 pb-3.5 last:border-0 last:pb-0">
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-2">
                                  <span 
                                    className="w-1.5 h-1.5 rounded-none" 
                                    style={{ backgroundColor: `var(--editorial-${tracker.color})` }}
                                  />
                                  <div>
                                    <span className="text-xs font-sans font-medium text-editorial-dark">
                                      {tracker.name}
                                    </span>
                                    <span className="text-[9px] font-mono text-editorial-dark/40 block">
                                      Type: {tracker.type}
                                    </span>
                                  </div>
                                </div>

                                <div className="text-right">
                                  <div className="text-xs font-mono font-bold text-editorial-dark">
                                    {isBoolean ? (
                                      <span>{tracker.average}% completion</span>
                                    ) : isRating ? (
                                      <span>{tracker.average} <span className="text-[10px] text-editorial-dark/45 font-normal">/ 5 avg</span></span>
                                    ) : (
                                      <span>{tracker.average} <span className="text-[10px] text-editorial-dark/45 font-normal">{tracker.unit || ''} / day</span></span>
                                    )}
                                  </div>
                                  <span className="text-[9px] font-sans text-editorial-dark/40 block">
                                    Logged {tracker.loggedDays} of {periodDays} days
                                  </span>
                                </div>
                              </div>

                              {/* Goal Success Tracker */}
                              {hasGoal && (
                                <div className="mt-2 space-y-1 bg-editorial-dark/[0.01] border border-editorial-dark/5 p-2">
                                  <div className="flex justify-between text-[9px] font-mono text-editorial-dark/50">
                                    <span>Target: &ge; {tracker.targetValue} {tracker.unit || ''}</span>
                                    <span className="font-bold text-editorial-dark">{tracker.goalSuccessRate}% success</span>
                                  </div>
                                  <div className="w-full bg-editorial-dark/10 h-1">
                                    <div 
                                      className="h-full" 
                                      style={{ 
                                        width: `${tracker.goalSuccessRate}%`,
                                        backgroundColor: `var(--editorial-${tracker.color})`
                                      }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : analyticsView === 'monthly_overview' ? (
        /* Monthly Overview View */
        <div className="space-y-8">
          {/* Header Block with Month Picker inside */}
          <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-serif font-medium text-lg text-editorial-dark">
                Monthly Performance Overview
              </h3>
              <p className="text-xs font-sans italic text-editorial-dark/60 mt-1">
                A calendar-month comprehensive audit of your daily averages, consistency ratios, and consecutive streaks.
              </p>
            </div>
            {/* Month Dropdown Select */}
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-mono font-medium text-editorial-dark/50 uppercase tracking-wider">Select Month:</span>
              <div className="relative">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="appearance-none rounded-none border border-editorial-dark/20 bg-editorial-bg pl-4 pr-10 py-1.5 text-xs font-serif font-medium text-editorial-dark focus:border-editorial-accent transition-all outline-hidden cursor-pointer"
                >
                  {availableMonths.map(m => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 text-editorial-dark/50 pointer-events-none" size={13} />
              </div>
            </div>
          </div>

          {monthlyOverviewStats ? (
            <>
              {/* KPIs Summary Bento Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Monthly Logs Card */}
                <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none bg-editorial-accent-light border border-editorial-accent/20 text-editorial-accent">
                      <Activity size={22} className="stroke-[1.5px]" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-wider">Total Month Logs</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-mono font-light text-editorial-dark leading-none">
                          {monthlyOverviewStats.totalMonthLogsCount}
                        </span>
                        <span className="text-xs font-serif italic text-editorial-dark/75">entries</span>
                      </div>
                      <div className="text-[9px] font-mono text-editorial-dark/60 mt-1">
                        {monthlyOverviewStats.peakCount > 0 ? (
                          <span>Peak: {new Date(monthlyOverviewStats.peakDay + 'T12:00:00').toLocaleDateString('default', { month: 'short', day: 'numeric' })} ({monthlyOverviewStats.peakCount} logs)</span>
                        ) : (
                          <span>No logs recorded yet</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overall Logging Consistency Score Card */}
                <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none bg-editorial-emerald-light border border-editorial-emerald/20 text-editorial-emerald">
                      <CheckCircle2 size={22} className="stroke-[1.5px]" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-wider">Logging Consistency</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-mono font-light text-editorial-dark leading-none">
                          {monthlyOverviewStats.avgLoggingRate}%
                        </span>
                      </div>
                      <div className="text-[9px] font-mono text-editorial-dark/60 mt-1">
                        <span>Avg logging days across trackers</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Overall Goal Success Card */}
                <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none bg-editorial-amber-light border border-editorial-amber/20 text-editorial-amber">
                      <Award size={22} className="stroke-[1.5px]" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-wider">Goal Achievement</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-mono font-light text-editorial-dark leading-none">
                          {monthlyOverviewStats.overallGoalSuccessRate}%
                        </span>
                      </div>
                      <div className="text-[9px] font-mono text-editorial-dark/60 mt-1">
                        <span>Percent of daily targets met</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Days of Month Card */}
                <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none bg-editorial-blue-light border border-editorial-blue/20 text-editorial-blue">
                      <Calendar size={22} className="stroke-[1.5px]" />
                    </div>
                    <div>
                      <span className="block text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-wider">Month Duration</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-3xl font-mono font-light text-editorial-dark leading-none">
                          {monthlyOverviewStats.totalDays}
                        </span>
                        <span className="text-xs font-serif italic text-editorial-dark/75">days</span>
                      </div>
                      <div className="text-[9px] font-mono text-editorial-dark/60 mt-1">
                        <span>Month of {availableMonths.find(m => m.value === selectedMonth)?.label || selectedMonth}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Performance Metrics Table */}
              <div className="bg-editorial-bg rounded-none border border-editorial-dark/15 overflow-hidden">
                <div className="px-6 py-4.5 border-b border-editorial-dark/10 flex items-center justify-between bg-editorial-dark/[0.01]">
                  <h4 className="font-serif font-medium text-sm text-editorial-dark">
                    Detailed Tracker Performance
                  </h4>
                  {selectedCategory !== 'all' && (
                    <span className="text-[10px] font-mono text-editorial-accent bg-editorial-accent-light border border-editorial-accent/20 px-2 py-0.5 uppercase tracking-wider">
                      Category: {CATEGORIES.find(c => c.id === selectedCategory)?.name}
                    </span>
                  )}
                </div>

                {filteredMonthlyTrackerStats.length === 0 ? (
                  <div className="p-12 text-center">
                    <Info size={28} className="mx-auto text-editorial-dark/35 mb-2.5 stroke-[1.25px]" />
                    <p className="text-sm font-serif italic text-editorial-dark/60">
                      No active trackers match your selected filters for this month.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-editorial-dark/10 text-[10px] font-mono text-editorial-dark/50 uppercase tracking-wider bg-editorial-dark/[0.02]">
                          <th className="py-3 px-6 font-medium">Tracker & Category</th>
                          <th className="py-3 px-4 font-medium text-center">Metric Type</th>
                          <th className="py-3 px-4 font-medium text-right">Total Logs</th>
                          <th className="py-3 px-4 font-medium text-right">Daily Avg Value</th>
                          <th className="py-3 px-4 font-medium text-center">Logging Days</th>
                          <th className="py-3 px-4 font-medium text-center">Longest Streak</th>
                          <th className="py-3 px-6 font-medium text-right">Goal Rate</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-editorial-dark/5 text-xs font-sans text-editorial-dark">
                        {filteredMonthlyTrackerStats.map(tracker => {
                          const cat = CATEGORIES.find(c => c.id === tracker.category);
                          const isBoolean = tracker.type === 'boolean';
                          const isRating = tracker.type === 'rating';
                          const isCounter = tracker.type === 'counter';
                          const loggingPercent = Math.round((tracker.loggedDaysCount / monthlyOverviewStats.totalDays) * 100);
                          
                          // Determine baseline consistency tag
                          let consistencyStatus = 'Needs Focus';
                          let consistencyColor = 'text-rose-700 bg-rose-50 border-rose-100';
                          if (loggingPercent >= 80) {
                            consistencyStatus = 'Highly Consistent';
                            consistencyColor = 'text-emerald-700 bg-emerald-50 border-emerald-100';
                          } else if (loggingPercent >= 40) {
                            consistencyStatus = 'Moderately Consistent';
                            consistencyColor = 'text-amber-700 bg-amber-50 border-amber-100';
                          }

                          return (
                            <tr key={tracker.id} className="hover:bg-editorial-dark/[0.01] transition-colors">
                              {/* Tracker Name & Category */}
                              <td className="py-4 px-6">
                                <div className="flex items-center gap-2.5">
                                  <span 
                                    className="w-2.5 h-2.5 shrink-0" 
                                    style={{ backgroundColor: `var(--editorial-${tracker.color})` }}
                                  />
                                  <div>
                                    <div className="font-medium text-editorial-dark">{tracker.name}</div>
                                    <div className="text-[10px] text-editorial-dark/55 font-serif italic mt-0.5">
                                      {cat?.name || 'Uncategorized'}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Metric Type */}
                              <td className="py-4 px-4 text-center">
                                <span className="inline-block text-[10px] font-mono text-editorial-dark/60 bg-editorial-dark/5 px-2 py-0.5 border border-editorial-dark/10 capitalize rounded-none">
                                  {tracker.type}
                                </span>
                              </td>

                              {/* Total Logs */}
                              <td className="py-4 px-4 text-right font-mono font-medium">
                                {tracker.totalLogs}
                              </td>

                              {/* Daily Avg Value */}
                              <td className="py-4 px-4 text-right font-mono font-bold">
                                {isBoolean ? (
                                  <span>{tracker.averageValue}% completion</span>
                                ) : isRating ? (
                                  <span>{tracker.averageValue} / 5</span>
                                ) : (
                                  <span>{tracker.averageValue} <span className="text-[10px] font-normal text-editorial-dark/55">{tracker.unit || ''}</span></span>
                                )}
                              </td>

                              {/* Logging Consistency Days & Badge */}
                              <td className="py-4 px-4">
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <span className="font-mono font-medium text-[11px]">
                                    {tracker.loggedDaysCount} / {monthlyOverviewStats.totalDays} days
                                  </span>
                                  <span className={`text-[9px] font-mono px-1.5 py-0.5 border ${consistencyColor}`}>
                                    {consistencyStatus}
                                  </span>
                                </div>
                              </td>

                              {/* Streak */}
                              <td className="py-4 px-4 text-center">
                                <div className="inline-flex items-center gap-1 text-[11px] font-mono font-medium text-editorial-orange bg-editorial-orange-light border border-editorial-orange/20 px-2 py-0.5">
                                  <Flame size={11} className="fill-editorial-orange/15" />
                                  <span>{tracker.longestStreak}d max</span>
                                </div>
                              </td>

                              {/* Goal rate */}
                              <td className="py-4 px-6 text-right">
                                {tracker.goalSuccessRate !== null ? (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="font-mono font-bold text-editorial-accent">
                                      {tracker.goalSuccessRate}% success
                                    </span>
                                    <div className="w-24 bg-editorial-dark/10 h-1">
                                      <div 
                                        className="h-full" 
                                        style={{ 
                                          width: `${tracker.goalSuccessRate}%`,
                                          backgroundColor: `var(--editorial-${tracker.color})`
                                        }}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-[10px] font-serif italic text-editorial-dark/40">— No Goal Set</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-12 text-center bg-editorial-bg border border-editorial-dark/15">
              <p className="text-sm font-serif italic text-editorial-dark/60">
                Please select a month to view statistics.
              </p>
            </div>
          )}
        </div>
      ) : (
        /* Weekly Habit Heatmap Grid View */
        <div className="space-y-6">
          <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-editorial-accent-light border border-editorial-accent/20 text-editorial-accent">
                <Table size={20} className="stroke-[1.5px]" />
              </div>
              <div>
                <h3 className="font-serif font-medium text-lg text-editorial-dark">
                  Weekly Habit Heatmap
                </h3>
                <p className="text-xs font-sans italic text-editorial-dark/60 mt-0.5">
                  Visualize log frequency and intensity over the past 4 weeks (28 days) for each tracker
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trackers.map((tracker) => {
              const heatmap = trackerHeatmaps[tracker.id];
              if (!heatmap) return null;
              const { grid, totalLogsInMonth, activeDaysCount } = heatmap;
              const colorStyles = COLOR_MAP[tracker.color] || COLOR_MAP.emerald;
              const consistencyRate = Math.round((activeDaysCount / 28) * 100);

              return (
                <div key={tracker.id} className="bg-editorial-bg p-5 rounded-none border border-editorial-dark/15 flex flex-col justify-between hover:border-editorial-dark/30 transition-all space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-editorial-dark/5 pb-3">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-none text-white ${colorStyles.bg} border border-editorial-dark/10`}>
                        <LucideIcon name={tracker.icon} size={15} />
                      </div>
                      <div>
                        <h4 className="font-serif font-semibold text-sm text-editorial-dark truncate leading-tight">
                          {tracker.name}
                        </h4>
                        <span className="text-[10px] font-mono text-editorial-dark/45 uppercase tracking-wider">
                          {CATEGORIES.find(c => c.id === tracker.category)?.name || tracker.category}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Heatmap Grid Component */}
                  <div className="flex flex-col items-center justify-center py-2">
                    <div className="flex gap-2">
                      {/* Weekday Labels (Mon, Tue, Wed, Thu, Fri, Sat, Sun) */}
                      <div className="flex flex-col justify-between text-[9px] font-mono text-editorial-dark/45 py-1 select-none pr-1">
                        <span>M</span>
                        <span>T</span>
                        <span>W</span>
                        <span>T</span>
                        <span>F</span>
                        <span>S</span>
                        <span>S</span>
                      </div>

                      {/* The Grid itself: 4 columns of 7 cells */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {Array.from({ length: 4 }).map((_, colIdx) => {
                          const weekLabels = ["3W Ago", "2W Ago", "Last Wk", "This Wk"];
                          return (
                            <div key={colIdx} className="flex flex-col gap-1.5">
                              {/* Week Header Label */}
                              <span className="text-[8px] font-mono text-editorial-dark/40 text-center uppercase tracking-tighter mb-1 h-3 block">
                                {weekLabels[colIdx]}
                              </span>
                              
                              {Array.from({ length: 7 }).map((_, rowIdx) => {
                                const cell = grid[rowIdx][colIdx];
                                if (!cell) return null;

                                let cellStyle: React.CSSProperties = {};
                                let cellClasses = "w-6 h-6 transition-all border cursor-help";

                                if (cell.isFuture) {
                                  cellClasses += " bg-editorial-dark/[0.01] border-editorial-dark/5 opacity-20 cursor-not-allowed";
                                } else if (cell.intensity === 0) {
                                  cellClasses += " bg-editorial-dark/[0.04] border-editorial-dark/10 hover:border-editorial-dark/30";
                                } else {
                                  cellClasses += " border-editorial-dark/15 hover:scale-105 hover:shadow-xs";
                                  let opacity = 0.2;
                                  if (cell.intensity === 2) opacity = 0.45;
                                  if (cell.intensity === 3) opacity = 0.75;
                                  if (cell.intensity === 4) opacity = 1.0;

                                  cellStyle = {
                                    backgroundColor: `var(--editorial-${tracker.color})`,
                                    opacity: opacity,
                                  };
                                }

                                if (cell.isToday) {
                                  cellClasses += " ring-1 ring-editorial-accent ring-offset-1";
                                }

                                let tooltipMsg = `${cell.dayName}, ${new Date(cell.dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
                                if (cell.isFuture) {
                                  tooltipMsg += " (Future)";
                                } else if (cell.logsCount === 0) {
                                  tooltipMsg += " (No logs)";
                                } else {
                                  tooltipMsg += `: Logged ${cell.logsCount} time(s). `;
                                  if (tracker.type === 'counter') {
                                    tooltipMsg += `Total: ${cell.valueSum} ${tracker.unit || ''}`;
                                  } else if (tracker.type === 'rating') {
                                    tooltipMsg += `Rating: ${cell.valueSum}/5`;
                                  } else if (tracker.type === 'boolean') {
                                    tooltipMsg += cell.valueSum > 0 ? "Completed" : "Logged";
                                  } else {
                                    tooltipMsg += `Value: ${cell.valueSum} ${tracker.unit || ''}`;
                                  }
                                }

                                return (
                                  <div
                                    key={rowIdx}
                                    className={cellClasses}
                                    style={cellStyle}
                                    title={tooltipMsg}
                                  />
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Stats for Tracker Heatmap */}
                  <div className="pt-3.5 border-t border-editorial-dark/5 bg-editorial-dark/[0.01] -mx-5 -mb-5 p-4 space-y-2 mt-auto">
                    <div className="flex items-center justify-between text-xs font-sans">
                      <span className="text-editorial-dark/60 italic">Consistency (28D)</span>
                      <span className="font-mono font-bold text-editorial-dark">{consistencyRate}%</span>
                    </div>
                    <div className="w-full bg-editorial-dark/10 h-1 rounded-none overflow-hidden">
                      <div 
                        className={`h-full ${colorStyles.bg}`} 
                        style={{ width: `${consistencyRate}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-baseline text-[9px] font-mono text-editorial-dark/45">
                      <span>{totalLogsInMonth} logs in month</span>
                      <div className="flex items-center gap-1 select-none">
                        <span>Less</span>
                        <span className="w-1.5 h-1.5 bg-editorial-dark/[0.04] border border-editorial-dark/10" />
                        <span className="w-1.5 h-1.5" style={{ backgroundColor: `var(--editorial-${tracker.color})`, opacity: 0.2 }} />
                        <span className="w-1.5 h-1.5" style={{ backgroundColor: `var(--editorial-${tracker.color})`, opacity: 0.45 }} />
                        <span className="w-1.5 h-1.5" style={{ backgroundColor: `var(--editorial-${tracker.color})`, opacity: 0.75 }} />
                        <span className="w-1.5 h-1.5" style={{ backgroundColor: `var(--editorial-${tracker.color})`, opacity: 1.0 }} />
                        <span>More</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
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
