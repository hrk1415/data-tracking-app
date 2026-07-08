/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Tracker, LogEntry, CATEGORIES, COLOR_MAP, DailyReflection, Milestone } from './types';
import { loadData, saveTrackers, saveLogs, saveReflections, exportDataAsJson, importDataFromJson } from './utils/storage';
import { importLogsFromCSV } from './utils/csvParser';
import { AddTrackerModal } from './components/AddTrackerModal';
import { TrackerCard } from './components/TrackerCard';
import { TrackerAnalytics } from './components/TrackerAnalytics';
import { LogHistory } from './components/LogHistory';
import { ManageTrackers } from './components/ManageTrackers';
import { LucideIcon } from './components/LucideIcon';
import { GoalNotesPanel } from './components/GoalNotesPanel';
import {
  LayoutDashboard,
  BarChart2,
  History,
  Settings,
  Plus,
  Download,
  Upload,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Award,
  Sparkles,
  Info,
  CheckCircle2,
  Flame,
  X,
  ArrowUp,
  ArrowDown,
  Minus,
  RotateCcw,
  Bell,
  BookOpen,
  Edit2,
  Trash2,
  Save,
  Sun,
  Moon,
  Flag,
  Clock,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

function DiffIndicator({ diff, prefix = "" }: { diff: number; prefix?: string }) {
  if (diff > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5" title="Increased compared to previous day">
        <ArrowUp size={10} className="stroke-[2.5]" />
        <span>+{diff}{prefix}</span>
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-medium text-red-600 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5" title="Decreased compared to previous day">
        <ArrowDown size={10} className="stroke-[2.5]" />
        <span>{diff}{prefix}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono font-medium text-editorial-dark/40 bg-editorial-dark/5 border border-editorial-dark/10 px-1.5 py-0.5" title="No change compared to previous day">
      <Minus size={10} className="stroke-[2.5]" />
      <span>0{prefix}</span>
    </span>
  );
}

export default function App() {
  // Load initial data from localStorage (or defaults)
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'analytics' | 'history' | 'manage'>('dashboard');
  const [isAddTrackerOpen, setIsAddTrackerOpen] = useState(false);
  const [isBackupSectionOpen, setIsBackupSectionOpen] = useState(false);
  const [lastToggleBackup, setLastToggleBackup] = useState<LogEntry[] | null>(null);
  const [lastToggleDate, setLastToggleDate] = useState<string | null>(null);

  // Reflection editor state
  const [reflectionInput, setReflectionInput] = useState<string>('');
  const [isEditingReflection, setIsEditingReflection] = useState<boolean>(false);

  // Milestone inputs
  const [milestoneTimeInput, setMilestoneTimeInput] = useState<string>('');
  const [milestoneTextInput, setMilestoneTextInput] = useState<string>('');
  const [milestoneImportanceInput, setMilestoneImportanceInput] = useState<'low' | 'medium' | 'high' | undefined>(undefined);

  const getCurrentTimeHHMM = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    setMilestoneTimeInput(getCurrentTimeHHMM());
    setMilestoneTextInput('');
    setMilestoneImportanceInput(undefined);
  }, [selectedDate]);

  const [reminderEnabled, setReminderEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('daily_reminder_enabled');
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });
  const [reminderTime, setReminderTime] = useState<string>(() => {
    return localStorage.getItem('daily_reminder_time') || '20:00';
  });
  const [reminderDismissedDate, setReminderDismissedDate] = useState<string | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved;
      return 'light';
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('theme', theme);
    } catch (e) {
      console.error(e);
    }
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Initialize state on client mount
  useEffect(() => {
    const data = loadData();
    setTrackers(data.trackers);
    setLogs(data.logs);
    setReflections(data.reflections || []);

    // Default selected date to today (local timezone, YYYY-MM-DD)
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];
    setSelectedDate(localISOTime);
  }, []);

  // Keep reflection input in sync with selectedDate and reflections
  useEffect(() => {
    const activeRef = reflections.find(r => r.date === selectedDate);
    setReflectionInput(activeRef ? activeRef.text : '');
    setIsEditingReflection(false);
  }, [selectedDate, reflections]);

  // Save/Update Daily Reflection
  const handleSaveReflection = (date: string, text: string) => {
    let updated: DailyReflection[];
    const existingIndex = reflections.findIndex(r => r.date === date);
    if (existingIndex > -1) {
      if (text.trim() === '') {
        const existing = reflections[existingIndex];
        if (!existing.milestones || existing.milestones.length === 0) {
          updated = reflections.filter(r => r.date !== date);
        } else {
          updated = [...reflections];
          updated[existingIndex] = {
            ...existing,
            text: '',
            updatedAt: new Date().toISOString(),
          };
        }
      } else {
        updated = [...reflections];
        updated[existingIndex] = {
          ...updated[existingIndex],
          text,
          updatedAt: new Date().toISOString(),
        };
      }
    } else {
      if (text.trim() === '') return;
      updated = [
        ...reflections,
        {
          date,
          text,
          updatedAt: new Date().toISOString(),
          milestones: [],
          showMilestonesOnDashboard: true,
        }
      ];
    }
    setReflections(updated);
    saveReflections(updated);
  };

  const handleToggleShowMilestones = (date: string) => {
    let updated: DailyReflection[];
    const existingIndex = reflections.findIndex(r => r.date === date);
    if (existingIndex > -1) {
      updated = [...reflections];
      updated[existingIndex] = {
        ...updated[existingIndex],
        showMilestonesOnDashboard: !(updated[existingIndex].showMilestonesOnDashboard ?? true),
      };
    } else {
      updated = [
        ...reflections,
        {
          date,
          text: '',
          milestones: [],
          showMilestonesOnDashboard: false,
          updatedAt: new Date().toISOString(),
        }
      ];
    }
    setReflections(updated);
    saveReflections(updated);
  };

  const handleSaveGoalNote = (date: string, trackerId: string, noteText: string) => {
    let updated: DailyReflection[];
    const existingIndex = reflections.findIndex(r => r.date === date);
    if (existingIndex > -1) {
      updated = [...reflections];
      const existing = updated[existingIndex];
      const existingNotes = existing.goalNotes || {};
      
      if (noteText.trim() === '') {
        const { [trackerId]: _, ...rest } = existingNotes;
        updated[existingIndex] = {
          ...existing,
          goalNotes: rest,
        };
      } else {
        updated[existingIndex] = {
          ...existing,
          goalNotes: {
            ...existingNotes,
            [trackerId]: noteText.trim(),
          },
        };
      }
    } else {
      if (noteText.trim() === '') return;
      updated = [
        ...reflections,
        {
          date,
          text: '',
          updatedAt: new Date().toISOString(),
          milestones: [],
          showMilestonesOnDashboard: true,
          goalNotes: {
            [trackerId]: noteText.trim(),
          },
        }
      ];
    }
    setReflections(updated);
    saveReflections(updated);
  };

  const handleAddMilestone = (date: string, time: string, text: string, importance?: 'low' | 'medium' | 'high') => {
    if (!text.trim() || !time) return;
    const newMilestone: Milestone = {
      id: Math.random().toString(36).substring(2, 9),
      time,
      text: text.trim(),
      importance,
    };

    let updated: DailyReflection[];
    const existingIndex = reflections.findIndex(r => r.date === date);
    if (existingIndex > -1) {
      updated = [...reflections];
      const existingRef = updated[existingIndex];
      updated[existingIndex] = {
        ...existingRef,
        milestones: [...(existingRef.milestones || []), newMilestone],
        showMilestonesOnDashboard: existingRef.showMilestonesOnDashboard ?? true,
        updatedAt: new Date().toISOString(),
      };
    } else {
      updated = [
        ...reflections,
        {
          date,
          text: '',
          milestones: [newMilestone],
          showMilestonesOnDashboard: true,
          updatedAt: new Date().toISOString(),
        }
      ];
    }
    setReflections(updated);
    saveReflections(updated);
  };

  const handleDeleteMilestone = (date: string, id: string) => {
    let updated: DailyReflection[];
    const existingIndex = reflections.findIndex(r => r.date === date);
    if (existingIndex > -1) {
      updated = [...reflections];
      const existingRef = updated[existingIndex];
      const filteredMilestones = (existingRef.milestones || []).filter(m => m.id !== id);
      updated[existingIndex] = {
        ...existingRef,
        milestones: filteredMilestones,
        updatedAt: new Date().toISOString(),
      };
    } else {
      return;
    }
    setReflections(updated);
    saveReflections(updated);
  };

  // Save trackers when state changes
  const handleAddTracker = (newTracker: Tracker) => {
    const updated = [newTracker, ...trackers];
    setTrackers(updated);
    saveTrackers(updated);
  };

  const handleDeleteTracker = (trackerId: string) => {
    const updatedTrackers = trackers.filter(t => t.id !== trackerId);
    setTrackers(updatedTrackers);
    saveTrackers(updatedTrackers);

    // Delete associated logs
    const updatedLogs = logs.filter(l => l.trackerId !== trackerId);
    setLogs(updatedLogs);
    saveLogs(updatedLogs);
  };

  const handleUpdateTracker = (updatedTracker: Tracker) => {
    const updated = trackers.map(t => t.id === updatedTracker.id ? updatedTracker : t);
    setTrackers(updated);
    saveTrackers(updated);
  };

  // Log value handles adding or updating logs for a specific tracker on a date
  const handleLogValue = (trackerId: string, value: number, note?: string) => {
    const tracker = trackers.find(t => t.id === trackerId);
    if (!tracker) return;

    const logDate = selectedDate;

    // Check if we already have logs for this tracker on this date
    const existingLogs = logs.filter(l => l.trackerId === trackerId && l.date === logDate);

    let updatedLogs = [...logs];

    if (tracker.type === 'counter') {
      // Counter: logging adds a NEW increment log, rather than overwriting
      // Unless they are editing the note, then we attach it to the latest log or create one
      if (note && existingLogs.length > 0) {
        // Update the note on the latest log
        const latest = existingLogs[existingLogs.length - 1];
        updatedLogs = logs.map(l => l.id === latest.id ? { ...l, note } : l);
      } else {
        // Add new log entry
        const newLog: LogEntry = {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          trackerId,
          value,
          date: logDate,
          note: note || undefined,
          timestamp: new Date().toISOString(),
        };
        updatedLogs.push(newLog);
      }
    } else {
      // For Numeric, Boolean, and Rating: We OVERWRITE/UPDATE the latest log entry for this date
      if (existingLogs.length > 0) {
        const latest = existingLogs[existingLogs.length - 1];
        updatedLogs = logs.map(l =>
          l.id === latest.id ? { ...l, value, note: note !== undefined ? note : l.note, timestamp: new Date().toISOString() } : l
        );
      } else {
        // Create new log entry for today
        const newLog: LogEntry = {
          id: `log-${Date.now()}`,
          trackerId,
          value,
          date: logDate,
          note: note || undefined,
          timestamp: new Date().toISOString(),
        };
        updatedLogs.push(newLog);
      }
    }

    setLogs(updatedLogs);
    saveLogs(updatedLogs);
  };

  const handleDeleteLog = (logId: string) => {
    const updated = logs.filter(l => l.id !== logId);
    setLogs(updated);
    saveLogs(updated);
  };

  const handleUpdateLog = (logId: string, updatedValue: number, updatedNote?: string) => {
    const updated = logs.map(l =>
      l.id === logId ? { ...l, value: updatedValue, note: updatedNote, timestamp: new Date().toISOString() } : l
    );
    setLogs(updated);
    saveLogs(updated);
  };

  // Quick Date navigation shifts days backward/forward
  const shiftDate = (days: number) => {
    if (!selectedDate) return;
    const currentDate = new Date(selectedDate + 'T12:00:00');
    currentDate.setDate(currentDate.getDate() + days);
    setSelectedDate(currentDate.toISOString().split('T')[0]);
  };

  // Filter trackers and logs map
  const logsCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach(l => {
      map[l.trackerId] = (map[l.trackerId] || 0) + 1;
    });
    return map;
  }, [logs]);

  // Daily statistics for selected date
  const dailyStats = useMemo(() => {
    const activeOnDate = trackers.length;
    let completedGoalsOnDate = 0;
    let trackersWithGoals = 0;

    trackers.forEach(t => {
      if (t.targetValue) {
        trackersWithGoals++;
        const tLogs = logs.filter(l => l.trackerId === t.id && l.date === selectedDate);
        const totalVal = t.type === 'counter'
          ? tLogs.reduce((sum, l) => sum + l.value, 0)
          : (tLogs.length > 0 ? tLogs[tLogs.length - 1].value : 0);

        if (totalVal >= t.targetValue) {
          completedGoalsOnDate++;
        }
      }
    });

    return {
      activeCount: activeOnDate,
      withGoals: trackersWithGoals,
      completedGoals: completedGoalsOnDate,
      completionRate: trackersWithGoals > 0 ? Math.round((completedGoalsOnDate / trackersWithGoals) * 100) : 0,
    };
  }, [trackers, logs, selectedDate]);

  // Track dates where confetti celebration has already played in the current session
  const celebratedDatesRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (currentTab === 'dashboard' && dailyStats.withGoals > 0 && dailyStats.completionRate === 100) {
      if (!celebratedDatesRef.current[selectedDate]) {
        celebratedDatesRef.current[selectedDate] = true;
        
        // Play double side-cannon celebration confetti
        const end = Date.now() + 1000;
        const frame = () => {
          confetti({
            particleCount: 4,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.75 },
            colors: ['#047857', '#3b82f6', '#f59e0b', '#ec4899', '#10b981']
          });
          confetti({
            particleCount: 4,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.75 },
            colors: ['#047857', '#3b82f6', '#f59e0b', '#ec4899', '#10b981']
          });

          if (Date.now() < end) {
            requestAnimationFrame(frame);
          }
        };
        frame();
      }
    } else if (dailyStats.withGoals > 0 && dailyStats.completionRate < 100) {
      // Reset so they can achieve and trigger the celebration again if logs/goals change
      if (celebratedDatesRef.current[selectedDate]) {
        delete celebratedDatesRef.current[selectedDate];
      }
    }
  }, [dailyStats.completionRate, dailyStats.withGoals, selectedDate, currentTab]);

  // Check if daily reminder should be displayed based on goals and set time
  const showReminderBanner = useMemo(() => {
    if (!reminderEnabled) return false;
    if (dailyStats.withGoals === 0 || dailyStats.completionRate === 100) return false;
    if (reminderDismissedDate === selectedDate) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [h, m] = reminderTime.split(':').map(Number);
    const targetMinutes = (h || 0) * 60 + (m || 0);

    return currentMinutes >= targetMinutes;
  }, [reminderEnabled, reminderTime, dailyStats, reminderDismissedDate, selectedDate]);

  // Previous day date string
  const prevDateStr = useMemo(() => {
    if (!selectedDate) return '';
    const dateObj = new Date(selectedDate + 'T12:00:00');
    dateObj.setDate(dateObj.getDate() - 1);
    return dateObj.toISOString().split('T')[0];
  }, [selectedDate]);

  // Daily statistics for previous date
  const prevDailyStats = useMemo(() => {
    if (!prevDateStr) {
      return {
        activeCount: 0,
        withGoals: 0,
        completedGoals: 0,
        completionRate: 0,
        logVolume: 0,
      };
    }

    const activeOnDate = trackers.length;
    let completedGoalsOnDate = 0;
    let trackersWithGoals = 0;

    trackers.forEach(t => {
      if (t.targetValue) {
        trackersWithGoals++;
        const tLogs = logs.filter(l => l.trackerId === t.id && l.date === prevDateStr);
        const totalVal = t.type === 'counter'
          ? tLogs.reduce((sum, l) => sum + l.value, 0)
          : (tLogs.length > 0 ? tLogs[tLogs.length - 1].value : 0);

        if (totalVal >= t.targetValue) {
          completedGoalsOnDate++;
        }
      }
    });

    const logVolume = logs.filter(l => l.date === prevDateStr).length;

    return {
      activeCount: activeOnDate,
      withGoals: trackersWithGoals,
      completedGoals: completedGoalsOnDate,
      completionRate: trackersWithGoals > 0 ? Math.round((completedGoalsOnDate / trackersWithGoals) * 100) : 0,
      logVolume,
    };
  }, [trackers, logs, prevDateStr]);

  // Daily log volume for selected date
  const selectedDateLogVolume = useMemo(() => {
    return logs.filter(l => l.date === selectedDate).length;
  }, [logs, selectedDate]);

  // Calculate Goal Streaks: Current Streak and Longest (All-Time) Streak
  const goalStreaks = useMemo(() => {
    if (!selectedDate) {
      return { currentStreak: 0, longestStreak: 0 };
    }

    // Helper to check if 100% daily goals were met on a specific date (YYYY-MM-DD)
    const is100PercentGoalsMet = (dStr: string) => {
      const activeTrackersWithGoals = trackers.filter(t => 
        t.targetValue !== undefined && 
        t.targetValue > 0 && 
        (!t.createdAt || t.createdAt.split('T')[0] <= dStr)
      );
      
      if (activeTrackersWithGoals.length === 0) return false;
      
      return activeTrackersWithGoals.every(t => {
        const tLogs = logs.filter(l => l.trackerId === t.id && l.date === dStr);
        const totalVal = t.type === 'counter'
          ? tLogs.reduce((sum, l) => sum + l.value, 0)
          : (tLogs.length > 0 ? tLogs[tLogs.length - 1].value : 0);
        return totalVal >= t.targetValue!;
      });
    };

    let earliestDateStr = selectedDate;
    if (logs.length > 0) {
      logs.forEach(l => {
        if (l.date && l.date.match(/^\d{4}-\d{2}-\d{2}$/) && l.date < earliestDateStr) {
          earliestDateStr = l.date;
        }
      });
    }

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const dateList: string[] = [];
    try {
      const startDate = new Date(earliestDateStr + 'T12:00:00');
      const endDate = new Date((selectedDate > todayStr ? selectedDate : todayStr) + 'T12:00:00');
      
      if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
        const tempDate = new Date(startDate);
        let safetyGuard = 0;
        while (tempDate <= endDate && safetyGuard < 5000) {
          dateList.push(tempDate.toISOString().split('T')[0]);
          tempDate.setDate(tempDate.getDate() + 1);
          safetyGuard++;
        }
      }
    } catch (err) {
      console.error("Error generating date list for streak calculation", err);
    }

    // Calculate all-time longest streak
    let longestStreak = 0;
    let currentTempStreak = 0;
    
    dateList.forEach(dStr => {
      if (is100PercentGoalsMet(dStr)) {
        currentTempStreak++;
        if (currentTempStreak > longestStreak) {
          longestStreak = currentTempStreak;
        }
      } else {
        currentTempStreak = 0;
      }
    });

    // Calculate current streak working backwards from selectedDate
    let currentStreak = 0;
    try {
      let checkDateObj = new Date(selectedDate + 'T12:00:00');
      if (!isNaN(checkDateObj.getTime())) {
        const safetyLimit = Math.max(365, dateList.length + 10);
        let count = 0;

        const metToday = is100PercentGoalsMet(selectedDate);
        if (metToday) {
          currentStreak = 1;
          while (count < safetyLimit) {
            checkDateObj.setDate(checkDateObj.getDate() - 1);
            const prevDateStr = checkDateObj.toISOString().split('T')[0];
            if (is100PercentGoalsMet(prevDateStr)) {
              currentStreak++;
            } else {
              break;
            }
            count++;
          }
        } else {
          checkDateObj.setDate(checkDateObj.getDate() - 1);
          const prevDateStr = checkDateObj.toISOString().split('T')[0];
          if (is100PercentGoalsMet(prevDateStr)) {
            currentStreak = 1;
            while (count < safetyLimit) {
              checkDateObj.setDate(checkDateObj.getDate() - 1);
              const nextPrevDateStr = checkDateObj.toISOString().split('T')[0];
              if (is100PercentGoalsMet(nextPrevDateStr)) {
                currentStreak++;
              } else {
                break;
              }
              count++;
            }
          }
        }
      }
    } catch (err) {
      console.error("Error calculating current streak", err);
    }

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
    };
  }, [trackers, logs, selectedDate]);

  // Overall statistics
  const totalLogsCount = logs.length;
  const healthCategoryCount = trackers.filter(t => t.category === 'health').length;
  const fitnessCategoryCount = trackers.filter(t => t.category === 'fitness').length;
  const productivityCategoryCount = trackers.filter(t => t.category === 'productivity').length;

  // Quick Goal: Toggles 100% completion for all daily goals
  const handleQuickGoalToggle = () => {
    const trackersWithGoals = trackers.filter(t => t.targetValue !== undefined && t.targetValue > 0);
    if (trackersWithGoals.length === 0) return;

    const isAlreadyComplete = dailyStats.withGoals > 0 && dailyStats.completedGoals === dailyStats.withGoals;

    if (isAlreadyComplete) {
      // Toggle off: Undo last action if backup exists, otherwise clear logs for today's goals
      if (lastToggleBackup && lastToggleDate === selectedDate) {
        handleUndoToggle();
      } else {
        // Clear all logs for goals on the selected date
        const updatedLogs = logs.filter(l => {
          if (l.date !== selectedDate) return true;
          const tracker = trackers.find(t => t.id === l.trackerId);
          return !(tracker && tracker.targetValue !== undefined && tracker.targetValue > 0);
        });
        setLastToggleBackup(logs);
        setLastToggleDate(selectedDate);
        setLogs(updatedLogs);
        saveLogs(updatedLogs);
      }
      return;
    }

    // Toggle on: Fill all goals to 100%
    setLastToggleBackup(logs);
    setLastToggleDate(selectedDate);

    let updatedLogs = [...logs];

    trackersWithGoals.forEach(t => {
      const target = t.targetValue!;
      const tLogs = updatedLogs.filter(l => l.trackerId === t.id && l.date === selectedDate);
      const currentVal = t.type === 'counter'
        ? tLogs.reduce((sum, l) => sum + l.value, 0)
        : (tLogs.length > 0 ? tLogs[tLogs.length - 1].value : 0);

      if (currentVal < target) {
        if (t.type === 'counter') {
          const diff = target - currentVal;
          const newLog: LogEntry = {
            id: `log-quick-${Date.now()}-${t.id}-${Math.random().toString(36).substring(2, 6)}`,
            trackerId: t.id,
            value: diff,
            date: selectedDate,
            note: "Quick Goal Fill",
            timestamp: new Date().toISOString(),
          };
          updatedLogs.push(newLog);
        } else {
          // Numeric, rating, boolean
          const finalVal = t.type === 'boolean' ? 1 : target;
          if (tLogs.length > 0) {
            const latest = tLogs[tLogs.length - 1];
            updatedLogs = updatedLogs.map(l =>
              l.id === latest.id ? { ...l, value: finalVal, timestamp: new Date().toISOString() } : l
            );
          } else {
            const newLog: LogEntry = {
              id: `log-quick-${Date.now()}-${t.id}`,
              trackerId: t.id,
              value: finalVal,
              date: selectedDate,
              note: "Quick Goal Fill",
              timestamp: new Date().toISOString(),
            };
            updatedLogs.push(newLog);
          }
        }
      }
    });

    setLogs(updatedLogs);
    saveLogs(updatedLogs);
  };

  const handleUndoToggle = () => {
    if (lastToggleBackup && lastToggleDate === selectedDate) {
      setLogs(lastToggleBackup);
      saveLogs(lastToggleBackup);
      setLastToggleBackup(null);
      setLastToggleDate(null);
    }
  };

  // File import backing trigger
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const imported = importDataFromJson(text);
        if (imported) {
          setTrackers(imported.trackers);
          setLogs(imported.logs);
          setReflections(imported.reflections || []);
          alert('Data tracking backup imported successfully!');
          setIsBackupSectionOpen(false);
        } else {
          alert('Invalid backup file. Please ensure the file is a valid JSON exported from this tracker application.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // CSV Import backing trigger
  const handleImportCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const result = importLogsFromCSV(text, trackers);
        if (result && result.importedCount > 0) {
          setTrackers(result.trackers);
          setLogs(result.logs);
          saveTrackers(result.trackers);
          saveLogs(result.logs);
          alert(`CSV imported successfully! Parsed and loaded ${result.importedCount} logs, dynamically setting up trackers.`);
          setIsBackupSectionOpen(false);
        } else {
          alert('Failed to import CSV. Please make sure the file contains at least headers and some valid data rows with Date, Tracker Name, and Value columns.');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExportData = () => {
    const dataStr = exportDataAsJson(trackers, logs, reflections);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data_tracker_backup_${selectedDate}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    const escapeCSV = (str: any) => {
      if (str === null || str === undefined) return '';
      const stringified = String(str);
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n') || stringified.includes('\r')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    const headers = ['Date', 'Tracker Name', 'Category', 'Value', 'Unit', 'Goal', 'Notes', 'Logged At'];
    
    // Sort logs chronologically by date and time
    const sortedLogs = [...logs].sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      return (a.timestamp || '').localeCompare(b.timestamp || '');
    });

    const rows = sortedLogs.map(l => {
      const tracker = trackers.find(t => t.id === l.trackerId);
      return [
        escapeCSV(l.date),
        escapeCSV(tracker ? tracker.name : 'Unknown Tracker'),
        escapeCSV(tracker ? tracker.category : ''),
        escapeCSV(l.value),
        escapeCSV(tracker ? tracker.unit : ''),
        escapeCSV(tracker?.targetValue !== undefined ? tracker.targetValue : ''),
        escapeCSV(l.note || ''),
        escapeCSV(l.timestamp || '')
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data_tracker_logs_${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Date representation
  const formattedSelectedDate = useMemo(() => {
    if (!selectedDate) return '';
    const dateObj = new Date(selectedDate + 'T12:00:00');
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (selectedDate === todayStr) return 'Today';
    if (selectedDate === yesterdayStr) return 'Yesterday';

    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, [selectedDate]);

  const activeReflection = useMemo(() => {
    return reflections.find(r => r.date === selectedDate);
  }, [reflections, selectedDate]);

  return (
    <div id="app-root" className="min-h-screen bg-editorial-bg flex flex-col font-sans text-editorial-dark select-none">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 bg-editorial-bg/95 backdrop-blur-md border-b border-editorial-dark/15 px-4 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-none border border-editorial-accent bg-editorial-accent text-editorial-bg">
            <LucideIcon name="Activity" size={20} className="stroke-[2]" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-semibold text-editorial-dark tracking-wide leading-none">Data Tracker</h1>
            <p className="text-[9px] font-mono text-editorial-accent tracking-widest uppercase leading-none mt-1">Personal Metrics & Analytics</p>
          </div>
        </div>

        {/* Global Action Header Items */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="flex items-center justify-center h-9 w-9 rounded-none border border-editorial-dark/20 hover:border-editorial-accent hover:bg-editorial-accent-light text-editorial-dark transition-all cursor-pointer"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? (
              <Moon size={14} className="text-editorial-accent" />
            ) : (
              <Sun size={14} className="text-editorial-accent" />
            )}
          </button>

          {/* Backup Action Trigger */}
          <button
            type="button"
            onClick={() => setIsBackupSectionOpen(!isBackupSectionOpen)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-none border border-editorial-dark/20 hover:border-editorial-accent text-xs font-mono text-editorial-dark bg-editorial-bg hover:bg-editorial-accent-light transition-all cursor-pointer"
          >
            <Download size={14} className="text-editorial-accent" />
            Backup & Sync
          </button>

          {/* Core Creation Button */}
          <button
            type="button"
            onClick={() => setIsAddTrackerOpen(true)}
            className="flex items-center gap-1.5 bg-editorial-dark hover:bg-editorial-accent text-editorial-bg px-4 py-2.5 rounded-none text-xs font-mono transition-all cursor-pointer"
          >
            <Plus size={14} />
            New Tracker
          </button>
        </div>
      </header>

      {/* Backup and Restore Expandable Overlay Drawer */}
      <AnimatePresence>
        {isBackupSectionOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-editorial-bg border-b border-editorial-dark/15 overflow-hidden"
          >
            <div className="max-w-4xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-sm items-center">
              <div>
                <h4 className="font-serif font-medium text-lg text-editorial-dark flex items-center gap-1.5">
                  <LucideIcon name="Settings" size={16} className="text-editorial-accent" />
                  Local State Backups (Offline First)
                </h4>
                <p className="text-xs text-editorial-dark/75 mt-1 leading-relaxed">
                  Your tracking stats are preserved instantly inside your browser's LocalStorage. Export your statistics to keep a physical copy or restore logs on other devices.
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-center justify-start md:justify-end">
                {/* Export Button */}
                <button
                  type="button"
                  onClick={handleExportData}
                  className="flex items-center gap-1.5 bg-editorial-accent-light hover:bg-editorial-accent/20 border border-editorial-accent/30 text-editorial-accent font-semibold px-4 py-2 rounded-none text-xs transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  Export Data (JSON)
                </button>

                {/* Export CSV Button */}
                <button
                  type="button"
                  id="export-csv-button"
                  onClick={handleExportCSV}
                  className="flex items-center gap-1.5 bg-editorial-orange-light/30 hover:bg-editorial-orange/20 border border-editorial-orange/30 text-editorial-orange font-semibold px-4 py-2 rounded-none text-xs transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  Export Logs (CSV)
                </button>

                {/* Import CSV Logs Button */}
                <label
                  id="import-csv-logs-button"
                  className="flex items-center gap-1.5 bg-editorial-orange-light/10 hover:bg-editorial-orange-light/25 border border-editorial-orange/20 text-editorial-orange font-semibold px-4 py-2 rounded-none text-xs transition-colors cursor-pointer"
                  title="Bulk-populate logs from an external CSV file"
                >
                  <Upload size={14} className="text-editorial-orange" />
                  Import CSV Logs
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleImportCSVFile}
                    className="hidden"
                  />
                </label>

                {/* Import File Button */}
                <label className="flex items-center gap-1.5 bg-editorial-bg hover:bg-editorial-accent-light border border-editorial-dark/20 text-editorial-dark font-semibold px-4 py-2 rounded-none text-xs transition-colors cursor-pointer">
                  <Upload size={14} className="text-editorial-accent" />
                  Import Backup File
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportFile}
                    className="hidden"
                  />
                </label>

                {/* Close backup action */}
                <button
                  type="button"
                  onClick={() => setIsBackupSectionOpen(false)}
                  className="p-2 text-editorial-dark/50 hover:text-editorial-dark hover:bg-editorial-accent-light rounded-none"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Body Grid Container */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto p-4 lg:p-6 gap-6">
        
        {/* Navigation Rail / Sidebar */}
        <aside className="w-full lg:w-64 shrink-0 flex flex-row lg:flex-col gap-2 p-2 bg-editorial-bg border border-editorial-dark/15 rounded-none lg:h-fit">
          <button
            type="button"
            onClick={() => setCurrentTab('dashboard')}
            className={`flex-1 lg:flex-initial flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-none text-xs font-serif font-medium transition-all ${
              currentTab === 'dashboard'
                ? 'bg-editorial-accent text-editorial-bg'
                : 'text-editorial-dark/60 hover:text-editorial-dark hover:bg-editorial-accent-light'
            }`}
          >
            <LayoutDashboard size={15} />
            <span className="hidden sm:inline lg:inline">Daily Logger</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('analytics')}
            className={`flex-1 lg:flex-initial flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-none text-xs font-serif font-medium transition-all ${
              currentTab === 'analytics'
                ? 'bg-editorial-accent text-editorial-bg'
                : 'text-editorial-dark/60 hover:text-editorial-dark hover:bg-editorial-accent-light'
            }`}
          >
            <BarChart2 size={15} />
            <span className="hidden sm:inline lg:inline">Insights & Charts</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('history')}
            className={`flex-1 lg:flex-initial flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-none text-xs font-serif font-medium transition-all ${
              currentTab === 'history'
                ? 'bg-editorial-accent text-editorial-bg'
                : 'text-editorial-dark/60 hover:text-editorial-dark hover:bg-editorial-accent-light'
            }`}
          >
            <History size={15} />
            <span className="hidden sm:inline lg:inline">History Log Table</span>
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('manage')}
            className={`flex-1 lg:flex-initial flex items-center justify-center lg:justify-start gap-3 px-4 py-3 rounded-none text-xs font-serif font-medium transition-all ${
              currentTab === 'manage'
                ? 'bg-editorial-accent text-editorial-bg'
                : 'text-editorial-dark/60 hover:text-editorial-dark hover:bg-editorial-accent-light'
            }`}
          >
            <Settings size={15} />
            <span className="hidden sm:inline lg:inline">Manage Metrics</span>
          </button>
        </aside>

        {/* Dynamic View Panel content */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {currentTab === 'dashboard' && (
              <motion.div
                key="dashboard-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
                className="space-y-6"
              >
                {/* Dashboard Sub Header with Date Selector */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-editorial-bg p-6 rounded-none border border-editorial-dark/15">
                  <div>
                    <h2 className="text-2xl font-serif font-medium text-editorial-dark tracking-wide flex items-center gap-2">
                      <Calendar size={20} className="text-editorial-accent" />
                      {formattedSelectedDate} Logs
                    </h2>
                    <p className="text-xs font-sans italic text-editorial-dark/60 mt-1">Select a date to view and log metrics</p>
                  </div>

                  {/* Elegant Calendar Switcher */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => shiftDate(-1)}
                      className="p-2 border border-editorial-dark/20 hover:bg-editorial-accent-light rounded-none text-editorial-dark transition-colors"
                      title="Previous Day"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    <div className="relative">
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="rounded-none border border-editorial-dark/20 px-3.5 py-1.5 text-xs font-mono font-semibold text-editorial-dark outline-hidden bg-editorial-bg focus:border-editorial-accent transition-all cursor-pointer select-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => shiftDate(1)}
                      className="p-2 border border-editorial-dark/20 hover:bg-editorial-accent-light rounded-none text-editorial-dark transition-colors"
                      title="Next Day"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>

                {/* Daily Reminder Push-Notification-Style Banner */}
                <AnimatePresence>
                  {showReminderBanner && (
                    <motion.div
                      initial={{ opacity: 0, y: -20, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.95 }}
                      className="bg-editorial-dark text-editorial-bg p-5 rounded-none border border-editorial-dark/15 shadow-xl flex items-start justify-between gap-4 relative overflow-hidden"
                    >
                      {/* Left accent accentuation strip */}
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-editorial-accent" />
                      
                      <div className="flex items-start gap-4.5 pl-1.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-editorial-accent text-editorial-bg animate-pulse mt-0.5">
                          <Bell size={18} className="stroke-[1.5]" />
                        </div>
                        <div className="space-y-1">
                          <span className="block text-[9px] font-mono font-bold text-editorial-accent uppercase tracking-widest">
                            Daily Reminder • Pending Goals
                          </span>
                          <h4 className="font-serif font-medium text-base text-editorial-bg leading-tight">
                            Complete Your Habits!
                          </h4>
                          <p className="text-xs text-editorial-bg/85 max-w-2xl leading-relaxed">
                            It is past your set reminder time of <strong className="font-mono text-editorial-accent">{reminderTime}</strong>. You have completed <strong className="font-mono text-editorial-accent">{dailyStats.completedGoals} of {dailyStats.withGoals}</strong> daily goals ({dailyStats.completionRate}%) for {formattedSelectedDate}. Keep up the momentum!
                          </p>
                          <div className="pt-2 flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleQuickGoalToggle}
                              className="bg-editorial-accent hover:bg-editorial-accent/90 text-editorial-bg border border-editorial-accent/20 px-3 py-1 text-[10px] font-mono font-medium transition-colors cursor-pointer"
                            >
                              Mark All as Complete
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const el = document.getElementById('tracked-metrics-heading');
                                if (el) {
                                  el.scrollIntoView({ behavior: 'smooth' });
                                }
                              }}
                              className="border border-editorial-bg/35 hover:border-editorial-bg hover:bg-editorial-bg/10 text-editorial-bg px-3 py-1 text-[10px] font-mono font-medium transition-colors cursor-pointer"
                            >
                              Log Manually
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setReminderDismissedDate(selectedDate)}
                        className="p-1.5 text-editorial-bg/60 hover:text-editorial-bg hover:bg-editorial-bg/10 rounded-none transition-colors self-start cursor-pointer"
                        title="Dismiss Reminder"
                      >
                        <X size={15} />
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Daily Goal Achievement Summary Bar */}
                <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="block text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-widest">
                        Overall Progress
                      </span>
                      <h3 className="text-lg font-serif font-medium text-editorial-dark mt-1">
                        {dailyStats.withGoals > 0 ? (
                          <>
                            You have achieved <span className="font-mono text-editorial-accent">{dailyStats.completionRate}%</span> of your goals for today
                          </>
                        ) : (
                          "No active metrics with daily goals configured"
                        )}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {goalStreaks.currentStreak > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-editorial-orange bg-editorial-orange-light border border-editorial-orange/20 px-2.5 py-1" title={`${goalStreaks.currentStreak} day consecutive goal streak!`}>
                          <Flame size={12} className="text-editorial-orange fill-editorial-orange/15 animate-pulse" />
                          <span>{goalStreaks.currentStreak}d Streak</span>
                        </span>
                      )}
                      {dailyStats.withGoals > 0 && (
                        <span className="text-xs font-mono font-medium text-editorial-dark/60 bg-editorial-dark/5 border border-editorial-dark/10 px-2 py-1">
                          {dailyStats.completedGoals} of {dailyStats.withGoals} Met
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="relative group/progress">
                    {/* Hover Tooltip showing exact completion count and total target trackers */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs bg-editorial-dark text-editorial-bg text-[11px] px-3 py-2 border border-editorial-dark/20 shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity duration-200 pointer-events-none z-10 flex flex-col gap-0.5">
                      <span className="font-serif font-medium text-white text-xs">Daily Goal Achievement</span>
                      <span className="font-mono text-editorial-bg/85">
                        {dailyStats.withGoals > 0 
                          ? `${dailyStats.completedGoals} of ${dailyStats.withGoals} target trackers met (${dailyStats.completionRate}%)`
                          : 'No active metrics with daily goals configured'
                        }
                      </span>
                      {/* Tooltip Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-editorial-dark" />
                    </div>

                    {/* Progress Bar Track and Fill */}
                    <div 
                      className="h-3 w-full bg-editorial-dark/5 border border-editorial-dark/10 rounded-none overflow-hidden cursor-help"
                      title={dailyStats.withGoals > 0 
                        ? `${dailyStats.completedGoals} of ${dailyStats.withGoals} daily goal target trackers met (${dailyStats.completionRate}%)`
                        : 'No active metrics with daily goals configured'
                      }
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${dailyStats.completionRate}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="h-full bg-editorial-accent"
                      />
                    </div>
                    
                    {/* Editorial scale markers */}
                    <div className="flex justify-between text-[9px] font-mono text-editorial-dark/40 pt-1.5 px-0.5">
                      <span>0%</span>
                      <span>25%</span>
                      <span>50%</span>
                      <span>75%</span>
                      <span>100%</span>
                    </div>
                  </div>

                  {/* Daily Goal Target List & Justifications */}
                  {trackers.some(t => t.targetValue !== undefined && t.targetValue > 0) && (
                    <div className="border-t border-editorial-dark/10 pt-4 space-y-3">
                      <h4 className="text-[10px] font-mono text-editorial-accent tracking-widest uppercase font-semibold">
                        Daily Habit Checklists & Justifications
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {trackers
                          .filter(t => t.targetValue !== undefined && t.targetValue > 0)
                          .map(t => {
                            const trackerLogs = logs.filter(l => l.trackerId === t.id && l.date === selectedDate);
                            const currentValue = t.type === 'counter'
                              ? trackerLogs.reduce((sum, l) => sum + l.value, 0)
                              : (trackerLogs.length > 0 ? trackerLogs[trackerLogs.length - 1].value : 0);
                            const isMet = currentValue >= t.targetValue!;
                            
                            // Retrieve saved goal note if any
                            const dateReflection = reflections.find(r => r.date === selectedDate);
                            const currentNote = dateReflection?.goalNotes?.[t.id] || '';
                            
                            return (
                              <div
                                key={t.id}
                                className={`p-3.5 border transition-all flex flex-col justify-between space-y-2 ${
                                  isMet
                                    ? 'bg-editorial-emerald-light/10 border-editorial-emerald/25'
                                    : 'bg-editorial-rose-light/10 border-editorial-rose/25'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                      isMet ? 'bg-editorial-emerald' : 'bg-editorial-rose'
                                    }`} />
                                    <span className="text-xs font-mono font-bold text-editorial-dark/85 truncate">
                                      {t.name}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[11px] font-mono text-editorial-dark/70">
                                      {currentValue} / {t.targetValue} {t.unit || ''}
                                    </span>
                                    {isMet ? (
                                      <span className="text-[10px] font-mono font-bold uppercase text-editorial-emerald bg-editorial-emerald/15 px-1.5 py-0.5 border border-editorial-emerald/20">
                                        Met
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-mono font-bold uppercase text-editorial-rose bg-editorial-rose/15 px-1.5 py-0.5 border border-editorial-rose/20">
                                        Unmet
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Notes field for goals (both met and unmet) */}
                                <div className="space-y-1 pt-1.5 border-t border-editorial-dark/5">
                                  <label className="block text-[9px] font-mono uppercase tracking-wider text-editorial-dark/50">
                                    {isMet ? 'Daily Goal Note / Context:' : 'Justification / Explanation:'}
                                  </label>
                                  <input
                                    type="text"
                                    value={currentNote}
                                    onChange={(e) => handleSaveGoalNote(selectedDate, t.id, e.target.value)}
                                    placeholder={isMet ? "Add context, achievements, or daily notes..." : "Add a reason or note for not meeting this goal..."}
                                    className="w-full bg-transparent border-0 border-b border-editorial-dark/15 hover:border-editorial-dark/30 focus:border-editorial-accent p-1 text-[11px] font-serif italic text-editorial-dark outline-hidden focus:ring-0 placeholder:text-editorial-dark/30 placeholder:italic transition-all"
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {dailyStats.withGoals > 0 && (
                    <div className="pt-3.5 border-t border-editorial-dark/10 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-6">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            id="quick-goal-toggle"
                            onClick={handleQuickGoalToggle}
                            className="flex items-center gap-2 group cursor-pointer select-none"
                          >
                            <div
                              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out border ${
                                dailyStats.completionRate === 100
                                  ? 'bg-editorial-accent border-editorial-accent'
                                  : 'bg-editorial-dark/10 border-editorial-dark/15'
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded-full bg-editorial-bg shadow-sm transform transition-transform duration-200 ease-in-out ${
                                  dailyStats.completionRate === 100 ? 'translate-x-3.5' : 'translate-x-0'
                                }`}
                              />
                            </div>
                            <span className="text-[10px] font-mono font-medium text-editorial-dark/60 group-hover:text-editorial-dark transition-colors uppercase tracking-wider">
                              Quick Goal 100% Complete
                            </span>
                          </button>
                        </div>

                        {/* Daily Reminder Control */}
                        <div className="flex items-center gap-3 sm:border-l sm:border-editorial-dark/10 sm:pl-6">
                          <button
                            type="button"
                            id="daily-reminder-toggle"
                            onClick={() => {
                              const newValue = !reminderEnabled;
                              setReminderEnabled(newValue);
                              localStorage.setItem('daily_reminder_enabled', JSON.stringify(newValue));
                            }}
                            className="flex items-center gap-2 group cursor-pointer select-none"
                          >
                            <div
                              className={`w-8 h-4.5 rounded-full p-0.5 transition-colors duration-200 ease-in-out border ${
                                reminderEnabled
                                  ? 'bg-editorial-accent border-editorial-accent'
                                  : 'bg-editorial-dark/10 border-editorial-dark/15'
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded-full bg-editorial-bg shadow-sm transform transition-transform duration-200 ease-in-out ${
                                  reminderEnabled ? 'translate-x-3.5' : 'translate-x-0'
                                }`}
                              />
                            </div>
                            <span className="text-[10px] font-mono font-medium text-editorial-dark/60 group-hover:text-editorial-dark transition-colors uppercase tracking-wider">
                              Daily Reminder
                            </span>
                          </button>

                          {reminderEnabled && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[9px] font-mono text-editorial-dark/40 uppercase">at</span>
                              <input
                                type="time"
                                value={reminderTime}
                                onChange={(e) => {
                                  setReminderTime(e.target.value);
                                  localStorage.setItem('daily_reminder_time', e.target.value);
                                }}
                                className="rounded-none border border-editorial-dark/25 bg-editorial-bg px-1.5 py-0.5 text-[10px] font-mono text-editorial-dark focus:border-editorial-accent focus:outline-hidden"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {lastToggleBackup && lastToggleDate === selectedDate && (
                        <button
                          type="button"
                          id="quick-goal-undo"
                          onClick={handleUndoToggle}
                          className="inline-flex items-center gap-1.5 text-[10px] font-mono font-medium text-editorial-accent hover:underline cursor-pointer"
                        >
                          <RotateCcw size={11} className="stroke-[2.5]" />
                          <span>Undo last toggle</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Daily Aggregates Bento Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Habits completion card */}
                  <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none bg-editorial-emerald-light border border-editorial-emerald/20 text-editorial-emerald">
                        <CheckCircle2 size={22} className="stroke-[1.5px]" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-wider">Goal Completion</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-3xl font-mono font-light text-editorial-dark leading-none">{dailyStats.completedGoals}</span>
                          <span className="text-xs font-serif italic text-editorial-dark/75">of {dailyStats.withGoals} habits</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 self-center">
                      <DiffIndicator diff={dailyStats.completedGoals - prevDailyStats.completedGoals} />
                      <span className="text-[8px] font-mono text-editorial-dark/45 uppercase tracking-wider">vs yesterday</span>
                    </div>
                  </div>

                  {/* Completion Rate Indicator bar */}
                  <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4.5 flex-1 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none bg-editorial-indigo-light border border-editorial-indigo/20 text-editorial-indigo">
                        <TrendingUp size={22} className="stroke-[1.5px]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="block text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-wider">Daily Achievement</span>
                        <span className="text-3xl font-mono font-light text-editorial-dark block mt-1 leading-none">{dailyStats.completionRate}%</span>
                        {dailyStats.withGoals > 0 && (
                          <div className="h-1 w-full bg-editorial-dark/10 rounded-none overflow-hidden mt-2">
                            <div className="h-full bg-editorial-accent" style={{ width: `${dailyStats.completionRate}%` }} />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 self-center">
                      <DiffIndicator diff={dailyStats.completionRate - prevDailyStats.completionRate} prefix="%" />
                      <span className="text-[8px] font-mono text-editorial-dark/45 uppercase tracking-wider">vs yesterday</span>
                    </div>
                  </div>

                  {/* Streak Card */}
                  <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none bg-editorial-orange-light border border-editorial-orange/20 text-editorial-orange">
                        <Flame size={22} className="stroke-[1.5px] fill-editorial-orange/10" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-wider">Goal Streak</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-3xl font-mono font-light text-editorial-dark leading-none">
                            {goalStreaks.currentStreak}
                          </span>
                          <span className="text-xs font-serif italic text-editorial-dark/75">
                            {goalStreaks.currentStreak === 1 ? 'day' : 'days'}
                          </span>
                        </div>
                        <div className="text-[9px] font-mono text-editorial-dark/60 mt-1">
                          <span>Longest: {goalStreaks.longestStreak}d record</span>
                        </div>
                      </div>
                    </div>
                    {goalStreaks.currentStreak > 0 && (
                      <div className="flex flex-col items-end gap-1 shrink-0 self-center">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-editorial-orange bg-editorial-orange-light border border-editorial-orange/20 px-1.5 py-0.5 animate-pulse">
                          <Sparkles size={10} />
                          <span>ACTIVE</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Overall logging actions */}
                  <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4.5">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-none bg-editorial-amber-light border border-editorial-amber/20 text-editorial-amber">
                        <Award size={22} className="stroke-[1.5px]" />
                      </div>
                      <div>
                        <span className="block text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-wider">Historical Logs</span>
                        <div className="flex items-baseline gap-1 mt-1">
                          <span className="text-3xl font-mono font-light text-editorial-dark leading-none">{totalLogsCount}</span>
                          <span className="text-xs font-serif italic text-editorial-dark/75">entries</span>
                        </div>
                        <div className="text-[9px] font-mono text-editorial-dark/60 mt-1 flex items-center gap-1">
                          <span>Today: {selectedDateLogVolume} logs</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 self-center">
                      <DiffIndicator diff={selectedDateLogVolume - prevDailyStats.logVolume} />
                      <span className="text-[8px] font-mono text-editorial-dark/45 uppercase tracking-wider">vs yesterday</span>
                    </div>
                  </div>
                </div>

                {/* Daily Reflection Section */}
                <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between border-b border-editorial-dark/10 pb-2">
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-editorial-accent" />
                        <h3 className="text-xs font-mono text-editorial-accent tracking-widest uppercase">Daily Reflection</h3>
                      </div>
                      {reflections.some(r => r.date === selectedDate) && !isEditingReflection && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const ref = reflections.find(r => r.date === selectedDate);
                              setReflectionInput(ref ? ref.text : '');
                              setIsEditingReflection(true);
                            }}
                            className="text-[11px] font-mono font-semibold text-editorial-dark/50 hover:text-editorial-accent transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>
                          <span className="text-editorial-dark/20 text-xs">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm('Are you sure you want to clear your reflection for this day?')) {
                                handleSaveReflection(selectedDate, '');
                              }
                            }}
                            className="text-[11px] font-mono font-semibold text-editorial-dark/50 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 size={12} />
                            <span>Clear</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {isEditingReflection || !reflections.some(r => r.date === selectedDate) ? (
                      <div className="space-y-3">
                        <textarea
                          value={reflectionInput}
                          onChange={(e) => setReflectionInput(e.target.value)}
                          placeholder="How was your day? Write down any reflections, breakthroughs, challenges, or summary notes here..."
                          rows={3}
                          className="w-full rounded-none border border-editorial-dark/20 bg-editorial-bg p-3.5 text-xs font-serif font-medium text-editorial-dark outline-hidden focus:border-editorial-accent transition-all leading-relaxed"
                        />
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              handleSaveReflection(selectedDate, reflectionInput);
                              setIsEditingReflection(false);
                            }}
                            className="bg-editorial-accent hover:bg-editorial-dark text-editorial-bg font-mono text-xs px-4 py-2 rounded-none transition-colors flex items-center gap-1.5 cursor-pointer"
                          >
                            <Save size={13} />
                            <span>Save Note</span>
                          </button>
                          {reflections.some(r => r.date === selectedDate) && (
                            <button
                              type="button"
                              onClick={() => {
                                const ref = reflections.find(r => r.date === selectedDate);
                                setReflectionInput(ref ? ref.text : '');
                                setIsEditingReflection(false);
                              }}
                              className="border border-editorial-dark/20 hover:bg-editorial-dark/5 text-editorial-dark/70 font-mono text-xs px-4 py-2 rounded-none transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="relative pl-5 py-1">
                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-editorial-accent" />
                        <p className="text-sm font-serif italic text-editorial-dark/90 leading-relaxed whitespace-pre-wrap">
                          "{reflections.find(r => r.date === selectedDate)?.text}"
                        </p>
                        {reflections.find(r => r.date === selectedDate)?.updatedAt && (
                          <span className="block mt-2 text-[9px] font-mono text-editorial-dark/45 uppercase tracking-wider">
                            Logged at {new Date(reflections.find(r => r.date === selectedDate)!.updatedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Milestones & Checkpoints Area */}
                  <div className="border-t border-editorial-dark/10 pt-4 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Flag size={14} className="text-editorial-accent" />
                        <h4 className="text-xs font-mono text-editorial-accent tracking-widest uppercase">Time-Stamped Milestones</h4>
                      </div>
                      
                      {/* Dashboard Toggle Switch */}
                      <button
                        type="button"
                        onClick={() => handleToggleShowMilestones(selectedDate)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono border transition-all cursor-pointer ${
                          activeReflection?.showMilestonesOnDashboard ?? true
                            ? 'bg-editorial-accent-light text-editorial-accent border-editorial-accent/30'
                            : 'bg-transparent text-editorial-dark/40 border-editorial-dark/15 hover:border-editorial-dark/30 hover:text-editorial-dark/70'
                        }`}
                        title="Toggle to display milestones as bubbles on the dashboard"
                      >
                        {activeReflection?.showMilestonesOnDashboard ?? true ? (
                          <>
                            <Eye size={12} />
                            <span>Dashboard Bubbles: ON</span>
                          </>
                        ) : (
                          <>
                            <EyeOff size={12} />
                            <span>Dashboard Bubbles: OFF</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Milestone Add Form */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (milestoneTextInput.trim()) {
                          handleAddMilestone(selectedDate, milestoneTimeInput, milestoneTextInput, milestoneImportanceInput);
                          setMilestoneTextInput('');
                          setMilestoneImportanceInput(undefined);
                        }
                      }}
                      className="flex flex-col sm:flex-row items-stretch gap-2"
                    >
                      <div className="flex items-center border border-editorial-dark/20 bg-editorial-bg px-2 shrink-0 sm:w-32">
                        <Clock size={12} className="text-editorial-dark/40 mr-1.5" />
                        <input
                          type="time"
                          value={milestoneTimeInput}
                          onChange={(e) => setMilestoneTimeInput(e.target.value)}
                          className="w-full bg-transparent border-0 text-xs font-mono text-editorial-dark p-1.5 outline-hidden focus:ring-0 cursor-pointer"
                          required
                        />
                      </div>
                      <div className="flex-1 flex items-stretch border border-editorial-dark/20 bg-editorial-bg px-2">
                        <input
                          type="text"
                          value={milestoneTextInput}
                          onChange={(e) => setMilestoneTextInput(e.target.value)}
                          placeholder="Log a milestone (e.g. Completed morning jog, Met milestone 1)"
                          className="w-full bg-transparent border-0 text-xs font-serif italic text-editorial-dark p-1.5 outline-hidden focus:ring-0 placeholder:text-editorial-dark/30"
                          required
                        />
                      </div>
                      
                      {/* Importance Level Selector */}
                      <div className="flex items-center border border-editorial-dark/20 bg-editorial-bg px-2 shrink-0 sm:w-36">
                        <select
                          value={milestoneImportanceInput || ''}
                          onChange={(e) => setMilestoneImportanceInput(e.target.value ? e.target.value as 'low' | 'medium' | 'high' : undefined)}
                          className="w-full bg-transparent border-0 text-xs font-mono text-editorial-dark p-1.5 outline-hidden focus:ring-0 cursor-pointer"
                        >
                          <option value="" className="bg-editorial-bg text-editorial-dark/60">Importance...</option>
                          <option value="low" className="bg-editorial-bg text-editorial-blue font-semibold">Low Priority</option>
                          <option value="medium" className="bg-editorial-bg text-editorial-orange font-semibold">Medium Priority</option>
                          <option value="high" className="bg-editorial-bg text-editorial-rose font-semibold">High Priority</option>
                        </select>
                      </div>

                      <button
                        type="submit"
                        className="bg-editorial-dark hover:bg-editorial-accent hover:text-editorial-bg text-editorial-bg font-mono text-xs px-4 py-2 rounded-none transition-colors shrink-0 flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus size={13} />
                        <span>Add</span>
                      </button>
                    </form>

                    {/* Timeline List of Milestones */}
                    {activeReflection?.milestones && activeReflection.milestones.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {[...activeReflection.milestones]
                          .sort((a, b) => a.time.localeCompare(b.time))
                          .map((ms) => (
                            <div
                              key={ms.id}
                              className="flex items-center justify-between border border-editorial-dark/10 p-2.5 bg-editorial-dark/[0.01] hover:bg-editorial-dark/[0.03] transition-all"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="shrink-0 font-mono text-[10px] font-bold bg-editorial-accent/10 text-editorial-accent px-1.5 py-0.5 border border-editorial-accent/15">
                                  {ms.time}
                                </span>
                                {ms.importance && (
                                  <span className={`shrink-0 text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border rounded-none ${
                                    ms.importance === 'high'
                                      ? 'bg-editorial-rose-light text-editorial-rose border-editorial-rose/25'
                                      : ms.importance === 'medium'
                                      ? 'bg-editorial-orange-light text-editorial-orange border-editorial-orange/25'
                                      : 'bg-editorial-blue-light text-editorial-blue border-editorial-blue/25'
                                  }`}>
                                    {ms.importance}
                                  </span>
                                )}
                                <span className="text-xs font-serif italic text-editorial-dark/85 truncate leading-relaxed">
                                  {ms.text}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteMilestone(selectedDate, ms.id)}
                                className="text-editorial-dark/30 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                                title="Delete milestone"
                              >
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-[11px] font-sans text-editorial-dark/45 italic py-1">
                        No timestamped milestones recorded for this day yet. Add key checkpoints above to keep a clear timeline.
                      </p>
                    )}
                  </div>
                </div>

                {/* Milestone Bubbles on Dashboard */}
                {activeReflection?.showMilestonesOnDashboard && activeReflection.milestones && activeReflection.milestones.length > 0 && (
                  <div className="bg-editorial-bg p-5 rounded-none border border-editorial-dark/15 border-l-2 border-l-editorial-accent space-y-3">
                    <div className="flex items-center gap-1.5">
                      <Flag size={13} className="text-editorial-accent" />
                      <h4 className="text-[10px] font-mono text-editorial-accent tracking-widest uppercase font-semibold">Timeline Checkpoints</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[...activeReflection.milestones]
                        .sort((a, b) => a.time.localeCompare(b.time))
                        .map((ms) => (
                          <div
                            key={ms.id}
                            className={`flex items-center gap-2 border px-3.5 py-1.5 rounded-full shadow-xs transition-all duration-200 ${
                              ms.importance === 'high'
                                ? 'bg-editorial-rose-light/70 border-editorial-rose/30 text-editorial-dark'
                                : ms.importance === 'medium'
                                ? 'bg-editorial-orange-light/70 border-editorial-orange/30 text-editorial-dark'
                                : ms.importance === 'low'
                                ? 'bg-editorial-blue-light/70 border-editorial-blue/30 text-editorial-dark'
                                : 'bg-editorial-accent-light/50 border-editorial-accent/20 text-editorial-dark'
                            }`}
                          >
                            <span className={`font-mono text-[9px] font-bold text-editorial-bg px-2 py-0.5 rounded-full select-none ${
                              ms.importance === 'high'
                                ? 'bg-editorial-rose'
                                : ms.importance === 'medium'
                                ? 'bg-editorial-orange'
                                : ms.importance === 'low'
                                ? 'bg-editorial-blue'
                                : 'bg-editorial-accent'
                            }`}>
                              {ms.time}
                            </span>
                            <span className="text-xs font-serif font-medium text-editorial-dark/95 leading-none">
                              {ms.text}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Goal Notes Chronological Scan Panel */}
                <GoalNotesPanel
                  reflections={reflections}
                  trackers={trackers}
                  logs={logs}
                  onSaveGoalNote={handleSaveGoalNote}
                />

                {/* Tracker Cards Grid Display */}
                <div>
                  <div className="flex items-center justify-between mb-4 border-b border-editorial-dark/10 pb-2">
                    <h3 id="tracked-metrics-heading" className="text-xs font-mono text-editorial-accent tracking-widest uppercase">Tracked Metrics</h3>
                    {trackers.length > 0 && (
                      <span className="text-xs font-serif italic text-editorial-dark/65">
                        {trackers.length} active monitors
                      </span>
                    )}
                  </div>

                  {trackers.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                      {trackers.map((tracker) => (
                        <TrackerCard
                          key={tracker.id}
                          tracker={tracker}
                          logs={logs}
                          selectedDate={selectedDate}
                          onLogValue={handleLogValue}
                          onDeleteLog={handleDeleteLog}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-16 text-center border border-dashed border-editorial-dark/25 rounded-none bg-editorial-bg space-y-5">
                      <div className="p-4 bg-editorial-accent-light text-editorial-accent border border-editorial-accent/30 rounded-none">
                        <Sparkles size={32} />
                      </div>
                      <div>
                        <h3 className="font-serif text-lg text-editorial-dark">Setup Your First Tracker</h3>
                        <p className="text-xs font-sans text-editorial-dark/70 max-w-sm mt-1 mx-auto leading-relaxed">
                          You don't have any metrics configured yet. Create trackers to start logging water, habits, mood, steps, sleep, and more!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAddTrackerOpen(true)}
                        className="bg-editorial-accent hover:bg-editorial-dark text-editorial-bg font-mono text-xs px-5 py-3 rounded-none transition-colors"
                      >
                        Create Tracker Now
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {currentTab === 'analytics' && (
              <motion.div
                key="analytics-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <TrackerAnalytics trackers={trackers} logs={logs} />
              </motion.div>
            )}

            {currentTab === 'history' && (
              <motion.div
                key="history-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <LogHistory
                  trackers={trackers}
                  logs={logs}
                  onDeleteLog={handleDeleteLog}
                  onUpdateLog={handleUpdateLog}
                />
              </motion.div>
            )}

            {currentTab === 'manage' && (
              <motion.div
                key="manage-view"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.25 }}
              >
                <ManageTrackers
                  trackers={trackers}
                  onDeleteTracker={handleDeleteTracker}
                  onUpdateTracker={handleUpdateTracker}
                  logsCountMap={logsCountMap}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Footer Branding Area */}
      <footer className="bg-editorial-bg border-t border-editorial-dark/15 py-8 mt-auto px-4 text-center">
        <p className="text-[10px] font-mono tracking-widest text-editorial-dark/50 uppercase">
          Data Tracker • Client-Side Ledger & Analytics
        </p>
      </footer>

      {/* Add Tracker Builder Modal overlay */}
      <AddTrackerModal
        isOpen={isAddTrackerOpen}
        onClose={() => setIsAddTrackerOpen(false)}
        onAdd={handleAddTracker}
      />
    </div>
  );
}
