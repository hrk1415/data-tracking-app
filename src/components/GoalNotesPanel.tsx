/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { DailyReflection, Tracker, LogEntry, CATEGORIES } from '../types';
import {
  Calendar,
  Search,
  ChevronDown,
  Trash2,
  Edit3,
  Check,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GoalNotesPanelProps {
  reflections: DailyReflection[];
  trackers: Tracker[];
  logs: LogEntry[];
  onSaveGoalNote: (date: string, trackerId: string, noteText: string) => void;
  onSaveDailyReflection?: (date: string, text: string) => void;
  onSelectDate?: (date: string) => void;
  selectedDate?: string;
}

type RangePreset = '7' | '30' | '90' | 'custom' | 'all';
type NoteTypeFilter = 'all' | 'goal_note' | 'daily_reflection';

export function GoalNotesPanel({
  reflections,
  trackers,
  logs,
  onSaveGoalNote,
  onSaveDailyReflection,
  onSelectDate,
  selectedDate,
}: GoalNotesPanelProps) {
  // Filter & Search states
  const [rangePreset, setRangePreset] = useState<RangePreset>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<NoteTypeFilter>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [selectedTrackerFilter, setSelectedTrackerFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Inline editing state
  const [editingKey, setEditingKey] = useState<string | null>(null); // "date_trackerId" or "date_reflection"
  const [editingText, setEditingText] = useState<string>('');

  // Trackers with daily goals (since only those can have goal notes)
  const targetTrackers = useMemo(() => {
    return trackers.filter(t => t.targetValue !== undefined && t.targetValue > 0);
  }, [trackers]);

  // Extract and combine all goal notes and daily journal reflections from reflections
  const allNotes = useMemo(() => {
    const list: {
      key: string;
      type: 'goal_note' | 'daily_reflection';
      date: string;
      note: string;
      // Goal specific fields
      trackerId?: string;
      tracker?: Tracker;
      isMet?: boolean;
      currentValue?: number;
      targetValue?: number;
    }[] = [];

    reflections.forEach(reflection => {
      // 1. Add Daily Journal Reflection
      if (reflection.text && reflection.text.trim() !== '') {
        list.push({
          key: `${reflection.date}_reflection`,
          type: 'daily_reflection',
          date: reflection.date,
          note: reflection.text,
        });
      }

      // 2. Add Goal Notes
      if (reflection.goalNotes) {
        Object.entries(reflection.goalNotes).forEach(([trackerId, noteText]) => {
          if (!noteText || noteText.trim() === '') return;

          const tracker = trackers.find(t => t.id === trackerId);
          if (!tracker) return; // Skip if tracker was deleted

          // Calculate if met on this specific date
          const trackerLogs = logs.filter(l => l.trackerId === trackerId && l.date === reflection.date);
          const currentValue = tracker.type === 'counter'
            ? trackerLogs.reduce((sum, l) => sum + l.value, 0)
            : (trackerLogs.length > 0 ? trackerLogs[trackerLogs.length - 1].value : 0);
          
          const isMet = currentValue >= (tracker.targetValue || 0);

          list.push({
            key: `${reflection.date}_goal_${trackerId}`,
            type: 'goal_note',
            date: reflection.date,
            trackerId,
            tracker,
            note: noteText,
            isMet,
            currentValue,
            targetValue: tracker.targetValue || 0,
          });
        });
      }
    });

    return list;
  }, [reflections, trackers, logs]);

  // Filter notes based on type, range, tracker selection, search query
  const filteredNotes = useMemo(() => {
    let result = [...allNotes];

    // 1. Note Type Filter
    if (selectedTypeFilter !== 'all') {
      result = result.filter(n => n.type === selectedTypeFilter);
    }

    // 2. Date Range Filter
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    if (rangePreset !== 'all') {
      if (rangePreset === 'custom') {
        if (customStartDate) {
          result = result.filter(n => n.date >= customStartDate);
        }
        if (customEndDate) {
          result = result.filter(n => n.date <= customEndDate);
        }
      } else {
        const days = parseInt(rangePreset);
        const cutoffDate = new Date();
        cutoffDate.setDate(today.getDate() - days);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];
        result = result.filter(n => n.date >= cutoffStr);
      }
    }

    // 3. Tracker Filter (only applies to goal notes)
    if (selectedTrackerFilter !== 'all') {
      result = result.filter(n => n.type === 'goal_note' && n.trackerId === selectedTrackerFilter);
    }

    // 4. Search Query Filter
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(n => 
        n.note.toLowerCase().includes(q) || 
        n.date.includes(q) ||
        (n.type === 'goal_note' && n.tracker?.name.toLowerCase().includes(q))
      );
    }

    // 5. Sort Order
    result.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) {
        return sortOrder === 'desc' ? -cmp : cmp;
      }
      // If same date, place reflections first, then goal notes
      return a.type === 'daily_reflection' ? -1 : 1;
    });

    return result;
  }, [allNotes, selectedTypeFilter, rangePreset, customStartDate, customEndDate, selectedTrackerFilter, searchQuery, sortOrder]);

  // Handle Edit Action
  const startEditing = (key: string, currentVal: string) => {
    setEditingKey(key);
    setEditingText(currentVal);
  };

  const saveEdit = (key: string, date: string, trackerId?: string) => {
    if (trackerId) {
      onSaveGoalNote(date, trackerId, editingText);
    } else {
      if (onSaveDailyReflection) {
        onSaveDailyReflection(date, editingText);
      }
    }
    setEditingKey(null);
  };

  const cancelEdit = () => {
    setEditingKey(null);
  };

  const deleteNote = (key: string, date: string, trackerId?: string) => {
    const confirmMsg = trackerId 
      ? 'Are you sure you want to delete this daily goal note?'
      : 'Are you sure you want to clear this daily journal reflection?';
    if (confirm(confirmMsg)) {
      if (trackerId) {
        onSaveGoalNote(date, trackerId, '');
      } else {
        if (onSaveDailyReflection) {
          onSaveDailyReflection(date, '');
        }
      }
    }
  };

  // Helper to format date cleanly
  const formatNoteDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('default', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-6">
      {/* Title block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-editorial-dark/10 pb-4.5 gap-4">
        <div>
          <h3 className="font-serif font-medium text-lg text-editorial-dark flex items-center gap-2">
            <FileText className="text-editorial-accent shrink-0" size={18} />
            Daily Notes & Progress Reflections
          </h3>
          <p className="text-xs font-sans italic text-editorial-dark/60 mt-1">
            Browse, search, and manage context notes, justifications, and journal entries logged for your progress across history.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] font-mono font-medium text-editorial-dark/50 uppercase tracking-widest bg-editorial-dark/5 border border-editorial-dark/10 px-2.5 py-1">
            Total Logs: {allNotes.length}
          </span>
        </div>
      </div>

      {/* Filters Toolbar Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 bg-editorial-dark/[0.01] border border-editorial-dark/10 p-4.5">
        
        {/* Presets and Custom range */}
        <div className="lg:col-span-3 space-y-3">
          <label className="block text-[10px] font-mono uppercase tracking-wider font-semibold text-editorial-dark/60">
            Date Interval Preset
          </label>
          <div className="flex flex-wrap gap-1.5">
            {(['all', '7', '30', '90', 'custom'] as const).map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setRangePreset(preset)}
                className={`px-2 py-1 text-[10px] font-mono border transition-all cursor-pointer ${
                  rangePreset === preset
                    ? 'bg-editorial-accent text-editorial-bg border-editorial-accent font-semibold'
                    : 'bg-editorial-bg text-editorial-dark/60 border-editorial-dark/15 hover:border-editorial-dark/30 hover:text-editorial-dark'
                }`}
              >
                {preset === 'all' ? 'All' : preset === 'custom' ? 'Custom' : `${preset}d`}
              </button>
            ))}
          </div>

          {rangePreset === 'custom' && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-editorial-dark/40 uppercase">From:</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full rounded-none border border-editorial-dark/20 bg-editorial-bg px-2 py-1 text-[10px] font-mono text-editorial-dark focus:border-editorial-accent focus:outline-hidden"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-editorial-dark/40 uppercase">To:</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full rounded-none border border-editorial-dark/20 bg-editorial-bg px-2 py-1 text-[10px] font-mono text-editorial-dark focus:border-editorial-accent focus:outline-hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Note Type Filter */}
        <div className="lg:col-span-2 space-y-3">
          <label className="block text-[10px] font-mono uppercase tracking-wider font-semibold text-editorial-dark/60">
            Note Type
          </label>
          <div className="relative">
            <select
              value={selectedTypeFilter}
              onChange={(e) => {
                setSelectedTypeFilter(e.target.value as NoteTypeFilter);
                if (e.target.value === 'daily_reflection') {
                  setSelectedTrackerFilter('all');
                }
              }}
              className="w-full appearance-none rounded-none border border-editorial-dark/20 bg-editorial-bg pl-3.5 pr-8 py-1.5 text-xs font-serif text-editorial-dark focus:border-editorial-accent transition-all outline-hidden cursor-pointer"
            >
              <option value="all">All Types</option>
              <option value="goal_note">Goal Notes</option>
              <option value="daily_reflection">Daily Reflections</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-editorial-dark/40 pointer-events-none" size={13} />
          </div>
        </div>

        {/* Tracker dropdown filter */}
        <div className="lg:col-span-3 space-y-3">
          <label className="block text-[10px] font-mono uppercase tracking-wider font-semibold text-editorial-dark/60">
            Filter by Tracker
          </label>
          <div className="relative">
            <select
              value={selectedTrackerFilter}
              onChange={(e) => setSelectedTrackerFilter(e.target.value)}
              disabled={selectedTypeFilter === 'daily_reflection'}
              className="w-full appearance-none rounded-none border border-editorial-dark/20 bg-editorial-bg pl-3.5 pr-8 py-1.5 text-xs font-serif text-editorial-dark focus:border-editorial-accent transition-all outline-hidden cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <option value="all">All Trackers & Habits</option>
              {targetTrackers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} (Goal: &ge; {t.targetValue})
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-editorial-dark/40 pointer-events-none" size={13} />
          </div>
        </div>

        {/* Search Input Filter */}
        <div className="lg:col-span-2 space-y-3">
          <label className="block text-[10px] font-mono uppercase tracking-wider font-semibold text-editorial-dark/60">
            Search Content
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search content or dates..."
              className="w-full rounded-none border border-editorial-dark/20 bg-editorial-bg pl-7 pr-2 py-1.5 text-xs font-serif italic text-editorial-dark placeholder:text-editorial-dark/30 focus:border-editorial-accent transition-all outline-hidden"
            />
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-editorial-dark/40" size={12} />
          </div>
        </div>

        {/* Sort order configuration */}
        <div className="lg:col-span-2 space-y-3 flex flex-col justify-between">
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider font-semibold text-editorial-dark/60 mb-1.5">
              Chronology Sort
            </label>
            <div className="flex border border-editorial-dark/15">
              <button
                type="button"
                onClick={() => setSortOrder('desc')}
                className={`flex-1 py-1.5 text-[9px] font-mono transition-all cursor-pointer ${
                  sortOrder === 'desc'
                    ? 'bg-editorial-dark text-editorial-bg font-bold'
                    : 'bg-editorial-bg text-editorial-dark/60 hover:text-editorial-dark hover:bg-editorial-dark/5'
                }`}
              >
                Newest
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('asc')}
                className={`flex-1 py-1.5 text-[9px] font-mono transition-all cursor-pointer ${
                  sortOrder === 'asc'
                    ? 'bg-editorial-dark text-editorial-bg font-bold'
                    : 'bg-editorial-bg text-editorial-dark/60 hover:text-editorial-dark hover:bg-editorial-dark/5'
                }`}
              >
                Oldest
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Goal Notes List representation */}
      {filteredNotes.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-editorial-dark/15 bg-editorial-dark/[0.01]">
          <AlertCircle size={32} className="mx-auto text-editorial-dark/30 mb-3 stroke-[1.25px]" />
          <h4 className="font-serif text-base text-editorial-dark/70">No notes or reflections match your filters</h4>
          <p className="text-xs font-sans text-editorial-dark/50 max-w-md mx-auto mt-1 leading-relaxed italic">
            {allNotes.length === 0
              ? 'You have not added any notes or daily reflections yet. Complete daily metrics and write reflections in the dashboard checklists to start logging.'
              : 'Try relaxing your filter criteria or changing the date range selections.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-editorial-dark/45 font-semibold">
              Showing {filteredNotes.length} of {allNotes.length} Notes Chronologically
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {filteredNotes.map((noteItem) => {
                const isEditing = editingKey === noteItem.key;
                const cat = noteItem.tracker ? CATEGORIES.find(c => c.id === noteItem.tracker!.category) : null;
                const isGoal = noteItem.type === 'goal_note';

                return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    key={noteItem.key}
                    className={`p-5 border flex flex-col md:flex-row justify-between gap-4.5 bg-editorial-bg transition-all ${
                      isGoal
                        ? (noteItem.isMet
                          ? 'border-editorial-emerald/15 hover:border-editorial-emerald/25'
                          : 'border-editorial-rose/15 hover:border-editorial-rose/25')
                        : 'border-editorial-accent/15 hover:border-editorial-accent/25'
                    }`}
                  >
                    {/* Left: Metadata & Context */}
                    <div className="space-y-3 flex-1 min-w-0">
                      
                      {/* Note Header: Date & Goal Meta */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-mono font-bold text-editorial-dark/85">
                          <Calendar size={13} className="text-editorial-accent" />
                          <span>{formatNoteDate(noteItem.date)}</span>
                        </div>
                        <span className="text-editorial-dark/15 hidden sm:inline">|</span>
                        
                        {isGoal && noteItem.tracker ? (
                          /* Tracker tag with indicator bullet */
                          <div className="flex items-center gap-2 min-w-0">
                            <span 
                              className="w-2.5 h-2.5 rounded-full shrink-0" 
                              style={{ backgroundColor: `var(--editorial-${noteItem.tracker.color})` }}
                            />
                            <span className="font-mono font-semibold text-editorial-dark truncate">
                              {noteItem.tracker.name}
                            </span>
                            <span className="text-[10px] font-serif italic text-editorial-dark/55">
                              ({cat?.name || 'Goal Note'})
                            </span>
                          </div>
                        ) : (
                          /* Journal Entry Header */
                          <div className="flex items-center gap-1.5 min-w-0 text-editorial-accent">
                            <BookOpen size={12} />
                            <span className="font-mono font-bold text-[10px] uppercase tracking-wider">
                              Daily Journal Reflection
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Content block: The Note text */}
                      <div className="relative pl-4 py-1">
                        {/* Elegant bracket quote strip */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-0.5"
                          style={{ 
                            backgroundColor: isGoal && noteItem.tracker 
                              ? `var(--editorial-${noteItem.tracker.color})` 
                              : `var(--editorial-accent)` 
                          }}
                        />
                        
                        {isEditing ? (
                          <div className="space-y-2 pt-1">
                            <textarea
                              value={editingText}
                              onChange={(e) => setEditingText(e.target.value)}
                              rows={2}
                              className="w-full text-xs font-serif italic text-editorial-dark bg-transparent border-0 border-b border-editorial-dark/20 focus:border-editorial-accent p-1 outline-hidden focus:ring-0 resize-none"
                              placeholder={isGoal ? "Edit your goal note..." : "Edit your daily reflection..."}
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => saveEdit(noteItem.key, noteItem.date, noteItem.trackerId)}
                                className="inline-flex items-center gap-1 bg-editorial-dark text-editorial-bg font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-all hover:bg-editorial-accent cursor-pointer"
                              >
                                <Check size={10} />
                                <span>Save</span>
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="inline-flex items-center gap-1 border border-editorial-dark/25 text-editorial-dark/60 font-mono text-[9px] font-bold uppercase tracking-wider px-2 py-1 transition-all hover:bg-editorial-dark/5 cursor-pointer"
                              >
                                <X size={10} />
                                <span>Cancel</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm font-serif italic text-editorial-dark/90 leading-relaxed whitespace-pre-wrap">
                            "{noteItem.note}"
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Right: State Achievement indicator & Quick Actions */}
                    <div className="flex flex-col justify-between items-end shrink-0 gap-4">
                      
                      {/* Metric value achieved on that day */}
                      <div className="text-right space-y-1">
                        <span className="block text-[9px] font-mono text-editorial-dark/45 uppercase tracking-widest">
                          {isGoal ? 'Goal Status' : 'Reflection Entry'}
                        </span>
                        
                        <div className="flex items-center gap-1.5 justify-end">
                          {isGoal && noteItem.tracker ? (
                            <>
                              <span className="text-xs font-mono font-medium text-editorial-dark/75">
                                {noteItem.currentValue} / {noteItem.targetValue} {noteItem.tracker.unit || ''}
                              </span>
                              
                              {noteItem.isMet ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase text-editorial-emerald bg-editorial-emerald/10 px-2 py-0.5 border border-editorial-emerald/20">
                                  <CheckCircle2 size={10} />
                                  <span>Met</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase text-editorial-rose bg-editorial-rose/10 px-2 py-0.5 border border-editorial-rose/20">
                                  <XCircle size={10} />
                                  <span>Unmet</span>
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold uppercase text-editorial-accent bg-editorial-accent/10 px-2 py-0.5 border border-editorial-accent/20">
                              <BookOpen size={10} />
                              <span>Journaled</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Editing Actions and Navigation Button */}
                      <div className="flex items-center gap-2">
                        {onSelectDate && (
                          <button
                            type="button"
                            onClick={() => onSelectDate(noteItem.date)}
                            className={`flex items-center gap-1 px-2 py-1 text-[9px] font-mono border transition-all cursor-pointer ${
                              selectedDate === noteItem.date
                                ? 'bg-editorial-accent text-editorial-bg border-editorial-accent font-semibold'
                                : 'bg-transparent text-editorial-dark/50 border-editorial-dark/15 hover:border-editorial-dark/30 hover:text-editorial-dark'
                            }`}
                            title="Navigate to this date in the main calendar"
                          >
                            <ArrowRight size={10} />
                            <span>{selectedDate === noteItem.date ? 'Current Active Date' : 'Go to Date'}</span>
                          </button>
                        )}

                        {!isEditing && (
                          <>
                            <button
                              type="button"
                              onClick={() => startEditing(noteItem.key, noteItem.note)}
                              className="p-1.5 border border-editorial-dark/10 hover:border-editorial-accent hover:text-editorial-accent rounded-none text-editorial-dark/40 transition-colors cursor-pointer"
                              title="Edit Note"
                            >
                              <Edit3 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteNote(noteItem.key, noteItem.date, noteItem.trackerId)}
                              className="p-1.5 border border-editorial-dark/10 hover:border-rose-600 hover:text-rose-600 rounded-none text-editorial-dark/40 transition-colors cursor-pointer"
                              title="Delete Note"
                            >
                              <Trash2 size={12} />
                            </button>
                          </>
                        )}
                      </div>

                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
