/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Tracker, LogEntry, CATEGORIES, COLOR_MAP, DailyReflection, Milestone, MILESTONE_CATEGORIES } from './types';
import { loadData, saveTrackers, saveLogs, saveReflections, exportDataAsJson, importDataFromJson } from './utils/storage';
import { importLogsFromCSV, parseCSV, ColumnMapping } from './utils/csvParser';

interface SavedPreset {
  id: string;
  name: string;
  dateHeader?: string;
  nameHeader?: string;
  valHeader?: string;
  catHeader?: string;
  unitHeader?: string;
  goalHeader?: string;
  notesHeader?: string;
  timestampHeader?: string;
  useSmartFormatting: boolean;
}
import { AddTrackerModal } from './components/AddTrackerModal';
import { CSVMappingModal } from './components/CSVMappingModal';
import { TrackerCard } from './components/TrackerCard';
import { calculateTrendAlert } from './utils/trendAlerts';
import { TrackerAnalytics } from './components/TrackerAnalytics';
import { LogHistory } from './components/LogHistory';
import { ManageTrackers } from './components/ManageTrackers';
import { LucideIcon } from './components/LucideIcon';
import { GoalNotesPanel } from './components/GoalNotesPanel';
import { MotivationalQuote } from './components/MotivationalQuote';
import { WeeklySummaryDashboardWidget } from './components/WeeklySummaryDashboardWidget';
import { MonthlyGoalsSummary } from './components/MonthlyGoalsSummary';
import { DateComparisonDashboardView } from './components/DateComparisonDashboardView';
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
  EyeOff,
  Copy,
  Check,
  Search,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Filter,
  Sliders,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

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
  const [showCSVHelpPopover, setShowCSVHelpPopover] = useState(false);
  const [copiedCSVExample, setCopiedCSVExample] = useState(false);
  const [isDraggingCSV, setIsDraggingCSV] = useState(false);
  const [trackerSearchQuery, setTrackerSearchQuery] = useState('');
  const [showTrackerSearchDropdown, setShowTrackerSearchDropdown] = useState(false);
  const [copiedTrackerName, setCopiedTrackerName] = useState<string | null>(null);
  const [csvImportStatus, setCsvImportStatus] = useState<'success' | 'error' | 'warning' | null>(null);
  const [csvImportMessage, setCsvImportMessage] = useState<string>('');
  const [isCSVMappingModalOpen, setIsCSVMappingModalOpen] = useState(false);
  const [pendingCSVHeaders, setPendingCSVHeaders] = useState<string[]>([]);
  const [pendingCSVText, setPendingCSVText] = useState<string>('');
  const [lastToggleBackup, setLastToggleBackup] = useState<LogEntry[] | null>(null);
  const [lastToggleDate, setLastToggleDate] = useState<string | null>(null);
  const [lastImportedLogIds, setLastImportedLogIds] = useState<string[]>([]);
  const [isClearLogsConfirmOpen, setIsClearLogsConfirmOpen] = useState(false);
  const [csvRowFilterQuery, setCsvRowFilterQuery] = useState('');
  const [selectedCSVFileName, setSelectedCSVFileName] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [smartAutoImport, setSmartAutoImport] = useState<boolean>(() => {
    const saved = localStorage.getItem('csv_smart_auto_import');
    return saved ? JSON.parse(saved) : true;
  });
  const [lastAppliedPresetName, setLastAppliedPresetName] = useState<string | null>(null);

  // States for interactive CSV Import Progress Dashboard
  const [csvImportStep, setCsvImportStep] = useState<'idle' | 'file_loaded' | 'mapping' | 'importing' | 'success' | 'error'>('idle');
  const [totalParsedRows, setTotalParsedRows] = useState<number>(0);
  const [mappedColumnsCount, setMappedColumnsCount] = useState<number>(0);
  const [importedLogsCount, setImportedLogsCount] = useState<number>(0);
  const [isSimulatingImport, setIsSimulatingImport] = useState<boolean>(false);
  const [importedProgressPercentage, setImportedProgressPercentage] = useState<number>(0);

  // Shared state for filtering history logs, so we can export currently visible logs
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historyFilterTrackerId, setHistoryFilterTrackerId] = useState('all');
  const [historyFilterCategory, setHistoryFilterCategory] = useState('all');

  // Dashboard filtering state
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [dashboardSelectedTag, setDashboardSelectedTag] = useState<string>('all');
  
  // Side-by-side date comparison state
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [comparisonDate, setComparisonDate] = useState<string>(() => {
    // Default comparison date is 1 day before selectedDate (yesterday relative to current time)
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return yesterday.toISOString().split('T')[0];
  });

  // Reflection editor state
  const [reflectionInput, setReflectionInput] = useState<string>('');
  const [isEditingReflection, setIsEditingReflection] = useState<boolean>(false);

  // Milestone inputs
  const [milestoneTimeInput, setMilestoneTimeInput] = useState<string>('');
  const [milestoneTextInput, setMilestoneTextInput] = useState<string>('');
  const [milestoneImportanceInput, setMilestoneImportanceInput] = useState<'low' | 'medium' | 'high' | undefined>(undefined);
  const [milestoneNotesInput, setMilestoneNotesInput] = useState<string>('');
  const [milestoneCategoryInput, setMilestoneCategoryInput] = useState<string>('');

  const getCurrentTimeHHMM = () => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };

  useEffect(() => {
    setMilestoneTimeInput(getCurrentTimeHHMM());
    setMilestoneTextInput('');
    setMilestoneImportanceInput(undefined);
    setMilestoneNotesInput('');
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

  const handleAddMilestone = (date: string, time: string, text: string, importance?: 'low' | 'medium' | 'high', notes?: string, category?: string) => {
    if (!text.trim() || !time) return;
    const newMilestone: Milestone = {
      id: Math.random().toString(36).substring(2, 9),
      time,
      text: text.trim(),
      importance,
      notes: notes?.trim() || undefined,
      category: category || undefined,
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

  const handleSaveMilestone = (trackerId: string, date: string, milestoneText: string | undefined) => {
    const trackerLogs = logs.filter(l => l.trackerId === trackerId && l.date === date);
    let updatedLogs = [...logs];
    if (trackerLogs.length > 0) {
      const latest = trackerLogs[trackerLogs.length - 1];
      updatedLogs = logs.map(l => l.id === latest.id ? { ...l, milestone: milestoneText || undefined } : l);
    } else {
      const tracker = trackers.find(t => t.id === trackerId);
      if (!tracker) return;
      const baseValue = tracker.type === 'boolean' ? 1 : tracker.type === 'rating' ? 3 : 0;
      const newLog: LogEntry = {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        trackerId,
        value: baseValue,
        date,
        timestamp: new Date().toISOString(),
        milestone: milestoneText || undefined,
      };
      updatedLogs.push(newLog);
    }
    setLogs(updatedLogs);
    saveLogs(updatedLogs);
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

  // Compute overall percentage for multi-step CSV uploader status bar
  const overallPercentage = useMemo(() => {
    if (!selectedCSVFileName) return 0;
    if (csvImportStep === 'file_loaded') {
      return 33 + Math.round((mappedColumnsCount / 3) * 33);
    }
    if (csvImportStep === 'importing' || isSimulatingImport) {
      return 66 + Math.round((importedProgressPercentage / 100) * 34);
    }
    if (csvImportStep === 'success') {
      return 100;
    }
    return 33;
  }, [selectedCSVFileName, csvImportStep, mappedColumnsCount, importedProgressPercentage, isSimulatingImport]);

  // Extract all unique tags across configured trackers
  const allUniqueTags = useMemo(() => {
    const tagsSet = new Set<string>();
    trackers.forEach(t => {
      if (t.tags) {
        t.tags.forEach(tag => tagsSet.add(tag));
      }
    });
    return Array.from(tagsSet).sort();
  }, [trackers]);

  // Filter trackers by dashboard search query and selected tag
  const filteredTrackers = useMemo(() => {
    return trackers.filter(t => {
      const matchesSearch = dashboardSearchQuery.trim() === '' || 
        t.name.toLowerCase().includes(dashboardSearchQuery.toLowerCase()) ||
        t.category.toLowerCase().includes(dashboardSearchQuery.toLowerCase()) ||
        (t.tags && t.tags.some(tag => tag.toLowerCase().includes(dashboardSearchQuery.toLowerCase())));

      const matchesTag = dashboardSelectedTag === 'all' || 
        (t.tags && t.tags.includes(dashboardSelectedTag));

      return matchesSearch && matchesTag;
    });
  }, [trackers, dashboardSearchQuery, dashboardSelectedTag]);

  // Calculate all active trend alerts on the selected date
  const activeTrendAlerts = useMemo(() => {
    return trackers
      .map(tracker => {
        const result = calculateTrendAlert(tracker, logs, selectedDate);
        return {
          tracker,
          ...result
        };
      })
      .filter(item => item.isAlert);
  }, [trackers, logs, selectedDate]);

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

  // Calculate past 7 days of goal completion rates ending on selectedDate for trend visualization
  const last7DaysData = useMemo(() => {
    if (!selectedDate) return [];
    
    const data = [];
    const baseDate = new Date(selectedDate + 'T12:00:00');
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      
      // Calculate completion rate for dStr
      let completedGoalsOnDate = 0;
      let trackersWithGoals = 0;
      
      trackers.forEach(t => {
        if (t.targetValue) {
          trackersWithGoals++;
          const tLogs = logs.filter(l => l.trackerId === t.id && l.date === dStr);
          const totalVal = t.type === 'counter'
            ? tLogs.reduce((sum, l) => sum + l.value, 0)
            : (tLogs.length > 0 ? tLogs[tLogs.length - 1].value : 0);

          if (totalVal >= t.targetValue) {
            completedGoalsOnDate++;
          }
        }
      });
      
      const completionRate = trackersWithGoals > 0 
        ? Math.round((completedGoalsOnDate / trackersWithGoals) * 100) 
        : 0;
        
      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const weekdayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      
      data.push({
        date: dStr,
        dayLabel,
        weekdayLabel,
        displayLabel: `${weekdayLabel} (${dayLabel})`,
        rate: completionRate,
        completed: completedGoalsOnDate,
        total: trackersWithGoals,
      });
    }
    
    return data;
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

  const processCSVFile = (file: File) => {
    setSelectedCSVFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const parsed = parseCSV(text);
        if (parsed.length === 0) {
          setCsvImportStatus('error');
          setCsvImportMessage('Error: CSV file is empty.');
          setSelectedCSVFileName(null);
          const timer = setTimeout(() => {
            setCsvImportStatus(null);
            setCsvImportMessage('');
          }, 5000);
          return;
        }

        if (parsed.length < 2) {
          setCsvImportStatus('error');
          setCsvImportMessage('Error: CSV must contain a header row and at least one data row.');
          setSelectedCSVFileName(null);
          const timer = setTimeout(() => {
            setCsvImportStatus(null);
            setCsvImportMessage('');
          }, 5000);
          return;
        }

        const headerRow = parsed[0];
        let finalCSVText = text;

        if (csvRowFilterQuery.trim()) {
          const query = csvRowFilterQuery.toLowerCase().trim();
          const dataRows = parsed.slice(1).filter(row => 
            row.some(cell => cell.toLowerCase().includes(query))
          );
          if (dataRows.length === 0) {
            setCsvImportStatus('error');
            setCsvImportMessage(`Error: No rows match filter "${csvRowFilterQuery}".`);
            setSelectedCSVFileName(null);
            const timer = setTimeout(() => {
              setCsvImportStatus(null);
              setCsvImportMessage('');
            }, 5000);
            return;
          }
          const filteredParsed = [headerRow, ...dataRows];
          
          // Rebuild the filtered CSV text
          const rebuildCSVText = (rows: string[][]): string => {
            return rows.map(r => 
              r.map(cell => {
                const stringified = String(cell);
                if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n') || stringified.includes('\r')) {
                  return `"${stringified.replace(/"/g, '""')}"`;
                }
                return stringified;
              }).join(',')
            ).join('\n');
          };
          finalCSVText = rebuildCSVText(filteredParsed);
        }

        setPendingCSVHeaders(headerRow);
        setPendingCSVText(finalCSVText);
        setTotalParsedRows(parsed.length - 1);
        setCsvImportStep('file_loaded');
        setImportedLogsCount(0);
        setImportedProgressPercentage(0);
        setIsSimulatingImport(false);
        // Do NOT open the mapping modal automatically anymore!

        let didAutoImport = false;
        if (smartAutoImport) {
          const stored = localStorage.getItem('csv_custom_mapping_presets');
          if (stored) {
            try {
              const presets: SavedPreset[] = JSON.parse(stored);
              const headerRowLower = headerRow.map(h => h.trim().toLowerCase());
              const matchingPreset = [...presets].reverse().find(p => {
                if (!p.dateHeader || !p.nameHeader || !p.valHeader) return false;
                const hasDate = headerRowLower.includes(p.dateHeader.trim().toLowerCase());
                const hasName = headerRowLower.includes(p.nameHeader.trim().toLowerCase());
                const hasVal = headerRowLower.includes(p.valHeader.trim().toLowerCase());
                return hasDate && hasName && hasVal;
              });

              if (matchingPreset) {
                const dateIdx = headerRow.findIndex(h => h.trim().toLowerCase() === matchingPreset.dateHeader?.trim().toLowerCase());
                const nameIdx = headerRow.findIndex(h => h.trim().toLowerCase() === matchingPreset.nameHeader?.trim().toLowerCase());
                const valIdx = headerRow.findIndex(h => h.trim().toLowerCase() === matchingPreset.valHeader?.trim().toLowerCase());

                const catIdx = matchingPreset.catHeader ? headerRow.findIndex(h => h.trim().toLowerCase() === matchingPreset.catHeader.trim().toLowerCase()) : -1;
                const unitIdx = matchingPreset.unitHeader ? headerRow.findIndex(h => h.trim().toLowerCase() === matchingPreset.unitHeader.trim().toLowerCase()) : -1;
                const goalIdx = matchingPreset.goalHeader ? headerRow.findIndex(h => h.trim().toLowerCase() === matchingPreset.goalHeader.trim().toLowerCase()) : -1;
                const notesIdx = matchingPreset.notesHeader ? headerRow.findIndex(h => h.trim().toLowerCase() === matchingPreset.notesHeader.trim().toLowerCase()) : -1;
                const timestampIdx = matchingPreset.timestampHeader ? headerRow.findIndex(h => h.trim().toLowerCase() === matchingPreset.timestampHeader.trim().toLowerCase()) : -1;

                const mapping: ColumnMapping = {
                  dateIdx,
                  nameIdx,
                  valIdx,
                  catIdx: catIdx !== -1 ? catIdx : undefined,
                  unitIdx: unitIdx !== -1 ? unitIdx : undefined,
                  goalIdx: goalIdx !== -1 ? goalIdx : undefined,
                  notesIdx: notesIdx !== -1 ? notesIdx : undefined,
                  timestampIdx: timestampIdx !== -1 ? timestampIdx : undefined,
                };

                setMappedColumnsCount(3);
                setLastAppliedPresetName(matchingPreset.name);
                handleConfirmCSVMapping(mapping, matchingPreset.useSmartFormatting, finalCSVText);
                didAutoImport = true;
              }
            } catch (err) {
              console.error('Error in smart auto-import:', err);
            }
          }
        }

        if (!didAutoImport) {
          setMappedColumnsCount(0);
          setLastAppliedPresetName(null);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmCSVMapping = (mapping: ColumnMapping, useSmartFormatting: boolean, csvTextOverride?: string) => {
    const textToUse = csvTextOverride !== undefined ? csvTextOverride : pendingCSVText;
    const result = importLogsFromCSV(textToUse, trackers, mapping, useSmartFormatting);
    if (result && result.importedCount > 0) {
      setIsSimulatingImport(true);
      setCsvImportStep('importing');
      setImportedProgressPercentage(0);
      setImportedLogsCount(0);

      const totalRows = result.importedCount;
      let currentProgress = 0;

      const interval = setInterval(() => {
        // Increment by steps of 10% or at least 1 row
        const increment = Math.max(1, Math.floor(totalRows / 10));
        currentProgress += increment;

        if (currentProgress >= totalRows) {
          clearInterval(interval);
          setImportedProgressPercentage(100);
          setImportedLogsCount(totalRows);
          setCsvImportStep('success');
          setIsSimulatingImport(false);

          // Perform actual data application
          setTrackers(result.trackers);
          const updatedLogs = [...logs, ...result.logs];
          setLogs(updatedLogs);
          saveTrackers(result.trackers);
          saveLogs(updatedLogs);
          
          // Store imported log IDs to support batch deletion
          const importedIds = result.logs.map(l => l.id);
          setLastImportedLogIds(importedIds);
          
          const filterSuffix = csvRowFilterQuery.trim() ? ` (filtered by "${csvRowFilterQuery.trim()}")` : '';
          const presetSuffix = lastAppliedPresetName ? ` (automatically mapped via "${lastAppliedPresetName}" preset)` : '';
          setCsvImportStatus('success');
          setCsvImportMessage(`Successfully imported ${result.importedCount} logs${filterSuffix}${presetSuffix}!`);
          setLastAppliedPresetName(null);
          
          // Keep the uploader dashboard showing 100% success state, but clear temporary status messages after 5 seconds
          setTimeout(() => {
            setCsvImportStatus(null);
            setCsvImportMessage('');
          }, 5000);
        } else {
          const pct = Math.round((currentProgress / totalRows) * 100);
          setImportedProgressPercentage(pct);
          setImportedLogsCount(currentProgress);
        }
      }, 60);
    } else {
      setCsvImportStep('error');
      setCsvImportStatus('error');
      setCsvImportMessage('Import failed. No valid log rows were parsed or imported.');
      setLastAppliedPresetName(null);
      
      // Reset status after 5 seconds
      setTimeout(() => {
        setCsvImportStatus(null);
        setCsvImportMessage('');
        setCsvImportStep('idle');
      }, 5000);
    }
  };

  const handleQuickResetCSV = () => {
    setSelectedCSVFileName(null);
    setPendingCSVText('');
    setPendingCSVHeaders([]);
    setCsvImportStep('idle');
    setCsvImportStatus(null);
    setCsvImportMessage('');
    setMappedColumnsCount(0);
    setTotalParsedRows(0);
    setImportedLogsCount(0);
    setImportedProgressPercentage(0);
    setIsSimulatingImport(false);
    setLastAppliedPresetName(null);
  };

  const handleRevertLastCSVImport = () => {
    if (lastImportedLogIds.length === 0) return;
    
    const filteredLogs = logs.filter(l => !lastImportedLogIds.includes(l.id));
    setLogs(filteredLogs);
    saveLogs(filteredLogs);
    
    const count = lastImportedLogIds.length;
    setLastImportedLogIds([]);
    
    setCsvImportStatus('warning');
    setCsvImportMessage(`Reverted last import: Deleted ${count} logs.`);
    
    // Reset status after 5 seconds
    setTimeout(() => {
      setCsvImportStatus(null);
      setCsvImportMessage('');
    }, 5000);
  };

  const handleClearAllLogs = () => {
    if (logs.length === 0) return;
    
    const count = logs.length;
    setLogs([]);
    saveLogs([]);
    setLastImportedLogIds([]);
    
    setCsvImportStatus('warning');
    setCsvImportMessage(`Cleared all logs: Deleted ${count} log entries across all trackers.`);
    setIsClearLogsConfirmOpen(false);
    
    // Reset status after 5 seconds
    setTimeout(() => {
      setCsvImportStatus(null);
      setCsvImportMessage('');
    }, 5000);
  };

  // CSV Import backing trigger
  const handleImportCSVFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.name.endsWith('.csv')) {
      processCSVFile(file);
    } else {
      setCsvImportStatus('warning');
      setCsvImportMessage('Warning: Invalid file type. Please select a .csv file.');
      const timer = setTimeout(() => {
        setCsvImportStatus(null);
        setCsvImportMessage('');
      }, 5000);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDraggingCSV(true);
  };

  const handleDragLeave = () => {
    setIsDraggingCSV(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDraggingCSV(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      if (file.name.endsWith('.csv')) {
        processCSVFile(file);
      } else {
        setCsvImportStatus('warning');
        setCsvImportMessage('Warning: Invalid file type. Please drop a .csv file.');
        const timer = setTimeout(() => {
          setCsvImportStatus(null);
          setCsvImportMessage('');
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
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

  const getCurrentlyVisibleLogs = () => {
    // Sort logs descending by timestamp or date, matching history tab
    const sortedLogs = [...logs].sort((a, b) => {
      const dateA = new Date(a.timestamp || a.date).getTime();
      const dateB = new Date(b.timestamp || b.date).getTime();
      return dateB - dateA;
    });

    if (currentTab === 'history') {
      return sortedLogs.filter(log => {
        const tracker = trackers.find(t => t.id === log.trackerId);
        if (!tracker) return false;

        if (historyFilterTrackerId !== 'all' && log.trackerId !== historyFilterTrackerId) {
          return false;
        }

        if (historyFilterCategory !== 'all' && tracker.category !== historyFilterCategory) {
          return false;
        }

        if (historySearchQuery.trim()) {
          const query = historySearchQuery.toLowerCase();
          const matchesName = tracker.name.toLowerCase().includes(query);
          const matchesNote = log.note?.toLowerCase().includes(query) || false;

          const dNeutral = new Date(log.date + 'T12:00:00');
          const formattedShort = dNeutral.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }).toLowerCase();
          const formattedLong = dNeutral.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }).toLowerCase();

          const matchesDate = log.date.includes(query) || 
                              formattedShort.includes(query) || 
                              formattedLong.includes(query);

          if (!matchesName && !matchesNote && !matchesDate) {
            return false;
          }
        }

        return true;
      });
    } else if (currentTab === 'dashboard') {
      // Return logs for selected date (chronological)
      return logs.filter(l => l.date === selectedDate).sort((a, b) => {
        return (a.timestamp || '').localeCompare(b.timestamp || '');
      });
    } else {
      // Return all logs sorted chronologically
      return [...logs].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return (a.timestamp || '').localeCompare(b.timestamp || '');
      });
    }
  };

  const handleExportVisibleCSV = () => {
    const visibleLogsList = getCurrentlyVisibleLogs();
    if (visibleLogsList.length === 0) return;

    const escapeCSV = (str: any) => {
      if (str === null || str === undefined) return '';
      const stringified = String(str);
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n') || stringified.includes('\r')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };

    const headers = ['Date', 'Tracker Name', 'Category', 'Value', 'Unit', 'Goal', 'Notes', 'Logged At'];
    
    const rows = visibleLogsList.map(l => {
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
    
    let filename = `data_tracker_logs_${selectedDate}.csv`;
    if (currentTab === 'history') {
      const isFiltered = historyFilterTrackerId !== 'all' || historyFilterCategory !== 'all' || historySearchQuery.trim() !== '';
      filename = isFiltered ? 'data_tracker_logs_history_filtered.csv' : 'data_tracker_logs_history_all.csv';
    } else if (currentTab !== 'dashboard') {
      filename = 'data_tracker_logs_all.csv';
    }
    
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadCSVTemplate = () => {
    const headers = ['Date', 'Tracker Name', 'Value', 'Category', 'Unit', 'Goal', 'Notes'];
    const sampleRows = [
      ['2026-07-09', 'Water Intake', '8', 'Health', 'Glasses', '8', 'Target met!'],
      ['2026-07-09', 'Meditation', '15', 'Mindfulness', 'Minutes', '10', 'Focused session'],
      ['2026-07-09', 'Steps', '10000', 'Fitness', 'Steps', '10000', 'Daily target met!']
    ];
    
    const csvContent = [
      headers.join(','),
      ...sampleRows.map(row => row.map(val => {
        if (val.includes(',') || val.includes('"') || val.includes('\n') || val.includes('\r')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tracker_logs_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyCSVExample = () => {
    const exampleText = "Date,Tracker Name,Value,Notes\n2026-07-09,Water Intake,8,Target met!\n2026-07-09,Meditation,15,Focused session";
    navigator.clipboard.writeText(exampleText).then(() => {
      setCopiedCSVExample(true);
      setTimeout(() => {
        setCopiedCSVExample(false);
      }, 2000);
    });
  };

  const handleCopyTrackerName = (name: string) => {
    navigator.clipboard.writeText(name).then(() => {
      setCopiedTrackerName(name);
      setTimeout(() => {
        setCopiedTrackerName(null);
      }, 2000);
    });
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

  const formattedComparisonDate = useMemo(() => {
    if (!comparisonDate) return '';
    const dateObj = new Date(comparisonDate + 'T12:00:00');
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    if (comparisonDate === todayStr) return 'Today';
    if (comparisonDate === yesterdayStr) return 'Yesterday';

    return dateObj.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, [comparisonDate]);

  const comparisonDailyStats = useMemo(() => {
    const activeOnDate = trackers.length;
    let completedGoalsOnDate = 0;
    let trackersWithGoals = 0;

    trackers.forEach(t => {
      if (t.targetValue) {
        trackersWithGoals++;
        const tLogs = logs.filter(l => l.trackerId === t.id && l.date === comparisonDate);
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
  }, [trackers, logs, comparisonDate]);

  const comparisonChartData = useMemo(() => {
    return filteredTrackers.map(t => {
      // Date A logs
      const logsA = logs.filter(l => l.trackerId === t.id && l.date === selectedDate);
      const valA = t.type === 'counter'
        ? logsA.reduce((sum, l) => sum + l.value, 0)
        : (logsA.length > 0 ? logsA[logsA.length - 1].value : 0);

      // Date B logs
      const logsB = logs.filter(l => l.trackerId === t.id && l.date === comparisonDate);
      const valB = t.type === 'counter'
        ? logsB.reduce((sum, l) => sum + l.value, 0)
        : (logsB.length > 0 ? logsB[logsB.length - 1].value : 0);

      return {
        name: t.name,
        valueA: valA,
        valueB: valB,
        unit: t.unit || ''
      };
    });
  }, [filteredTrackers, logs, selectedDate, comparisonDate]);

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
            <div className="max-w-4xl mx-auto p-6 space-y-6">
              {/* Header JSON Controls Row */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-editorial-dark/10 pb-4">
                <div>
                  <h4 className="font-serif font-semibold text-base text-editorial-dark flex items-center gap-1.5">
                    <LucideIcon name="Settings" size={16} className="text-editorial-accent" />
                    Data Backups & Recovery
                  </h4>
                  <p className="text-xs text-editorial-dark/70 mt-0.5 leading-relaxed">
                    Preserve your statistics locally as physical backups or import existing logs.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5 items-center">
                  <button
                    type="button"
                    onClick={handleExportData}
                    className="flex items-center gap-1.5 bg-editorial-accent-light/50 hover:bg-editorial-accent-light/80 border border-editorial-dark/20 text-editorial-dark font-mono text-[10px] uppercase tracking-wider font-semibold px-3.5 py-2 transition-colors cursor-pointer"
                  >
                    <Download size={13} className="text-editorial-accent" />
                    Export Backup (JSON)
                  </button>

                  <label className="flex items-center gap-1.5 bg-editorial-bg hover:bg-editorial-accent-light/40 border border-editorial-dark/20 text-editorial-dark font-mono text-[10px] uppercase tracking-wider font-semibold px-3.5 py-2 transition-colors cursor-pointer">
                    <Upload size={13} className="text-editorial-accent" />
                    Restore Backup (JSON)
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleImportFile}
                      className="hidden"
                    />
                  </label>

                  {logs.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportCSV}
                      className="flex items-center gap-1.5 bg-editorial-orange-light/10 hover:bg-editorial-orange-light/20 border border-editorial-orange/20 text-editorial-orange font-mono text-[10px] uppercase tracking-wider font-semibold px-3.5 py-2 transition-colors cursor-pointer"
                    >
                      <Download size={13} />
                      Export Logs (CSV)
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsBackupSectionOpen(false)}
                    className="p-1.5 text-editorial-dark/40 hover:text-editorial-dark hover:bg-editorial-accent-light transition-colors rounded-none cursor-pointer"
                    title="Close backup panel"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* CSV Data Integration Center */}
              <div className="bg-white border border-editorial-dark/15 p-5 space-y-5 rounded-none shadow-sm relative text-sm">
                {/* Section Header */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-editorial-dark/10 pb-4">
                  <div>
                    <h5 className="font-serif font-medium text-sm text-editorial-dark flex items-center gap-2">
                      <div className="p-1.5 bg-editorial-orange-light/10 text-editorial-orange">
                        <Sliders size={14} />
                      </div>
                      CSV Spreadsheet Integration Center
                    </h5>
                    <p className="text-[10px] text-editorial-dark/50 mt-0.5 font-sans">
                      Multi-step spreadsheet mapper, validator, and entry importer
                    </p>
                  </div>

                  {/* Top Right Tool Bar */}
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* CSV Filter Rows input */}
                    <div className="relative flex items-center bg-editorial-bg border border-editorial-dark/15 focus-within:border-editorial-orange text-editorial-dark transition-all">
                      <span className="pl-2.5 pr-1 text-editorial-dark/40 flex items-center justify-center">
                        <Filter size={11} className="text-editorial-orange" />
                      </span>
                      <input
                        type="text"
                        value={csvRowFilterQuery}
                        onChange={(e) => setCsvRowFilterQuery(e.target.value)}
                        placeholder="Keyword row filter..."
                        className="bg-transparent border-0 py-1.5 pr-6 pl-1 text-[10px] font-sans placeholder-editorial-dark/35 outline-none w-36 shrink-0 rounded-none focus:ring-0 focus:outline-none"
                        title="Optionally filter rows by keyword before importing"
                      />
                      {csvRowFilterQuery && (
                        <button
                          type="button"
                          onClick={() => setCsvRowFilterQuery('')}
                          className="absolute right-1.5 text-editorial-dark/40 hover:text-editorial-orange p-0.5 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>

                    {/* Tracker Search Dropdown */}
                    <div className="relative inline-flex items-center">
                      <div className="relative flex items-center bg-editorial-bg border border-editorial-dark/15 focus-within:border-editorial-orange text-editorial-dark transition-all">
                        <span className="pl-2.5 pr-1 text-editorial-dark/40 flex items-center justify-center">
                          <Search size={11} />
                        </span>
                        <input
                          type="text"
                          value={trackerSearchQuery}
                          onChange={(e) => {
                            setTrackerSearchQuery(e.target.value);
                            setShowTrackerSearchDropdown(true);
                          }}
                          onFocus={() => setShowTrackerSearchDropdown(true)}
                          placeholder="Verify Tracker names..."
                          className="bg-transparent border-0 py-1.5 pr-6 pl-1 text-[10px] font-sans placeholder-editorial-dark/35 outline-none w-36 shrink-0 rounded-none focus:ring-0 focus:outline-none"
                        />
                        {trackerSearchQuery && (
                          <button
                            type="button"
                            onClick={() => {
                              setTrackerSearchQuery('');
                              setShowTrackerSearchDropdown(false);
                            }}
                            className="absolute right-1.5 text-editorial-dark/40 hover:text-editorial-orange p-0.5 flex items-center justify-center cursor-pointer transition-colors"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>

                      <AnimatePresence>
                        {showTrackerSearchDropdown && (
                          <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.12 }}
                            className="absolute right-0 top-full mt-2.5 z-50 w-64 bg-editorial-bg border border-editorial-dark/15 shadow-xl p-3.5 text-left font-sans select-none"
                          >
                            <div className="flex items-center justify-between border-b border-editorial-dark/10 pb-1.5 mb-1.5">
                              <span className="font-serif font-semibold text-[10px] text-editorial-dark flex items-center gap-1">
                                <Search size={11} className="text-editorial-orange" />
                                Exact Tracker Names
                              </span>
                              <button
                                type="button"
                                onClick={() => setShowTrackerSearchDropdown(false)}
                                className="text-editorial-dark/40 hover:text-editorial-dark p-0.5 transition-colors cursor-pointer"
                              >
                                <X size={10} />
                              </button>
                            </div>

                            <div className="max-h-36 overflow-y-auto space-y-1 pr-0.5 scrollbar-thin">
                              {(() => {
                                const filtered = trackers.filter(t => 
                                  t.name.toLowerCase().includes(trackerSearchQuery.toLowerCase()) ||
                                  (t.unit && t.unit.toLowerCase().includes(trackerSearchQuery.toLowerCase())) ||
                                  t.category.toLowerCase().includes(trackerSearchQuery.toLowerCase())
                                );

                                if (filtered.length === 0) {
                                  return (
                                    <p className="text-[9px] text-editorial-dark/50 italic py-1.5 text-center">
                                      No matching trackers found.
                                    </p>
                                  );
                                }

                                return filtered.map(t => {
                                  const isCopied = copiedTrackerName === t.name;
                                  return (
                                    <div
                                      key={t.id}
                                      onClick={() => handleCopyTrackerName(t.name)}
                                      className="group flex items-center justify-between p-1 hover:bg-editorial-orange-light/5 border border-transparent hover:border-editorial-orange/15 cursor-pointer transition-all"
                                      title="Click to copy exact tracker name"
                                    >
                                      <div className="flex flex-col min-w-0 pr-2">
                                        <span className="font-sans font-medium text-[10px] text-editorial-dark truncate">
                                          {t.name}
                                        </span>
                                        <span className="font-mono text-[8px] text-editorial-dark/40">
                                          {t.category} {t.unit && `• ${t.unit}`}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        className="shrink-0 p-0.5 bg-editorial-dark/[0.02] border border-editorial-dark/10 text-editorial-dark/40 hover:text-editorial-orange hover:bg-white transition-all flex items-center justify-center"
                                      >
                                        {isCopied ? (
                                          <Check size={9} className="text-emerald-600 font-bold" />
                                        ) : (
                                          <Copy size={9} />
                                        )}
                                      </button>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                            <p className="text-[8px] text-editorial-dark/45 mt-1.5 pt-1 border-t border-editorial-dark/5 leading-tight">
                              Click any tracker to copy the exact name needed by the CSV.
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* CSV Help Popover Toggle */}
                    <button
                      type="button"
                      onClick={() => setShowCSVHelpPopover(!showCSVHelpPopover)}
                      className={`flex items-center justify-center w-7 h-7 border transition-all cursor-pointer ${
                        showCSVHelpPopover
                          ? 'bg-editorial-orange border-editorial-orange text-white'
                          : 'bg-editorial-orange-light/5 hover:bg-editorial-orange-light/15 border-editorial-orange/20 text-editorial-orange'
                      }`}
                      title="Expected CSV Column Format Help"
                    >
                      <Info size={13} />
                    </button>

                    {/* Download Sample Template */}
                    <button
                      type="button"
                      onClick={handleDownloadCSVTemplate}
                      className="flex items-center gap-1 border border-editorial-dark/15 hover:border-editorial-orange hover:text-editorial-orange px-2.5 py-1.5 font-mono text-[10px] uppercase font-semibold transition-colors cursor-pointer bg-editorial-bg"
                      title="Download starter CSV template"
                    >
                      <Download size={11} />
                      <span>Template</span>
                    </button>

                    {/* Quick Reset Button */}
                    <button
                      type="button"
                      onClick={handleQuickResetCSV}
                      disabled={!selectedCSVFileName && csvImportStep === 'idle'}
                      className={`flex items-center gap-1 border transition-all uppercase font-semibold text-[10px] font-mono px-2.5 py-1.5 cursor-pointer ${
                        selectedCSVFileName || csvImportStep !== 'idle'
                          ? 'bg-rose-50/70 border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-400'
                          : 'bg-editorial-bg border-editorial-dark/10 text-editorial-dark/30 cursor-not-allowed'
                      }`}
                      title="Reset selected file, mapped configurations, and pipeline progress"
                    >
                      <RotateCcw size={11} className={selectedCSVFileName || csvImportStep !== 'idle' ? "animate-pulse" : ""} />
                      <span>Quick Reset</span>
                    </button>
                  </div>
                </div>

                {/* CSV Format Help Popover */}
                <AnimatePresence>
                  {showCSVHelpPopover && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.15 }}
                      className="bg-editorial-dark/[0.01] border border-editorial-orange/20 p-4 font-sans text-xs"
                    >
                      <div className="flex items-center justify-between border-b border-editorial-dark/10 pb-1.5 mb-3">
                        <span className="font-serif font-semibold text-xs text-editorial-dark flex items-center gap-1.5">
                          <Info size={13} className="text-editorial-orange animate-pulse" />
                          Expected CSV Column Format & Rules
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowCSVHelpPopover(false)}
                          className="text-editorial-dark/40 hover:text-editorial-dark"
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <p className="text-[11px] text-editorial-dark/75 leading-relaxed mb-3">
                        To successfully import entries, your CSV file should contain columns that map to the following fields:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3 text-[11px]">
                        <div className="bg-white border border-editorial-dark/10 p-2.5">
                          <span className="font-mono bg-editorial-dark/5 px-1 py-0.5 font-bold text-editorial-dark">Date</span>
                          <p className="text-editorial-dark/65 mt-1">Supports standard days, e.g. <span className="font-mono font-semibold">2026-07-09</span> or <span className="font-mono font-semibold">07/09/2026</span>.</p>
                        </div>
                        <div className="bg-white border border-editorial-dark/10 p-2.5">
                          <span className="font-mono bg-editorial-dark/5 px-1 py-0.5 font-bold text-editorial-dark">Tracker Name</span>
                          <p className="text-editorial-dark/65 mt-1">Must align with your active metrics, e.g. <span className="font-mono font-semibold">"Water Intake"</span>.</p>
                        </div>
                        <div className="bg-white border border-editorial-dark/10 p-2.5">
                          <span className="font-mono bg-editorial-dark/5 px-1 py-0.5 font-bold text-editorial-dark">Value</span>
                          <p className="text-editorial-dark/65 mt-1">The numerical log record value, e.g. <span className="font-mono font-semibold">8</span> or <span className="font-mono font-semibold">15</span>.</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-editorial-dark/5">
                        <div className="text-[10px] text-editorial-dark/50">
                          Optional headers: Category, Unit, Goal, Notes, Logged At
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyCSVExample}
                          className="flex items-center gap-1 text-[10px] font-mono text-editorial-orange font-bold hover:underline"
                        >
                          {copiedCSVExample ? (
                            <>
                              <Check size={11} className="text-emerald-600" />
                              <span>Copied Example!</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy CSV Format Text</span>
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* SMART AUTO-IMPORT TOGGLE CONTROL */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border border-editorial-dark/15 bg-editorial-dark/[0.02] p-4 text-xs gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className={`p-1.5 border shrink-0 transition-colors ${
                      smartAutoImport 
                        ? 'bg-editorial-orange/10 border-editorial-orange/20 text-editorial-orange' 
                        : 'bg-editorial-dark/5 border-editorial-dark/10 text-editorial-dark/45'
                    }`}>
                      <Zap size={14} className={smartAutoImport ? "fill-editorial-orange" : ""} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-serif font-semibold text-editorial-dark flex items-center gap-1.5">
                        Smart Auto-Import
                        {smartAutoImport && (
                          <span className="bg-editorial-orange/10 text-editorial-orange text-[8px] font-mono px-1.5 py-0.5 uppercase tracking-wider font-semibold">
                            Active
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-editorial-dark/55 mt-0.5 max-w-xl leading-relaxed">
                        When enabled, dropping a file that matches the header structure of your last saved favorite configuration will automatically map and import it instantly.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !smartAutoImport;
                      setSmartAutoImport(next);
                      localStorage.setItem('csv_smart_auto_import', JSON.stringify(next));
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-1 focus:ring-editorial-orange select-none self-end sm:self-auto ${
                      smartAutoImport ? 'bg-editorial-orange' : 'bg-editorial-dark/20'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                        smartAutoImport ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* GRAPHICAL FILE DROP & INPUT HELPER */}
                <div 
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`group relative border-2 border-dashed p-7 text-center cursor-pointer transition-all rounded-none ${
                    isDraggingCSV 
                      ? 'border-editorial-orange bg-editorial-orange-light/10 scale-[1.01]' 
                      : selectedCSVFileName 
                        ? 'border-emerald-500/25 bg-emerald-500/[0.01]' 
                        : 'border-editorial-dark/15 hover:border-editorial-orange bg-editorial-dark/[0.01] hover:bg-editorial-orange-light/[0.01]'
                  }`}
                >
                  <label htmlFor="csv-file-uploader-input" className="absolute inset-0 cursor-pointer w-full h-full">
                    <input 
                      id="csv-file-uploader-input"
                      type="file"
                      accept=".csv"
                      onChange={handleImportCSVFile}
                      className="hidden"
                    />
                  </label>
                  
                  {selectedCSVFileName ? (
                    <div className="relative z-10 flex flex-col items-center justify-center space-y-2.5">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-mono font-bold text-editorial-dark">{selectedCSVFileName}</p>
                        <p className="text-[10px] text-editorial-dark/55 mt-0.5">
                          Spreadsheet loaded • <strong className="text-editorial-dark">{totalParsedRows}</strong> rows successfully detected
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsPreviewModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-[9px] font-mono uppercase bg-editorial-accent-light text-editorial-dark hover:bg-editorial-accent border border-editorial-dark/10 transition-colors cursor-pointer"
                        >
                          Preview Layout
                        </button>
                        
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsCSVMappingModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-[9px] font-mono uppercase bg-editorial-orange text-white hover:bg-editorial-orange/90 transition-colors cursor-pointer"
                        >
                          Adjust Mapping & Import
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleQuickResetCSV();
                          }}
                          className="px-2 py-1 text-[9px] font-mono uppercase bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 border border-rose-500/20 transition-colors cursor-pointer"
                        >
                          Remove File
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="relative z-10 flex flex-col items-center justify-center space-y-2 py-1 pointer-events-none">
                      <div className="w-10 h-10 rounded-full bg-editorial-orange-light/10 text-editorial-orange flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload size={18} />
                      </div>
                      <div>
                        <p className="text-xs font-serif font-semibold text-editorial-dark">Drag and drop your spreadsheet file (.csv) here</p>
                        <p className="text-[10px] text-editorial-dark/50 mt-0.5">or click to browse from your computer</p>
                      </div>
                      <p className="text-[9px] font-mono text-editorial-dark/40 max-w-sm mt-1 leading-normal">
                        Supports custom logs, Apple Health, Google Fit, Habitica, or CSV templates.
                      </p>
                    </div>
                  )}

                  {/* Visual Drop Overlay */}
                  <AnimatePresence>
                    {isDraggingCSV && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 z-20 bg-editorial-orange text-white flex flex-col items-center justify-center gap-1 font-mono text-[10px] uppercase tracking-wider"
                      >
                        <Upload size={20} className="animate-bounce mb-1" />
                        <span>Release to drop spreadsheet file</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* GRAPHICAL PIPELINE PROGRESS BAR */}
                <div className="bg-editorial-dark/[0.015] border border-editorial-dark/5 p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-mono text-editorial-accent uppercase tracking-wider font-bold">
                      Import Pipeline Status
                    </span>
                    <span className="text-xs font-serif font-bold text-editorial-dark">
                      {overallPercentage}% Complete
                    </span>
                  </div>

                  {/* Bar */}
                  <div className="w-full bg-editorial-dark/5 h-2 overflow-hidden rounded-none relative">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-editorial-orange to-emerald-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${overallPercentage}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>

                  {/* Step Columns Checkpoints */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1 text-xs">
                    {/* Step 1: Upload */}
                    <div className={`p-3 border transition-all ${
                      selectedCSVFileName 
                        ? 'border-emerald-500/15 bg-emerald-500/[0.015] text-emerald-800' 
                        : 'border-editorial-dark/10 text-editorial-dark/50'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold">1. Spreadsheet Upload</span>
                        {selectedCSVFileName ? (
                          <Check size={12} className="text-emerald-600 font-bold" />
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-editorial-dark/25 animate-pulse" />
                        )}
                      </div>
                      <p className="text-[10.5px] leading-snug font-serif">
                        {selectedCSVFileName ? 'Spreadsheet uploaded successfully' : 'Waiting for file upload...'}
                      </p>
                    </div>

                    {/* Step 2: Columns Mapping */}
                    <div className={`p-3 border transition-all ${
                      selectedCSVFileName 
                        ? mappedColumnsCount === 3
                          ? 'border-emerald-500/15 bg-emerald-500/[0.015] text-emerald-800'
                          : 'border-editorial-orange/15 bg-editorial-orange-light/[0.015] text-editorial-orange'
                        : 'border-editorial-dark/10 text-editorial-dark/50'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold">2. Columns Alignment</span>
                        {mappedColumnsCount === 3 ? (
                          <Check size={12} className="text-emerald-600 font-bold" />
                        ) : selectedCSVFileName ? (
                          <span className="text-[9px] font-mono font-bold animate-pulse">
                            {Math.round((mappedColumnsCount / 3) * 100)}%
                          </span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-editorial-dark/25" />
                        )}
                      </div>
                      <p className="text-[10.5px] leading-snug font-serif">
                        {selectedCSVFileName 
                          ? `Mapped ${mappedColumnsCount} of 3 required headers` 
                          : 'Columns alignment pending...'}
                      </p>
                    </div>

                    {/* Step 3: Success Status */}
                    <div className={`p-3 border transition-all ${
                      csvImportStep === 'success' 
                        ? 'border-emerald-500/15 bg-emerald-500/[0.015] text-emerald-800' 
                        : isSimulatingImport
                          ? 'border-editorial-orange/15 bg-editorial-orange-light/[0.015] text-editorial-orange font-semibold'
                          : 'border-editorial-dark/10 text-editorial-dark/50'
                    }`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold">3. Logs Processing</span>
                        {csvImportStep === 'success' ? (
                          <Check size={12} className="text-emerald-600 font-bold" />
                        ) : isSimulatingImport ? (
                          <span className="text-[9px] font-mono animate-spin">⏳</span>
                        ) : (
                          <span className="w-1.5 h-1.5 rounded-full bg-editorial-dark/25" />
                        )}
                      </div>
                      <p className="text-[10.5px] leading-snug font-serif">
                        {csvImportStep === 'success' 
                          ? `Imported ${importedLogsCount} of ${totalParsedRows} parsed rows (100% complete)` 
                          : isSimulatingImport
                            ? `Importing rows: ${importedProgressPercentage}% complete...`
                            : 'Log entry sync pending...'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Revert last import overlay actions */}
                <AnimatePresence>
                  {lastImportedLogIds.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-rose-50 border border-rose-200/55 p-3.5"
                    >
                      <div className="text-xs text-rose-800 font-sans italic flex items-center gap-1.5">
                        <span>⚠️ Loaded <strong>{lastImportedLogIds.length}</strong> entries in the most recent CSV import step. Feel free to revert.</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRevertLastCSVImport}
                        className="mt-2 sm:mt-0 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-mono text-[9px] uppercase font-bold tracking-wider transition-colors cursor-pointer rounded-none self-end sm:self-auto flex items-center gap-1"
                      >
                        <Trash2 size={11} />
                        Revert Import ({lastImportedLogIds.length})
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
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
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-editorial-bg p-6 rounded-none border border-editorial-dark/15">
                  <div>
                    <h2 className="text-2xl font-serif font-medium text-editorial-dark tracking-wide flex flex-wrap items-center gap-2">
                      <Calendar size={20} className="text-editorial-accent" />
                      {isComparing ? (
                        <>
                          Comparing <span className="text-editorial-accent underline decoration-dotted">{formattedSelectedDate}</span> vs <span className="text-editorial-dark/70 italic underline decoration-dotted">{formattedComparisonDate}</span>
                        </>
                      ) : (
                        <>{formattedSelectedDate} Logs</>
                      )}
                    </h2>
                    <p className="text-xs font-sans italic text-editorial-dark/60 mt-1">
                      {isComparing 
                        ? "Interactive side-by-side split screen view with visual change markers" 
                        : "Select a date to view and log metrics"}
                    </p>
                  </div>

                  {/* Elegant Calendar Switchers and Compare Toggle */}
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Compare Dates Toggle */}
                    <button
                      type="button"
                      onClick={() => setIsComparing(!isComparing)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] border transition-all cursor-pointer ${
                        isComparing
                          ? 'bg-editorial-accent text-editorial-bg border-editorial-accent font-bold shadow-xs'
                          : 'bg-transparent text-editorial-dark/65 border-editorial-dark/20 hover:border-editorial-dark/40 hover:text-editorial-dark'
                      }`}
                    >
                      <Sliders size={12} />
                      <span>{isComparing ? 'Disable Comparison' : 'Compare Dates'}</span>
                    </button>

                    {/* Left/Right controls for Primary Date */}
                    <div className="flex items-center gap-1.5 bg-editorial-dark/[0.02] border border-editorial-dark/10 p-1">
                      <span className="text-[9px] font-mono uppercase text-editorial-dark/50 px-1">Date A:</span>
                      <button
                        type="button"
                        onClick={() => shiftDate(-1)}
                        className="p-1 border border-editorial-dark/10 hover:bg-editorial-accent-light rounded-none text-editorial-dark transition-colors cursor-pointer"
                        title="Previous Day"
                      >
                        <ChevronLeft size={13} />
                      </button>

                      <div className="relative">
                        <input
                          type="date"
                          value={selectedDate}
                          onChange={(e) => setSelectedDate(e.target.value)}
                          className="rounded-none border-0 p-1 text-[11px] font-mono font-bold text-editorial-dark outline-hidden bg-transparent focus:ring-0 cursor-pointer"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => shiftDate(1)}
                        className="p-1 border border-editorial-dark/10 hover:bg-editorial-accent-light rounded-none text-editorial-dark transition-colors cursor-pointer"
                        title="Next Day"
                      >
                        <ChevronRight size={13} />
                      </button>
                    </div>

                    {/* Left/Right controls for Comparison Date (only if isComparing) */}
                    {isComparing && (
                      <div className="flex items-center gap-1.5 bg-editorial-dark/[0.02] border border-editorial-dark/15 p-1 animate-fade-in">
                        <span className="text-[9px] font-mono uppercase text-editorial-dark/50 px-1">Date B:</span>
                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date(comparisonDate + 'T12:00:00');
                            d.setDate(d.getDate() - 1);
                            setComparisonDate(d.toISOString().split('T')[0]);
                          }}
                          className="p-1 border border-editorial-dark/10 hover:bg-editorial-accent-light rounded-none text-editorial-dark transition-colors cursor-pointer"
                          title="Previous Day"
                        >
                          <ChevronLeft size={13} />
                        </button>

                        <div className="relative">
                          <input
                            type="date"
                            value={comparisonDate}
                            onChange={(e) => setComparisonDate(e.target.value)}
                            className="rounded-none border-0 p-1 text-[11px] font-mono font-bold text-editorial-dark outline-hidden bg-transparent focus:ring-0 cursor-pointer"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const d = new Date(comparisonDate + 'T12:00:00');
                            d.setDate(d.getDate() + 1);
                            setComparisonDate(d.toISOString().split('T')[0]);
                          }}
                          className="p-1 border border-editorial-dark/10 hover:bg-editorial-accent-light rounded-none text-editorial-dark transition-colors cursor-pointer"
                          title="Next Day"
                        >
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {isComparing ? (
                  <DateComparisonDashboardView
                    trackers={trackers}
                    filteredTrackers={filteredTrackers}
                    logs={logs}
                    reflections={reflections}
                    selectedDate={selectedDate}
                    comparisonDate={comparisonDate}
                    formattedSelectedDate={formattedSelectedDate}
                    formattedComparisonDate={formattedComparisonDate}
                    dailyStats={dailyStats}
                    comparisonDailyStats={comparisonDailyStats}
                    comparisonChartData={comparisonChartData}
                    onLogValue={handleLogValue}
                    onDeleteLog={handleDeleteLog}
                    onSaveGoalNote={handleSaveGoalNote}
                    onSaveMilestone={handleSaveMilestone}
                  />
                ) : (
                  <>
                    {/* Daily Motivational Quote Widget */}
                    <MotivationalQuote />

                {/* Trend Alerts Dashboard Section */}
                {activeTrendAlerts.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-editorial-bg p-5 rounded-none border border-editorial-dark/15 border-l-2 border-l-amber-500 space-y-3"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="text-amber-600 animate-pulse" size={16} />
                        <h4 className="text-[10px] font-mono text-editorial-accent tracking-widest uppercase font-semibold">Active Trend Alerts</h4>
                      </div>
                      <span className="text-[10px] font-mono text-amber-800 bg-amber-500/10 px-2 py-0.5 border border-amber-500/15">
                        {activeTrendAlerts.length} significant {activeTrendAlerts.length === 1 ? 'shift' : 'shifts'} detected today
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-2">
                      {activeTrendAlerts.map(({ tracker, percentChange, average, currentValue, direction }) => (
                        <div
                          key={tracker.id}
                          className="flex items-start gap-3 border border-editorial-dark/10 p-3 bg-editorial-dark/[0.01] hover:bg-editorial-dark/[0.03] transition-all"
                        >
                          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-none text-white ${
                            COLOR_MAP[tracker.color]?.bg || 'bg-editorial-emerald'
                          }`}>
                            <LucideIcon name={tracker.icon} size={15} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="font-serif font-semibold text-xs text-editorial-dark truncate leading-tight">
                                {tracker.name}
                              </span>
                              <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border rounded-none ${
                                direction === 'increase'
                                  ? 'bg-amber-500/15 border-amber-500/25 text-amber-900'
                                  : 'bg-rose-500/15 border-rose-500/25 text-rose-900'
                              }`}>
                                {direction === 'increase' ? '▲' : '▼'} {Math.abs(percentChange)}% Shift
                              </span>
                            </div>
                            <p className="text-[10px] text-editorial-dark/65 font-sans mt-1 leading-relaxed">
                              Today's value <strong className="font-mono text-editorial-accent">{currentValue}</strong> is {direction === 'increase' ? '20%+' : '20%+'} {direction === 'increase' ? 'higher' : 'lower'} than your 7-day rolling average of <strong className="font-mono">{Math.round(average * 10) / 10}</strong>.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

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

                  {/* Goal Completion Rate Trend over the last 7 days */}
                  <div className="pt-4 border-t border-editorial-dark/10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp size={14} className="text-editorial-accent" />
                        <h4 className="text-[10px] font-mono text-editorial-accent tracking-widest uppercase font-semibold">
                          Goal Completion Trend (Last 7 Days)
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-editorial-dark/50">
                        Trend up to {formattedSelectedDate}
                      </span>
                    </div>

                    {dailyStats.withGoals > 0 ? (
                      <div className="h-44 w-full animate-fade-in" id="goal-completion-rate-trend-chart">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={last7DaysData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                            <defs>
                              <linearGradient id="goalTrendGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--editorial-accent)" stopOpacity={0.25} />
                                <stop offset="95%" stopColor="var(--editorial-accent)" stopOpacity={0.0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="2 2" vertical={false} stroke="var(--editorial-dark)" strokeOpacity={0.1} />
                            <XAxis
                              dataKey="weekdayLabel"
                              tick={{ fontSize: 9, fill: 'var(--editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                              axisLine={false}
                              tickLine={false}
                            />
                            <YAxis
                              domain={[0, 100]}
                              ticks={[0, 25, 50, 75, 100]}
                              tick={{ fontSize: 9, fill: 'var(--editorial-dark)', opacity: 0.6, fontFamily: 'monospace' }}
                              tickFormatter={(v) => `${v}%`}
                              axisLine={false}
                              tickLine={false}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-editorial-dark text-editorial-bg rounded-none p-3 shadow-md text-xs space-y-1 font-sans border border-editorial-accent/30 min-w-[160px]">
                                      <p className="font-mono text-[9px] text-editorial-bg/60 border-b border-editorial-bg/15 pb-1 mb-1">
                                        {data.displayLabel}
                                      </p>
                                      <div className="flex items-center justify-between">
                                        <span className="text-editorial-bg/90 font-serif">Completion Rate:</span>
                                        <span className="font-mono font-bold text-editorial-accent text-sm">
                                          {data.rate}%
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between text-[10px] text-editorial-bg/75">
                                        <span>Goals Achieved:</span>
                                        <span className="font-mono">
                                          {data.completed} of {data.total}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <ReferenceLine 
                              y={25} 
                              stroke="var(--editorial-dark)" 
                              strokeDasharray="3 3" 
                              strokeOpacity={0.2} 
                              label={{ value: '25% Threshold', fill: 'var(--editorial-dark)', opacity: 0.4, fontSize: 8, fontFamily: 'monospace', position: 'insideBottomRight' }} 
                            />
                            <ReferenceLine 
                              y={50} 
                              stroke="var(--editorial-dark)" 
                              strokeDasharray="3 3" 
                              strokeOpacity={0.2} 
                              label={{ value: '50% Threshold', fill: 'var(--editorial-dark)', opacity: 0.4, fontSize: 8, fontFamily: 'monospace', position: 'insideBottomRight' }} 
                            />
                            <ReferenceLine 
                              y={75} 
                              stroke="var(--editorial-dark)" 
                              strokeDasharray="3 3" 
                              strokeOpacity={0.2} 
                              label={{ value: '75% Threshold', fill: 'var(--editorial-dark)', opacity: 0.4, fontSize: 8, fontFamily: 'monospace', position: 'insideBottomRight' }} 
                            />
                            <Area
                              type="monotone"
                              dataKey="rate"
                              stroke="var(--editorial-accent)"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#goalTrendGradient)"
                              dot={{ r: 3, stroke: "var(--editorial-accent)", strokeWidth: 1.5, fill: "var(--editorial-bg)" }}
                              activeDot={{ r: 5, stroke: "var(--editorial-accent)", strokeWidth: 2, fill: "var(--editorial-accent)" }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="border border-dashed border-editorial-dark/20 p-6 text-center bg-editorial-dark/[0.01]">
                        <p className="text-xs font-serif italic text-editorial-dark/60">
                          Configure a goal target on at least one tracker to view completion trends!
                        </p>
                      </div>
                    )}
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

                {/* Weekly Summary Widget */}
                <WeeklySummaryDashboardWidget
                  trackers={trackers}
                  logs={logs}
                  selectedDate={selectedDate}
                />

                {/* Monthly Goals Summary */}
                <MonthlyGoalsSummary
                  trackers={trackers}
                  logs={logs}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                />

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
                          handleAddMilestone(selectedDate, milestoneTimeInput, milestoneTextInput, milestoneImportanceInput, milestoneNotesInput, milestoneCategoryInput);
                          setMilestoneTextInput('');
                          setMilestoneNotesInput('');
                          setMilestoneImportanceInput(undefined);
                          setMilestoneCategoryInput('');
                        }
                      }}
                      className="space-y-2 bg-editorial-dark/[0.02] border border-editorial-dark/10 p-3"
                    >
                      <div className="flex flex-col sm:flex-row items-stretch gap-2">
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

                        {/* Optional Category Dropdown Selector */}
                        <div className="flex items-center border border-editorial-dark/20 bg-editorial-bg px-2 shrink-0 sm:w-36">
                          <select
                            value={milestoneCategoryInput}
                            onChange={(e) => setMilestoneCategoryInput(e.target.value)}
                            className="w-full bg-transparent border-0 text-xs font-mono text-editorial-dark p-1.5 outline-hidden focus:ring-0 cursor-pointer font-semibold"
                          >
                            <option value="" className="bg-editorial-bg text-editorial-dark/60 font-semibold">Category...</option>
                            {MILESTONE_CATEGORIES.map(cat => (
                              <option key={cat.id} value={cat.id} className="bg-editorial-bg text-editorial-dark font-semibold">
                                {cat.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="submit"
                          className="bg-editorial-dark hover:bg-editorial-accent hover:text-editorial-bg text-editorial-bg font-mono text-xs px-4 py-2 rounded-none transition-colors shrink-0 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Plus size={13} />
                          <span>Add</span>
                        </button>
                      </div>

                      {/* Notes Textarea */}
                      <div className="border border-editorial-dark/20 bg-editorial-bg px-2.5 py-1.5">
                        <textarea
                          value={milestoneNotesInput}
                          onChange={(e) => setMilestoneNotesInput(e.target.value)}
                          placeholder="Add optional notes or detailed observations about this milestone..."
                          rows={2}
                          className="w-full bg-transparent border-0 text-xs font-sans text-editorial-dark p-0.5 outline-hidden focus:ring-0 placeholder:text-editorial-dark/30 resize-none leading-relaxed"
                        />
                      </div>
                    </form>

                    {/* Timeline List of Milestones */}
                    {activeReflection?.milestones && activeReflection.milestones.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                        {[...activeReflection.milestones]
                          .sort((a, b) => a.time.localeCompare(b.time))
                          .map((ms) => (
                            <div
                              key={ms.id}
                              className="flex flex-col gap-1.5 border border-editorial-dark/10 p-3 bg-editorial-dark/[0.01] hover:bg-editorial-dark/[0.03] transition-all"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
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
                                  {ms.category && (() => {
                                    const cat = MILESTONE_CATEGORIES.find(c => c.id === ms.category);
                                    if (!cat) return null;
                                    const colorClasses = 
                                      cat.color === 'emerald' ? 'bg-editorial-emerald-light text-editorial-emerald border-editorial-emerald/25' :
                                      cat.color === 'indigo' ? 'bg-editorial-indigo-light text-editorial-indigo border-editorial-indigo/25' :
                                      cat.color === 'blue' ? 'bg-editorial-blue-light text-editorial-blue border-editorial-blue/25' :
                                      'bg-editorial-violet-light text-editorial-violet border-editorial-violet/25';
                                    return (
                                      <span className={`shrink-0 text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border rounded-none ${colorClasses}`}>
                                        {cat.name}
                                      </span>
                                    );
                                  })()}
                                  <span className="text-xs font-serif font-semibold italic text-editorial-dark/85 leading-relaxed break-words">
                                    {ms.text}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteMilestone(selectedDate, ms.id)}
                                  className="text-editorial-dark/30 hover:text-rose-600 p-1 transition-colors cursor-pointer shrink-0"
                                  title="Delete milestone"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                              {ms.notes && (
                                <p className="text-[11px] text-editorial-dark/70 font-sans pl-2 border-l border-editorial-dark/15 leading-relaxed italic whitespace-pre-wrap">
                                  {ms.notes}
                                </p>
                              )}
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
                            title={ms.notes ? `Observation: ${ms.notes}` : undefined}
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
                            {ms.category && (() => {
                              const cat = MILESTONE_CATEGORIES.find(c => c.id === ms.category);
                              if (!cat) return null;
                              return (
                                <span className="font-mono text-[8px] font-extrabold uppercase tracking-widest text-editorial-dark/50 mr-0.5 border-r border-editorial-dark/15 pr-1.5 leading-none select-none">
                                  {cat.name}
                                </span>
                              );
                            })()}
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
                        {filteredTrackers.length === trackers.length
                          ? `${trackers.length} active monitors`
                          : `Showing ${filteredTrackers.length} of ${trackers.length} monitors`}
                      </span>
                    )}
                  </div>

                  {/* Dashboard Tracker Filters */}
                  {trackers.length > 0 && (
                    <div className="mb-6 flex flex-col md:flex-row gap-4 bg-editorial-bg p-4 border border-editorial-dark/15">
                      <div className="flex-1 relative">
                        <span className="absolute left-3.5 top-3 text-editorial-dark/40">
                          <Search size={13} />
                        </span>
                        <input
                          type="text"
                          placeholder="Search metrics by name, category, or #tag..."
                          value={dashboardSearchQuery}
                          onChange={(e) => setDashboardSearchQuery(e.target.value)}
                          className="w-full pl-9 pr-14 py-2 text-xs font-sans rounded-none border border-editorial-dark/20 bg-editorial-bg outline-hidden focus:border-editorial-accent transition-all"
                        />
                        {dashboardSearchQuery && (
                          <button
                            type="button"
                            onClick={() => setDashboardSearchQuery('')}
                            className="absolute right-3.5 top-2.5 text-[10px] font-mono font-medium text-rose-600 hover:text-rose-800 uppercase tracking-wider cursor-pointer"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {allUniqueTags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 max-w-full">
                          <span className="text-[10px] font-mono text-editorial-dark/50 uppercase tracking-widest mr-1">Filter Tag:</span>
                          <button
                            type="button"
                            onClick={() => setDashboardSelectedTag('all')}
                            className={`text-[10px] font-mono font-bold px-2.5 py-1.5 border transition-all cursor-pointer ${
                              dashboardSelectedTag === 'all'
                                ? 'bg-editorial-accent text-editorial-bg border-editorial-accent'
                                : 'bg-editorial-dark/5 text-editorial-dark/60 border-editorial-dark/10 hover:bg-editorial-accent-light/50 hover:text-editorial-accent'
                            }`}
                          >
                            All
                          </button>
                          {allUniqueTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setDashboardSelectedTag(tag)}
                              className={`text-[10px] font-mono font-bold px-2.5 py-1.5 border transition-all cursor-pointer ${
                                dashboardSelectedTag === tag
                                  ? 'bg-editorial-accent text-editorial-bg border-editorial-accent'
                                  : 'bg-editorial-dark/5 text-editorial-dark/60 border-editorial-dark/10 hover:bg-editorial-accent-light/50 hover:text-editorial-accent'
                              }`}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {trackers.length > 0 ? (
                    filteredTrackers.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredTrackers.map((tracker) => {
                          const dateReflection = reflections.find(r => r.date === selectedDate);
                          const goalNote = dateReflection?.goalNotes?.[tracker.id] || '';
                          return (
                            <TrackerCard
                              key={tracker.id}
                              tracker={tracker}
                              logs={logs}
                              selectedDate={selectedDate}
                              onLogValue={handleLogValue}
                              onDeleteLog={handleDeleteLog}
                              goalNote={goalNote}
                              onSaveGoalNote={handleSaveGoalNote}
                              onSaveMilestone={handleSaveMilestone}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-editorial-dark/20 rounded-none bg-editorial-bg space-y-3">
                        <span className="text-xl">🔍</span>
                        <h4 className="font-serif text-sm font-semibold text-editorial-dark">No Matching Trackers</h4>
                        <p className="text-xs text-editorial-dark/60 max-w-xs leading-relaxed">
                          No trackers match your current search query "{dashboardSearchQuery}" or tag filter. Try resetting filters.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setDashboardSearchQuery('');
                            setDashboardSelectedTag('all');
                          }}
                          className="text-[10px] font-mono font-bold uppercase tracking-wider text-editorial-accent hover:text-editorial-dark transition-colors cursor-pointer"
                        >
                          Reset Active Filters
                        </button>
                      </div>
                    )
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
                </>
                )}
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
                <TrackerAnalytics trackers={trackers} logs={logs} reflections={reflections} />
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
                  searchQuery={historySearchQuery}
                  setSearchQuery={setHistorySearchQuery}
                  filterTrackerId={historyFilterTrackerId}
                  setFilterTrackerId={setHistoryFilterTrackerId}
                  filterCategory={historyFilterCategory}
                  setFilterCategory={setHistoryFilterCategory}
                  onJumpToDate={(date) => {
                    setSelectedDate(date);
                    setCurrentTab('dashboard');
                  }}
                  reflections={reflections}
                  onDeleteMilestone={handleDeleteMilestone}
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
                  logs={logs}
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

      {/* CSV Mapping Modal overlay */}
      <CSVMappingModal
        isOpen={isCSVMappingModalOpen}
        onClose={() => setIsCSVMappingModalOpen(false)}
        headers={pendingCSVHeaders}
        csvText={pendingCSVText}
        onConfirm={handleConfirmCSVMapping}
      />

      {/* Clear Logs Confirmation Modal overlay */}
      <AnimatePresence>
        {isClearLogsConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsClearLogsConfirmOpen(false)}
              className="absolute inset-0 bg-editorial-dark/40 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 15 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-md overflow-hidden rounded-none bg-editorial-bg border border-editorial-dark/15 shadow-2xl flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-editorial-dark/15 px-6 py-4 bg-rose-500/5">
                <div className="flex items-center gap-2 text-rose-700">
                  <AlertTriangle size={18} />
                  <h3 className="font-serif text-base font-semibold tracking-tight">
                    Confirm Action
                  </h3>
                </div>
                <button
                  id="close-clear-confirm-button"
                  type="button"
                  onClick={() => setIsClearLogsConfirmOpen(false)}
                  className="text-editorial-dark/45 hover:text-editorial-dark transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-800 text-xs p-3 font-sans italic flex items-center gap-2">
                  <span className="font-bold">⚠️ Warning: This action is irreversible!</span>
                </div>
                <p className="text-xs text-editorial-dark/85 font-serif leading-relaxed">
                  You are about to delete <strong className="text-editorial-dark font-semibold">{logs.length}</strong> log entries. This will permanently erase all data records, histories, and logs across every single tracker. 
                </p>
                <p className="text-xs text-editorial-dark/60 font-sans leading-relaxed">
                  Your trackers themselves (the custom metrics you created) will not be deleted, but all recorded history of values and timestamps within them will be cleared.
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 border-t border-editorial-dark/10 bg-editorial-dark/[0.02] px-6 py-4">
                <button
                  id="cancel-clear-logs-button"
                  type="button"
                  onClick={() => setIsClearLogsConfirmOpen(false)}
                  className="rounded-none border border-editorial-dark/20 bg-editorial-bg px-4 py-2 text-xs font-mono uppercase tracking-wider text-editorial-dark hover:bg-editorial-accent-light/40 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="confirm-clear-logs-button"
                  type="button"
                  onClick={handleClearAllLogs}
                  className="rounded-none bg-rose-600 text-white px-5 py-2 text-xs font-mono uppercase tracking-wider hover:bg-rose-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                >
                  <Trash2 size={13} />
                  <span>Clear All Logs</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSV Preview Data Modal overlay */}
      <AnimatePresence>
        {isPreviewModalOpen && pendingCSVText && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPreviewModalOpen(false)}
              className="absolute inset-0 bg-editorial-dark/40 backdrop-blur-sm"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.98, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 15 }}
              transition={{ duration: 0.25 }}
              className="relative w-full max-w-3xl overflow-hidden rounded-none bg-editorial-bg border border-editorial-dark/15 shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-editorial-dark/15 px-6 py-4 bg-editorial-orange-light/5">
                <div className="flex items-center gap-2 text-editorial-orange">
                  <Eye size={18} />
                  <h3 className="font-serif text-base font-semibold tracking-tight">
                    CSV Data Preview: <span className="font-mono text-xs font-normal text-editorial-dark">{selectedCSVFileName}</span>
                  </h3>
                </div>
                <button
                  id="close-preview-modal-button"
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="text-editorial-dark/45 hover:text-editorial-dark transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4 overflow-y-auto">
                <p className="text-xs text-editorial-dark/70 font-sans">
                  Verifying the first 5 rows of data. Filtered by row keywords if specified.
                </p>

                {(() => {
                  const rows = parseCSV(pendingCSVText);
                  if (rows.length === 0) {
                    return (
                      <div className="text-center py-6 text-xs text-editorial-dark/40 italic">
                        No rows found to preview.
                      </div>
                    );
                  }
                  const headers = rows[0];
                  const previewData = rows.slice(1, 6);

                  return (
                    <div className="overflow-x-auto border border-editorial-dark/10 max-h-80">
                      <table className="w-full text-left border-collapse text-[11px] font-sans">
                        <thead>
                          <tr className="bg-editorial-dark/[0.04] border-b border-editorial-dark/15">
                            <th className="p-2.5 font-mono text-[9px] uppercase tracking-wider text-editorial-dark/50 w-12 text-center">Row</th>
                            {headers.map((header, i) => (
                              <th key={i} className="p-2.5 font-semibold text-editorial-dark border-l border-editorial-dark/10 first:border-l-0">
                                {header || `Column ${i + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.length === 0 ? (
                            <tr>
                              <td colSpan={headers.length + 1} className="p-4 text-center text-editorial-dark/40 italic">
                                No data rows found.
                              </td>
                            </tr>
                          ) : (
                            previewData.map((row, rowIndex) => (
                              <tr key={rowIndex} className="border-b border-editorial-dark/5 last:border-b-0 hover:bg-editorial-dark/[0.01]">
                                <td className="p-2.5 text-center font-mono text-editorial-dark/40 border-r border-editorial-dark/10 bg-editorial-dark/[0.02]">{rowIndex + 1}</td>
                                {headers.map((_, colIndex) => (
                                  <td key={colIndex} className="p-2.5 text-editorial-dark/85 border-l border-editorial-dark/10 first:border-l-0 whitespace-nowrap overflow-hidden max-w-[200px] truncate font-mono" title={row[colIndex] || ''}>
                                    {row[colIndex] !== undefined && row[colIndex] !== '' ? row[colIndex] : <span className="text-editorial-dark/25 italic">empty</span>}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-editorial-dark/10 bg-editorial-dark/[0.02] px-6 py-4">
                <span className="text-[10px] font-mono text-editorial-dark/40 uppercase">
                  First 5 Data Rows Shown
                </span>
                <div className="flex items-center gap-3">
                  <button
                    id="close-preview-button"
                    type="button"
                    onClick={() => setIsPreviewModalOpen(false)}
                    className="rounded-none border border-editorial-dark/20 bg-editorial-bg px-4 py-2 text-xs font-mono uppercase tracking-wider text-editorial-dark hover:bg-editorial-accent-light/40 transition-colors cursor-pointer"
                  >
                    Close Preview
                  </button>
                  <button
                    id="preview-continue-mapping-button"
                    type="button"
                    onClick={() => {
                      setIsPreviewModalOpen(false);
                      setIsCSVMappingModalOpen(true);
                    }}
                    className="rounded-none bg-editorial-orange text-white px-5 py-2 text-xs font-mono uppercase tracking-wider hover:bg-editorial-orange/90 transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <Upload size={13} />
                    <span>Continue to Mapping</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
