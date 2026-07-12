/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Tracker, LogEntry, CATEGORIES, COLOR_MAP, DailyReflection, Milestone, MILESTONE_CATEGORIES } from '../types';
import { LucideIcon } from './LucideIcon';
import {
  Search,
  Filter,
  Trash2,
  Edit2,
  X,
  Check,
  Calendar,
  AlertCircle,
  MessageSquare,
  Download,
  Flag,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LogHistoryProps {
  trackers: Tracker[];
  logs: LogEntry[];
  onDeleteLog: (logId: string) => void;
  onUpdateLog: (logId: string, updatedValue: number, updatedNote?: string) => void;
  searchQuery?: string;
  setSearchQuery?: (q: string) => void;
  filterTrackerId?: string;
  setFilterTrackerId?: (id: string) => void;
  filterCategory?: string;
  setFilterCategory?: (cat: string) => void;
  onJumpToDate?: (date: string) => void;
  reflections?: DailyReflection[];
  onDeleteMilestone?: (date: string, id: string) => void;
}

export function LogHistory({
  trackers,
  logs,
  onDeleteLog,
  onUpdateLog,
  searchQuery: externalSearchQuery,
  setSearchQuery: externalSetSearchQuery,
  filterTrackerId: externalFilterTrackerId,
  setFilterTrackerId: externalSetFilterTrackerId,
  filterCategory: externalFilterCategory,
  setFilterCategory: externalSetFilterCategory,
  onJumpToDate,
  reflections = [],
  onDeleteMilestone,
}: LogHistoryProps) {
  // Inline fallbacks if external controls aren't provided
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [internalFilterTrackerId, setInternalFilterTrackerId] = useState('all');
  const [internalFilterCategory, setInternalFilterCategory] = useState('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // History Tab Selector: Metric Logs vs Milestones/Reflections
  const [historySubTab, setHistorySubTab] = useState<'logs' | 'milestones'>('logs');
  const [milestoneFilterCategory, setMilestoneFilterCategory] = useState<string>('all');

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = externalSetSearchQuery !== undefined ? externalSetSearchQuery : setInternalSearchQuery;

  const filterTrackerId = externalFilterTrackerId !== undefined ? externalFilterTrackerId : internalFilterTrackerId;
  const setFilterTrackerId = externalSetFilterTrackerId !== undefined ? externalSetFilterTrackerId : setInternalFilterTrackerId;

  const filterCategory = externalFilterCategory !== undefined ? externalFilterCategory : internalFilterCategory;
  const setFilterCategory = externalSetFilterCategory !== undefined ? externalSetFilterCategory : setInternalFilterCategory;

  // Inline editing state
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editNote, setEditNote] = useState<string>('');

  // Sort logs by date and timestamp descending
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const dateA = new Date(a.timestamp || a.date).getTime();
      const dateB = new Date(b.timestamp || b.date).getTime();
      return dateB - dateA;
    });
  }, [logs]);

  // Filter logs
  const filteredLogs = useMemo(() => {
    return sortedLogs.filter(log => {
      const tracker = trackers.find(t => t.id === log.trackerId);
      if (!tracker) return false;

      // Filter by tracker
      if (filterTrackerId !== 'all' && log.trackerId !== filterTrackerId) {
        return false;
      }

      // Filter by category
      if (filterCategory !== 'all' && tracker.category !== filterCategory) {
        return false;
      }

      // Filter by date range
      if (startDate && log.date < startDate) {
        return false;
      }
      if (endDate && log.date > endDate) {
        return false;
      }

      // Filter by search query (matches tracker name, note, or date)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = tracker.name.toLowerCase().includes(query);
        const matchesNote = log.note?.toLowerCase().includes(query) || false;
        
        // Get various date formats for flexible search matching
        const formattedShort = formatDateDisplay(log.date).toLowerCase();
        const dFull = new Date(log.date + 'T12:00:00');
        const formattedLong = dFull.toLocaleDateString('en-US', {
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
  }, [sortedLogs, trackers, filterTrackerId, filterCategory, searchQuery, startDate, endDate]);

  const startEdit = (log: LogEntry) => {
    setEditingLogId(log.id);
    setEditValue(log.value.toString());
    setEditNote(log.note || '');
  };

  const cancelEdit = () => {
    setEditingLogId(null);
    setEditValue('');
    setEditNote('');
  };

  const saveEdit = (logId: string) => {
    const parsed = parseFloat(editValue);
    if (!isNaN(parsed)) {
      onUpdateLog(logId, parsed, editNote.trim() || undefined);
      cancelEdit();
    }
  };

  // Helper to format date display (e.g. "Monday, Jul 06")
  const formatDateDisplay = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00'); // Neutral timezone to avoid local offset errors
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  // Helper to escape CSV fields
  const escapeCSV = (val: unknown) => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCSV = (dataToExport: LogEntry[], filename: string) => {
    const headers = ['Log ID', 'Tracker ID', 'Tracker Name', 'Category', 'Date', 'Value', 'Unit', 'Note', 'Timestamp'];
    const rows = dataToExport.map(log => {
      const tracker = trackers.find(t => t.id === log.trackerId);
      const isBoolean = tracker?.type === 'boolean';
      return [
        log.id,
        log.trackerId,
        tracker ? tracker.name : 'Unknown Tracker',
        tracker ? tracker.category : '',
        log.date,
        isBoolean ? (log.value === 1 ? 'Yes' : 'No') : log.value,
        (tracker && tracker.type !== 'boolean') ? (tracker.unit || '') : '',
        log.note || '',
        log.timestamp || ''
      ];
    });

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Compile full list of historical milestones
  const milestoneList = useMemo(() => {
    if (!reflections) return [];
    const list: { date: string; milestone: Milestone }[] = [];
    reflections.forEach(ref => {
      if (ref.milestones) {
        ref.milestones.forEach(ms => {
          list.push({ date: ref.date, milestone: ms });
        });
      }
    });
    // Sort by date descending, then by time descending
    return list.sort((a, b) => {
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date);
      }
      return b.milestone.time.localeCompare(a.milestone.time);
    });
  }, [reflections]);

  // Filter milestones based on active filters and search query
  const filteredMilestones = useMemo(() => {
    return milestoneList.filter(item => {
      const { date, milestone } = item;
      
      // Filter by category
      if (milestoneFilterCategory !== 'all' && milestone.category !== milestoneFilterCategory) {
        return false;
      }
      
      // Filter by date range
      if (startDate && date < startDate) return false;
      if (endDate && date > endDate) return false;
      
      // Filter by search query (milestone text, notes, or formatted date)
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesText = milestone.text.toLowerCase().includes(query);
        const matchesNotes = milestone.notes?.toLowerCase().includes(query) || false;
        
        const formattedShort = formatDateDisplay(date).toLowerCase();
        const dFull = new Date(date + 'T12:00:00');
        const formattedLong = dFull.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }).toLowerCase();
        
        const matchesDate = date.includes(query) || 
                            formattedShort.includes(query) || 
                            formattedLong.includes(query);
                            
        if (!matchesText && !matchesNotes && !matchesDate) {
          return false;
        }
      }
      return true;
    });
  }, [milestoneList, milestoneFilterCategory, startDate, endDate, searchQuery]);

  const handleExportMilestonesCSV = (milestonesToExport: typeof filteredMilestones, filename: string) => {
    const headers = ['Milestone ID', 'Date', 'Time', 'Text', 'Importance', 'Category', 'Notes'];
    const rows = milestonesToExport.map(item => {
      const ms = item.milestone;
      const cat = MILESTONE_CATEGORIES.find(c => c.id === ms.category);
      return [
        ms.id,
        item.date,
        ms.time,
        ms.text,
        ms.importance || 'none',
        cat ? cat.name : 'None',
        ms.notes || ''
      ];
    });

    const csvContent = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => row.map(escapeCSV).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* History Sub-tab Switcher */}
      <div className="flex border-b border-editorial-dark/10 pb-0.5 gap-2">
        <button
          type="button"
          onClick={() => {
            setHistorySubTab('logs');
            setSearchQuery('');
          }}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-serif font-medium text-sm border-b-2 transition-all cursor-pointer ${
            historySubTab === 'logs'
              ? 'border-editorial-accent text-editorial-dark font-semibold'
              : 'border-transparent text-editorial-dark/40 hover:text-editorial-dark/70'
          }`}
        >
          <Calendar size={14} className={historySubTab === 'logs' ? 'text-editorial-accent' : 'text-editorial-dark/30'} />
          <span>Metric Tracking Logs</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setHistorySubTab('milestones');
            setSearchQuery('');
          }}
          className={`flex items-center gap-1.5 px-4 py-2.5 font-serif font-medium text-sm border-b-2 transition-all cursor-pointer ${
            historySubTab === 'milestones'
              ? 'border-editorial-accent text-editorial-dark font-semibold'
              : 'border-transparent text-editorial-dark/40 hover:text-editorial-dark/70'
          }`}
        >
          <Flag size={14} className={historySubTab === 'milestones' ? 'text-editorial-accent' : 'text-editorial-dark/30'} />
          <span>Timestamped Milestones & Reflections</span>
        </button>
      </div>

      {/* Search and Filters panel */}
      <div className="bg-editorial-bg p-6 rounded-none border border-editorial-dark/15 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-editorial-dark/10 pb-3">
          <h3 className="font-serif font-medium text-lg text-editorial-dark flex items-center gap-2">
            <Filter size={16} className="text-editorial-accent" />
            {historySubTab === 'logs' ? 'Filter History Logs' : 'Filter Milestones History'}
          </h3>
          
          <div className="flex flex-wrap gap-2">
            {historySubTab === 'logs' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleExportCSV(filteredLogs, 'filtered_logs_history.csv')}
                  disabled={filteredLogs.length === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] border rounded-none transition-all cursor-pointer ${
                    filteredLogs.length > 0
                      ? 'bg-editorial-dark hover:bg-editorial-accent hover:text-editorial-bg text-editorial-bg border-editorial-dark'
                      : 'bg-editorial-dark/5 text-editorial-dark/30 border-editorial-dark/10 cursor-not-allowed'
                  }`}
                  title="Download only the currently filtered logs as CSV"
                >
                  <Download size={13} />
                  <span>Export Filtered ({filteredLogs.length})</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleExportCSV(logs, 'all_logs_history.csv')}
                  disabled={logs.length === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] border rounded-none transition-all cursor-pointer ${
                    logs.length > 0
                      ? 'bg-editorial-bg hover:bg-editorial-dark/5 text-editorial-dark border-editorial-dark/20'
                      : 'bg-editorial-bg text-editorial-dark/30 border-editorial-dark/10 cursor-not-allowed'
                  }`}
                  title="Download entire log history as CSV"
                >
                  <Download size={13} />
                  <span>Export All ({logs.length})</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => handleExportMilestonesCSV(filteredMilestones, 'filtered_milestones_history.csv')}
                  disabled={filteredMilestones.length === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] border rounded-none transition-all cursor-pointer ${
                    filteredMilestones.length > 0
                      ? 'bg-editorial-dark hover:bg-editorial-accent hover:text-editorial-bg text-editorial-bg border-editorial-dark'
                      : 'bg-editorial-dark/5 text-editorial-dark/30 border-editorial-dark/10 cursor-not-allowed'
                  }`}
                  title="Download only the currently filtered milestones as CSV"
                >
                  <Download size={13} />
                  <span>Export Filtered ({filteredMilestones.length})</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => handleExportMilestonesCSV(milestoneList, 'all_milestones_history.csv')}
                  disabled={milestoneList.length === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-mono text-[11px] border rounded-none transition-all cursor-pointer ${
                    milestoneList.length > 0
                      ? 'bg-editorial-bg hover:bg-editorial-dark/5 text-editorial-dark border-editorial-dark/20'
                      : 'bg-editorial-bg text-editorial-dark/30 border-editorial-dark/10 cursor-not-allowed'
                  }`}
                  title="Download entire milestone history as CSV"
                >
                  <Download size={13} />
                  <span>Export All ({milestoneList.length})</span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search bar */}
          <div className="relative md:col-span-2">
            <input
              type="text"
              placeholder={historySubTab === 'logs' ? "Search logs by name, note, date..." : "Search milestones by text, notes, date..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-none border border-editorial-dark/20 text-sm focus:border-editorial-accent bg-editorial-bg font-sans outline-hidden"
            />
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-editorial-dark/40" size={16} />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-editorial-dark/40 hover:text-editorial-dark"
              >
                <X size={15} />
              </button>
            )}
          </div>

          {historySubTab === 'logs' ? (
            <>
              {/* Tracker Filter */}
              <div>
                <select
                  value={filterTrackerId}
                  onChange={(e) => setFilterTrackerId(e.target.value)}
                  className="w-full rounded-none border border-editorial-dark/20 px-3.5 py-2.5 text-sm bg-editorial-bg font-serif text-editorial-dark focus:border-editorial-accent transition-all outline-hidden cursor-pointer"
                >
                  <option value="all">All Trackers</option>
                  {trackers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Filter */}
              <div>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full rounded-none border border-editorial-dark/20 px-3.5 py-2.5 text-sm bg-editorial-bg font-serif text-editorial-dark focus:border-editorial-accent transition-all outline-hidden cursor-pointer"
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <div className="md:col-span-2">
              {/* Milestone Category Filter */}
              <select
                value={milestoneFilterCategory}
                onChange={(e) => setMilestoneFilterCategory(e.target.value)}
                className="w-full rounded-none border border-editorial-dark/20 px-3.5 py-2.5 text-sm bg-editorial-bg font-serif text-editorial-dark focus:border-editorial-accent transition-all outline-hidden cursor-pointer"
              >
                <option value="all">All Milestone Categories</option>
                {MILESTONE_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Date Range Picker */}
        <div className="pt-4 border-t border-editorial-dark/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <span className="text-xs font-mono font-medium text-editorial-dark/60 uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Calendar size={13} className="text-editorial-accent" />
              Date Range:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-editorial-bg border border-editorial-dark/20 text-xs font-mono px-2.5 py-1.5 focus:border-editorial-accent outline-hidden cursor-pointer w-[145px] text-editorial-dark"
                title="Start Date"
              />
              <span className="text-xs font-mono text-editorial-dark/40">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-editorial-bg border border-editorial-dark/20 text-xs font-mono px-2.5 py-1.5 focus:border-editorial-accent outline-hidden cursor-pointer w-[145px] text-editorial-dark"
                title="End Date"
              />

              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-[10px] font-mono text-rose-500 hover:text-rose-700 hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                  title="Clear date filter"
                >
                  <X size={12} />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono text-editorial-dark/40 uppercase">Presets:</span>
            {[
              { label: 'Today', getValue: () => {
                const today = new Date().toISOString().split('T')[0];
                return { start: today, end: today };
              }},
              { label: 'Last 7 Days', getValue: () => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 6);
                return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
              }},
              { label: 'Last 30 Days', getValue: () => {
                const end = new Date();
                const start = new Date();
                start.setDate(end.getDate() - 29);
                return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
              }},
              { label: 'This Month', getValue: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1);
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
              }},
              { label: 'This Year', getValue: () => {
                const now = new Date();
                const start = new Date(now.getFullYear(), 0, 1);
                const end = new Date(now.getFullYear(), 11, 31);
                return { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] };
              }},
            ].map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  const range = preset.getValue();
                  setStartDate(range.start);
                  setEndDate(range.end);
                }}
                className="px-2 py-1 text-[10px] font-mono border border-editorial-dark/10 bg-editorial-dark/[0.02] hover:bg-editorial-dark/5 hover:border-editorial-dark/25 text-editorial-dark/70 transition-all cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Active Filters Info Bar */}
      {historySubTab === 'logs' ? (
        (searchQuery || filterTrackerId !== 'all' || filterCategory !== 'all' || startDate || endDate) && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-editorial-accent-light/15 border-l-2 border-editorial-accent text-xs text-editorial-dark/80 font-sans">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold uppercase tracking-wider text-[10px] text-editorial-dark/50">Filter Status:</span>
              <span className="font-mono bg-editorial-bg px-2 py-0.5 border border-editorial-dark/10">
                {filteredLogs.length} of {logs.length} entries match
              </span>
              {searchQuery && (
                <span className="bg-editorial-bg px-2 py-0.5 border border-editorial-dark/10 truncate max-w-[200px]" title={`Query: "${searchQuery}"`}>
                  Search: <strong className="font-serif font-semibold">"{searchQuery}"</strong>
                </span>
              )}
              {filterTrackerId !== 'all' && (
                <span className="bg-editorial-bg px-2 py-0.5 border border-editorial-dark/10">
                  Tracker: <strong className="font-serif font-semibold">{(trackers.find(t => t.id === filterTrackerId))?.name || ''}</strong>
                </span>
              )}
              {filterCategory !== 'all' && (
                <span className="bg-editorial-bg px-2 py-0.5 border border-editorial-dark/10 capitalize">
                  Category: <strong className="font-serif font-semibold">{filterCategory}</strong>
                </span>
              )}
              {(startDate || endDate) && (
                <span className="bg-editorial-bg px-2 py-0.5 border border-editorial-dark/10">
                  Range: <strong className="font-mono font-semibold">{startDate || 'Any'}</strong> to <strong className="font-mono font-semibold">{endDate || 'Any'}</strong>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setFilterTrackerId('all');
                setFilterCategory('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-[10px] font-mono uppercase tracking-widest text-editorial-accent hover:text-editorial-dark font-bold underline underline-offset-2 shrink-0 cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )
      ) : (
        (searchQuery || milestoneFilterCategory !== 'all' || startDate || endDate) && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-editorial-accent-light/15 border-l-2 border-editorial-accent text-xs text-editorial-dark/80 font-sans">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono font-semibold uppercase tracking-wider text-[10px] text-editorial-dark/50">Filter Status:</span>
              <span className="font-mono bg-editorial-bg px-2 py-0.5 border border-editorial-dark/10">
                {filteredMilestones.length} of {milestoneList.length} milestones match
              </span>
              {searchQuery && (
                <span className="bg-editorial-bg px-2 py-0.5 border border-editorial-dark/10 truncate max-w-[200px]" title={`Query: "${searchQuery}"`}>
                  Search: <strong className="font-serif font-semibold">"{searchQuery}"</strong>
                </span>
              )}
              {milestoneFilterCategory !== 'all' && (
                <span className="bg-editorial-bg px-2 py-0.5 border border-editorial-dark/10">
                  Category: <strong className="font-serif font-semibold">{(MILESTONE_CATEGORIES.find(c => c.id === milestoneFilterCategory))?.name || ''}</strong>
                </span>
              )}
              {(startDate || endDate) && (
                <span className="bg-editorial-bg px-2 py-0.5 border border-editorial-dark/10">
                  Range: <strong className="font-mono font-semibold">{startDate || 'Any'}</strong> to <strong className="font-mono font-semibold">{endDate || 'Any'}</strong>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setMilestoneFilterCategory('all');
                setStartDate('');
                setEndDate('');
              }}
              className="text-[10px] font-mono uppercase tracking-widest text-editorial-accent hover:text-editorial-dark font-bold underline underline-offset-2 shrink-0 cursor-pointer"
            >
              Reset All Filters
            </button>
          </div>
        )
      )}

      {/* History List */}
      {historySubTab === 'logs' ? (
        <div className="bg-editorial-bg rounded-none border border-editorial-dark/15 overflow-hidden">
          {filteredLogs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-editorial-dark/15 bg-editorial-accent-light/40 text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-wider">
                    <th className="px-6 py-4">Tracker</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Logged Value</th>
                    <th className="px-6 py-4">Note / Comment</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-editorial-dark/10 text-sm">
                  <AnimatePresence initial={false}>
                    {filteredLogs.map((log) => {
                      const tracker = trackers.find(t => t.id === log.trackerId);
                      if (!tracker) return null;

                      const colorStyles = COLOR_MAP[tracker.color] || COLOR_MAP.emerald;
                      const isEditing = editingLogId === log.id;

                      return (
                        <motion.tr
                          key={log.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className={`hover:bg-editorial-accent-light/20 transition-colors ${
                            isEditing ? 'bg-editorial-accent-light/30' : ''
                          }`}
                        >
                          {/* Tracker name and icon */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-none text-white ${colorStyles.bg} border border-editorial-dark/10`}>
                                <LucideIcon name={tracker.icon} size={15} />
                              </div>
                              <div>
                                <span className="font-serif font-medium text-editorial-dark block leading-tight">
                                  {tracker.name}
                                </span>
                                <span className="text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest">
                                  {tracker.category}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Date */}
                          <td className="px-6 py-4 text-editorial-dark/80 font-mono text-xs whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onJumpToDate?.(log.date)}
                              className="flex items-center gap-1.5 hover:text-editorial-accent hover:underline cursor-pointer group text-left font-mono font-semibold"
                              title="Click to view this day's metrics and milestones on the Dashboard"
                            >
                              <Calendar size={13} className="text-editorial-accent group-hover:scale-110 transition-all duration-200" />
                              <span>{formatDateDisplay(log.date)}</span>
                            </button>
                          </td>

                          {/* Value Column */}
                          <td className="px-6 py-4">
                            {isEditing ? (
                              <div className="flex items-center gap-1.5 w-24">
                                <input
                                  type="number"
                                  step="any"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full px-2 py-1 bg-editorial-bg border border-editorial-dark/30 rounded-none text-xs font-mono outline-hidden focus:border-editorial-accent"
                                />
                                <span className="text-[10px] font-mono text-editorial-dark/60 font-semibold">
                                  {tracker.unit || ''}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-baseline gap-1 font-mono">
                                <span className="font-semibold text-editorial-dark">
                                  {tracker.type === 'boolean'
                                    ? (log.value === 1 ? 'Yes' : 'No')
                                    : log.value}
                                </span>
                                {tracker.unit && tracker.type !== 'boolean' && (
                                  <span className="text-[9px] text-editorial-dark/50 font-medium uppercase tracking-wider">
                                    {tracker.unit}
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Note Column */}
                          <td className="px-6 py-4 max-w-xs md:max-w-md">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editNote}
                                placeholder="Update comment..."
                                onChange={(e) => setEditNote(e.target.value)}
                                className="w-full px-2 py-1 bg-editorial-bg border border-editorial-dark/30 rounded-none text-xs font-sans outline-hidden focus:border-editorial-accent"
                              />
                            ) : log.note ? (
                              <div className="flex items-start gap-1.5 text-editorial-dark/80 bg-editorial-accent-light/20 px-2.5 py-1.5 rounded-none border border-editorial-accent/15 italic text-xs leading-relaxed max-w-sm truncate">
                                <MessageSquare size={11} className="text-editorial-accent shrink-0 mt-0.5" />
                                <span className="truncate">{log.note}</span>
                              </div>
                            ) : (
                              <span className="text-editorial-dark/30 text-xs italic font-sans">No note recorded</span>
                            )}
                          </td>

                          {/* Actions Column */}
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            {isEditing ? (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => saveEdit(log.id)}
                                  className="p-1.5 bg-editorial-dark hover:bg-editorial-accent text-editorial-bg rounded-none transition-colors"
                                  title="Save changes"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="p-1.5 bg-editorial-bg border border-editorial-dark/20 text-editorial-dark/70 hover:bg-editorial-accent-light rounded-none transition-colors"
                                  title="Cancel"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => startEdit(log)}
                                  className="p-1.5 border border-editorial-dark/20 text-editorial-dark hover:bg-editorial-accent-light rounded-none transition-colors cursor-pointer"
                                  title="Edit log"
                                >
                                  <Edit2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (confirm('Are you sure you want to delete this log entry?')) {
                                      onDeleteLog(log.id);
                                    }
                                  }}
                                  className="p-1.5 border border-red-200/40 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-none transition-colors cursor-pointer"
                                  title="Delete log"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-center text-editorial-dark/50 space-y-3 bg-editorial-bg">
              <AlertCircle size={28} className="text-editorial-accent/50 stroke-[1.5px]" />
              <p className="font-serif text-lg text-editorial-dark">No Log Entries Match Filters</p>
              <p className="text-xs text-editorial-dark/60 max-w-xs leading-normal font-sans italic">
                Try adjusting your query, selecting all trackers/categories, or saving some entries on the dashboard first.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-editorial-bg rounded-none border border-editorial-dark/15 overflow-hidden">
          {filteredMilestones.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[650px]">
                <thead>
                  <tr className="border-b border-editorial-dark/15 bg-editorial-accent-light/40 text-[10px] font-mono font-medium text-editorial-dark/55 uppercase tracking-wider">
                    <th className="px-6 py-4 w-32">Date</th>
                    <th className="px-6 py-4 w-24">Time</th>
                    <th className="px-6 py-4 w-40">Category</th>
                    <th className="px-6 py-4 w-32">Importance</th>
                    <th className="px-6 py-4">Milestone Detail</th>
                    <th className="px-6 py-4 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-editorial-dark/10 text-sm">
                  <AnimatePresence initial={false}>
                    {filteredMilestones.map((item) => {
                      const ms = item.milestone;
                      const cat = MILESTONE_CATEGORIES.find(c => c.id === ms.category);
                      const colorClasses = cat ? (
                        cat.color === 'emerald' ? 'bg-editorial-emerald-light text-editorial-emerald border-editorial-emerald/25' :
                        cat.color === 'indigo' ? 'bg-editorial-indigo-light text-editorial-indigo border-editorial-indigo/25' :
                        cat.color === 'blue' ? 'bg-editorial-blue-light text-editorial-blue border-editorial-blue/25' :
                        'bg-editorial-violet-light text-editorial-violet border-editorial-violet/25'
                      ) : 'bg-editorial-dark/5 text-editorial-dark/50 border-editorial-dark/10';

                      return (
                        <motion.tr
                          key={ms.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-editorial-accent-light/20 transition-colors"
                        >
                          {/* Date column (jump to date) */}
                          <td className="px-6 py-4 text-editorial-dark/80 font-mono text-xs whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => onJumpToDate?.(item.date)}
                              className="flex items-center gap-1.5 hover:text-editorial-accent hover:underline cursor-pointer group text-left font-mono font-semibold"
                              title="Click to view this day's metrics and milestones on the Dashboard"
                            >
                              <Calendar size={13} className="text-editorial-accent group-hover:scale-110 transition-all duration-200" />
                              <span>{formatDateDisplay(item.date)}</span>
                            </button>
                          </td>

                          {/* Time */}
                          <td className="px-6 py-4 font-mono text-xs text-editorial-dark/70 font-semibold whitespace-nowrap">
                            {ms.time}
                          </td>

                          {/* Category */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 border rounded-none ${colorClasses}`}>
                              {cat ? cat.name : 'None'}
                            </span>
                          </td>

                          {/* Importance */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {ms.importance ? (
                              <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 border rounded-none ${
                                ms.importance === 'high'
                                  ? 'bg-editorial-rose-light text-editorial-rose border-editorial-rose/25'
                                  : ms.importance === 'medium'
                                  ? 'bg-editorial-orange-light text-editorial-orange border-editorial-orange/25'
                                  : 'bg-editorial-blue-light text-editorial-blue border-editorial-blue/25'
                              }`}>
                                {ms.importance}
                              </span>
                            ) : (
                              <span className="text-editorial-dark/30 text-xs italic font-sans">-</span>
                            )}
                          </td>

                          {/* Milestone Text & Notes */}
                          <td className="px-6 py-4">
                            <div className="space-y-0.5">
                              <p className="text-xs font-serif font-medium text-editorial-dark leading-relaxed break-words">
                                {ms.text}
                              </p>
                              {ms.notes && (
                                <p className="text-[10px] text-editorial-dark/50 italic flex items-start gap-1">
                                  <MessageSquare size={10} className="mt-0.5 shrink-0" />
                                  <span>{ms.notes}</span>
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Actions (Delete) */}
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('Are you sure you want to delete this milestone checkpoint?')) {
                                  onDeleteMilestone?.(item.date, ms.id);
                                }
                              }}
                              className="p-1.5 border border-red-200/40 text-red-500 hover:bg-red-50 hover:text-red-700 rounded-none transition-colors cursor-pointer"
                              title="Delete Milestone"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-16 text-center text-editorial-dark/50 space-y-3 bg-editorial-bg">
              <Flag size={28} className="text-editorial-accent/50 stroke-[1.5px]" />
              <p className="font-serif text-lg text-editorial-dark">No Milestones Match Filters</p>
              <p className="text-xs text-editorial-dark/60 max-w-xs leading-normal font-sans italic">
                Try adjusting your search query, choosing a different milestone category, or saving some milestones on the dashboard first.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
