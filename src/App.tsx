/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Tracker, LogEntry, CATEGORIES, COLOR_MAP } from './types';
import { loadData, saveTrackers, saveLogs, exportDataAsJson, importDataFromJson } from './utils/storage';
import { AddTrackerModal } from './components/AddTrackerModal';
import { TrackerCard } from './components/TrackerCard';
import { TrackerAnalytics } from './components/TrackerAnalytics';
import { LogHistory } from './components/LogHistory';
import { ManageTrackers } from './components/ManageTrackers';
import { LucideIcon } from './components/LucideIcon';
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
  Minus
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
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'analytics' | 'history' | 'manage'>('dashboard');
  const [isAddTrackerOpen, setIsAddTrackerOpen] = useState(false);
  const [isBackupSectionOpen, setIsBackupSectionOpen] = useState(false);

  // Initialize state on client mount
  useEffect(() => {
    const data = loadData();
    setTrackers(data.trackers);
    setLogs(data.logs);

    // Default selected date to today (local timezone, YYYY-MM-DD)
    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const localISOTime = new Date(today.getTime() - tzOffset).toISOString().split('T')[0];
    setSelectedDate(localISOTime);
  }, []);

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

  // Overall statistics
  const totalLogsCount = logs.length;
  const healthCategoryCount = trackers.filter(t => t.category === 'health').length;
  const fitnessCategoryCount = trackers.filter(t => t.category === 'fitness').length;
  const productivityCategoryCount = trackers.filter(t => t.category === 'productivity').length;

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
          alert('Data tracking backup imported successfully!');
          setIsBackupSectionOpen(false);
        } else {
          alert('Invalid backup file. Please ensure the file is a valid JSON exported from this tracker application.');
        }
      }
    };
    reader.readAsText(file);
  };

  const handleExportData = () => {
    const dataStr = exportDataAsJson(trackers, logs);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `data_tracker_backup_${selectedDate}.json`;
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

                {/* Daily Aggregates Bento Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

                {/* Tracker Cards Grid Display */}
                <div>
                  <div className="flex items-center justify-between mb-4 border-b border-editorial-dark/10 pb-2">
                    <h3 className="text-xs font-mono text-editorial-accent tracking-widest uppercase">Tracked Metrics</h3>
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
