/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Tracker, CATEGORIES, COLOR_MAP, TrackerType, LogEntry } from '../types';
import { LucideIcon } from './LucideIcon';
import { Trash2, Edit2, X, Check, Calendar, Settings, FileSpreadsheet, Trophy, Target, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ManageTrackersProps {
  trackers: Tracker[];
  onDeleteTracker: (trackerId: string) => void;
  onUpdateTracker: (updatedTracker: Tracker) => void;
  logsCountMap: Record<string, number>;
  logs: LogEntry[];
}

const COLORS = ['emerald', 'blue', 'indigo', 'violet', 'amber', 'rose', 'orange'];
const AVAILABLE_ICONS = [
  'Droplet', 'Flame', 'Heart', 'BookOpen', 'Clock', 'Smile', 'Brain',
  'Coins', 'Dumbbell', 'Apple', 'DollarSign', 'CheckSquare', 'Code',
  'PenTool', 'Coffee', 'Moon', 'Sun', 'Cloud', 'Sparkles', 'Activity'
];

export function ManageTrackers({ trackers, onDeleteTracker, onUpdateTracker, logsCountMap, logs }: ManageTrackersProps) {
  const [editingTrackerId, setEditingTrackerId] = useState<string | null>(null);

  // Form states for active edit
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editTargetValue, setEditTargetValue] = useState<string>('');
  const [hasTarget, setHasTarget] = useState(false);
  const [editYearlyGoal, setEditYearlyGoal] = useState<string>('');
  const [hasYearlyGoal, setHasYearlyGoal] = useState(false);
  const [editTags, setEditTags] = useState('');

  // Yearly goals dashboard states
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [localYearlyGoals, setLocalYearlyGoals] = useState<Record<string, string>>({});

  const parsedEditTags = editTags
    .split(/[,\s]+/)
    .map(t => t.trim())
    .filter(Boolean)
    .map(t => t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`);

  const toggleEditTag = (tag: string) => {
    const isSelected = parsedEditTags.includes(tag);
    let newTags: string[];
    if (isSelected) {
      newTags = parsedEditTags.filter(t => t !== tag);
    } else {
      newTags = [...parsedEditTags, tag];
    }
    setEditTags(newTags.join(', '));
  };

  const startEdit = (tracker: Tracker) => {
    setEditingTrackerId(tracker.id);
    setEditName(tracker.name);
    setEditDescription(tracker.description || '');
    setEditCategory(tracker.category);
    setEditColor(tracker.color);
    setEditIcon(tracker.icon);
    setHasTarget(tracker.targetValue !== undefined);
    setEditTargetValue(tracker.targetValue ? tracker.targetValue.toString() : '');
    setHasYearlyGoal(tracker.yearlyGoal !== undefined);
    setEditYearlyGoal(tracker.yearlyGoal ? tracker.yearlyGoal.toString() : '');
    setEditTags(tracker.tags ? tracker.tags.join(', ') : '');
  };

  const cancelEdit = () => {
    setEditingTrackerId(null);
  };

  const saveEdit = (tracker: Tracker) => {
    if (!editName.trim()) return;

    const parsedTags = editTags
      .split(/[,\s]+/)
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => t.startsWith('#') ? t.toLowerCase() : `#${t.toLowerCase()}`);

    const updated: Tracker = {
      ...tracker,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      category: editCategory,
      color: editColor,
      icon: editIcon,
      targetValue: hasTarget && editTargetValue !== '' ? Number(editTargetValue) : undefined,
      yearlyGoal: hasYearlyGoal && editYearlyGoal !== '' ? Number(editYearlyGoal) : undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
    };

    onUpdateTracker(updated);
    setEditingTrackerId(null);
  };

  const availableYears = React.useMemo(() => {
    const years = new Set<number>([2026]);
    logs.forEach(log => {
      if (log.date) {
        const year = parseInt(log.date.split('-')[0]);
        if (!isNaN(year)) {
          years.add(year);
        }
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-serif font-medium text-lg text-editorial-dark flex items-center gap-2">
            <Settings size={18} className="text-editorial-accent" />
            Configured Trackers
          </h3>
          <p className="text-xs font-sans italic text-editorial-dark/60 mt-0.5">Edit or delete existing data configurations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <AnimatePresence initial={false}>
          {trackers.map((tracker) => {
            const isEditing = editingTrackerId === tracker.id;
            const colorStyles = COLOR_MAP[tracker.color] || COLOR_MAP.emerald;
            const logCount = logsCountMap[tracker.id] || 0;

            if (isEditing) {
              return (
                <motion.div
                  key={tracker.id}
                  layout
                  className="bg-editorial-bg rounded-none border border-editorial-accent/60 p-6 space-y-4"
                >
                  <div className="flex justify-between items-center border-b border-editorial-dark/10 pb-2">
                    <span className="text-xs font-mono font-medium uppercase tracking-wider text-editorial-accent">Editing Configuration</span>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="text-editorial-dark/40 hover:text-editorial-dark p-1 rounded-none"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Name field */}
                  <div>
                    <label className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1">Tracker Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full text-sm rounded-none border border-editorial-dark/20 bg-editorial-bg px-3 py-1.5 focus:border-editorial-accent font-sans outline-hidden"
                    />
                  </div>

                  {/* Description field */}
                  <div>
                    <label className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1">Description</label>
                    <textarea
                      rows={2}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full text-sm rounded-none border border-editorial-dark/20 bg-editorial-bg px-3 py-1.5 focus:border-editorial-accent font-sans outline-hidden resize-none"
                    />
                  </div>

                  {/* Tags field */}
                  <div>
                    <label className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1">Tags <span className="text-[9px] font-normal italic lowercase">(separated by commas or spaces, e.g. productivity, health)</span></label>
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="e.g. productivity, health"
                      className="w-full text-sm rounded-none border border-editorial-dark/20 bg-editorial-bg px-3 py-1.5 focus:border-editorial-accent font-sans outline-hidden mb-1.5"
                    />
                    <div className="flex flex-wrap gap-1">
                      {['#productivity', '#health', '#finance', '#wellness', '#mindset', '#fitness', '#learning', '#routine', '#creativity', '#social'].map((tag) => {
                        const isSelected = parsedEditTags.includes(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => toggleEditTag(tag)}
                            className={`text-[9px] font-mono font-bold px-2 py-0.5 transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-editorial-accent text-editorial-bg border border-editorial-accent'
                                : 'bg-editorial-dark/5 text-editorial-dark/60 border border-editorial-dark/10 hover:bg-editorial-accent-light/50 hover:text-editorial-accent'
                            }`}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Category field */}
                    <div>
                      <label className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1">Category</label>
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="w-full text-xs rounded-none border border-editorial-dark/20 bg-editorial-bg px-2 py-1.5 font-serif text-editorial-dark focus:border-editorial-accent outline-hidden"
                      >
                        {CATEGORIES.map(cat => (
                          <option key={cat.id} value={cat.id}>
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Goal field */}
                    <div>
                      <label className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1">Daily Goal</label>
                      {tracker.type !== 'rating' ? (
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setHasTarget(!hasTarget);
                              setEditTargetValue('');
                            }}
                            className={`px-2.5 py-1.5 border rounded-none text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                              hasTarget
                                ? 'bg-editorial-accent border-editorial-accent text-editorial-bg'
                                : 'bg-editorial-dark/5 border-editorial-dark/10 text-editorial-dark/50'
                            }`}
                          >
                            Daily
                          </button>
                          {hasTarget && (
                            <input
                              type="number"
                              value={editTargetValue}
                              placeholder="Qty"
                              onChange={(e) => setEditTargetValue(e.target.value)}
                              className="w-full px-2 py-1 border border-editorial-dark/20 bg-editorial-bg font-mono text-xs rounded-none"
                            />
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-mono text-editorial-dark/40 italic block mt-2">N/A for rating</span>
                      )}
                    </div>

                    {/* Yearly Goal field */}
                    <div>
                      <label className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1">Yearly Goal</label>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setHasYearlyGoal(!hasYearlyGoal);
                            setEditYearlyGoal('');
                          }}
                          className={`px-2.5 py-1.5 border rounded-none text-[10px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                            hasYearlyGoal
                              ? 'bg-editorial-accent border-editorial-accent text-editorial-bg'
                              : 'bg-editorial-dark/5 border-editorial-dark/10 text-editorial-dark/50'
                          }`}
                        >
                          Yearly
                        </button>
                        {hasYearlyGoal && (
                          <input
                            type="number"
                            value={editYearlyGoal}
                            placeholder={tracker.type === 'rating' ? 'e.g. 4.5' : 'e.g. 1000'}
                            step={tracker.type === 'rating' ? '0.1' : '1'}
                            onChange={(e) => setEditYearlyGoal(e.target.value)}
                            className="w-full px-2 py-1 border border-editorial-dark/20 bg-editorial-bg font-mono text-xs rounded-none"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Icon Selector */}
                  <div>
                    <label className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1">Change Icon</label>
                    <div className="flex gap-1 overflow-x-auto py-1.5 border border-editorial-dark/10 rounded-none p-1.5 bg-editorial-dark/5 max-h-16">
                      {AVAILABLE_ICONS.map((iName) => (
                        <button
                          key={iName}
                          type="button"
                          onClick={() => setEditIcon(iName)}
                          className={`p-1.5 rounded-none border shrink-0 bg-editorial-bg cursor-pointer ${
                            editIcon === iName
                              ? 'border-editorial-accent text-editorial-accent bg-editorial-accent-light'
                              : 'border-editorial-dark/15 text-editorial-dark/50 hover:bg-editorial-accent-light/30'
                          }`}
                        >
                          <LucideIcon name={iName} size={15} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Color Selector */}
                  <div>
                    <label className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1">Change Color</label>
                    <div className="flex gap-2.5">
                      {COLORS.map((col) => {
                        const style = COLOR_MAP[col];
                        return (
                          <button
                            key={col}
                            type="button"
                            onClick={() => setEditColor(col)}
                            className={`h-6 w-6 rounded-none ${style.bg} border border-editorial-dark/10 flex items-center justify-center cursor-pointer`}
                          >
                            {editColor === col && <Check className="text-white h-4 w-4 stroke-[3px]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex justify-end gap-2 border-t border-editorial-dark/10 pt-3">
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-4 py-2 border border-editorial-dark/20 rounded-none text-xs font-mono text-editorial-dark hover:bg-editorial-accent-light/40 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => saveEdit(tracker)}
                      className="px-4 py-2 bg-editorial-dark hover:bg-editorial-accent text-editorial-bg rounded-none text-xs font-mono cursor-pointer"
                    >
                      Save Changes
                    </button>
                  </div>
                </motion.div>
              );
            }

            return (
              <motion.div
                key={tracker.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-editorial-bg rounded-none border border-editorial-dark/15 p-5 flex flex-col justify-between hover:border-editorial-accent transition-colors"
              >
                <div>
                  {/* Top Header info */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-10 w-10 items-center justify-center rounded-none text-white ${colorStyles.bg} border border-editorial-dark/10`}>
                        <LucideIcon name={tracker.icon} size={18} />
                      </div>
                      <div>
                        <h4 className="font-serif font-medium text-lg text-editorial-dark leading-tight">{tracker.name}</h4>
                        <span className="inline-flex items-center text-[9px] font-mono text-editorial-dark/50 uppercase tracking-widest bg-editorial-dark/5 border border-editorial-dark/10 px-2 py-0.5 rounded-none mt-1">
                          {tracker.category} Category
                        </span>
                        {tracker.tags && tracker.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {tracker.tags.map(tag => (
                              <span key={tag} className="text-[8px] font-mono font-bold text-editorial-accent bg-editorial-accent-light/40 border border-editorial-accent/20 px-1 py-0.5 rounded-none lowercase">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <span className="text-[9px] font-mono uppercase tracking-wider text-editorial-dark bg-editorial-accent-light px-2 py-0.5 rounded-none border border-editorial-accent/20">
                      {tracker.type}
                    </span>
                  </div>

                  {/* Description */}
                  {tracker.description && (
                    <p className="text-xs text-editorial-dark/70 bg-editorial-accent-light/10 p-3 rounded-none border border-editorial-dark/5 italic mb-4 font-sans leading-relaxed">
                      "{tracker.description}"
                    </p>
                  )}

                  {/* Meta stats */}
                  <div className="grid grid-cols-2 gap-2 text-xs py-2 border-t border-editorial-dark/10 mt-2 mb-3">
                    <div>
                      <span className="block text-editorial-dark/40 text-[9px] uppercase font-mono tracking-widest">Total Logs Saved</span>
                      <span className="font-mono text-xs text-editorial-dark flex items-center gap-1.5 mt-1">
                        <FileSpreadsheet size={12} className="text-editorial-accent" />
                        {logCount} records
                      </span>
                    </div>
                    <div>
                      <span className="block text-editorial-dark/40 text-[9px] uppercase font-mono tracking-widest">Creation Date</span>
                      <span className="font-mono text-xs text-editorial-dark flex items-center gap-1.5 mt-1">
                        <Calendar size={12} className="text-editorial-accent" />
                        {new Date(tracker.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Edit / Delete actions footer */}
                <div className="flex justify-end gap-1.5 border-t border-editorial-dark/10 pt-3 mt-auto">
                  <button
                    type="button"
                    onClick={() => startEdit(tracker)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-none border border-editorial-dark/20 text-editorial-dark text-xs font-mono hover:bg-editorial-accent-light cursor-pointer"
                  >
                    <Edit2 size={12} />
                    Edit Design
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Warning: Deleting this tracker will permanently erase all ${logCount} saved log entries. Do you wish to continue?`)) {
                        onDeleteTracker(tracker.id);
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-none border border-red-200/40 text-red-500 text-xs font-mono hover:bg-red-50 hover:text-red-700 cursor-pointer"
                  >
                    <Trash2 size={12} />
                    Delete Tracker
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Yearly Goals Long-Term Section */}
      <div className="border-t border-editorial-dark/15 pt-8 mt-10 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-serif font-medium text-lg text-editorial-dark flex items-center gap-2">
              <Trophy size={18} className="text-editorial-amber" />
              Long-Term Yearly Goals
            </h3>
            <p className="text-xs font-sans italic text-editorial-dark/60 mt-0.5">
              Set annual targets and track your aggregate performance throughout the entire calendar year
            </p>
          </div>
          
          {/* Year selector */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="text-xs font-mono text-editorial-dark/50 uppercase">Active Year:</span>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-editorial-bg border border-editorial-dark/20 text-xs font-mono text-editorial-dark px-2.5 py-1.5 focus:border-editorial-accent outline-hidden cursor-pointer"
            >
              {availableYears.map(yr => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Unified Yearly Goals Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Column 1 & 2: Active Goals progress display */}
          <div className="lg:col-span-2 space-y-4">
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-editorial-dark/50 border-b border-editorial-dark/10 pb-1.5 flex items-center gap-1.5">
              <Target size={12} className="text-editorial-accent" />
              Active Yearly Goals & Progress ({selectedYear})
            </h4>
            
            {trackers.filter(t => t.yearlyGoal !== undefined).length === 0 ? (
              <div className="bg-editorial-dark/[0.01] border border-dashed border-editorial-dark/15 p-8 text-center">
                <Trophy size={28} className="text-editorial-dark/20 mx-auto mb-2.5" />
                <p className="text-xs font-serif italic text-editorial-dark/60">No yearly goals set yet for this year.</p>
                <p className="text-[10px] font-sans text-editorial-dark/40 mt-1 max-w-sm mx-auto">
                  Use the configurator on the right or edit your tracker design above to set long-term milestones.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {trackers
                  .filter(t => t.yearlyGoal !== undefined)
                  .map(tracker => {
                    const colorStyles = COLOR_MAP[tracker.color] || COLOR_MAP.emerald;
                    const yearLogs = logs.filter(log => log.trackerId === tracker.id && log.date.startsWith(`${selectedYear}-`));
                    
                    // Aggregate calculations
                    let currentVal = 0;
                    let displayLabel = '';
                    const goalVal = tracker.yearlyGoal || 1;

                    if (tracker.type === 'rating') {
                      const sum = yearLogs.reduce((acc, log) => acc + log.value, 0);
                      const count = yearLogs.length;
                      currentVal = count > 0 ? Number((sum / count).toFixed(2)) : 0;
                      displayLabel = `${currentVal} / ${goalVal} avg rating (${count} logs)`;
                    } else if (tracker.type === 'boolean') {
                      currentVal = yearLogs.reduce((acc, log) => acc + (log.value ? 1 : 0), 0);
                      displayLabel = `${currentVal} / ${goalVal} days completed`;
                    } else {
                      currentVal = yearLogs.reduce((acc, log) => acc + log.value, 0);
                      const unit = tracker.unit || 'units';
                      displayLabel = `${currentVal} / ${goalVal} ${unit}`;
                    }

                    const percentage = Math.min(100, Math.round((currentVal / goalVal) * 100)) || 0;
                    const isCompleted = currentVal >= goalVal;

                    return (
                      <div
                        key={tracker.id}
                        className="bg-editorial-bg border border-editorial-dark/15 hover:border-editorial-dark/30 transition-all p-4.5 space-y-3 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`flex h-8 w-8 items-center justify-center text-white ${colorStyles.bg} shrink-0`}>
                                <LucideIcon name={tracker.icon} size={15} />
                              </div>
                              <div className="min-w-0">
                                <h5 className="font-serif font-semibold text-sm text-editorial-dark truncate">{tracker.name}</h5>
                                <p className="text-[9px] font-mono text-editorial-dark/50 uppercase tracking-wider">{tracker.type} Tracker</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                              {isCompleted && (
                                <span className="flex items-center gap-1 text-[9px] font-mono font-bold uppercase tracking-wider bg-editorial-amber-light text-editorial-amber border border-editorial-amber/20 px-2 py-0.5 animate-pulse">
                                  <Trophy size={10} /> Completed
                                </span>
                              )}
                              <span className="text-xs font-mono font-bold text-editorial-dark">
                                {percentage}%
                              </span>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1">
                            <div className="w-full bg-editorial-dark/10 h-2.5 rounded-none overflow-hidden relative">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${percentage}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                className={`h-full ${colorStyles.bg}`}
                              />
                            </div>
                            <p className="text-[10px] font-mono text-editorial-dark/60 leading-tight">
                              {displayLabel}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end border-t border-editorial-dark/5 pt-2 mt-2">
                          <button
                            onClick={() => onUpdateTracker({ ...tracker, yearlyGoal: undefined })}
                            className="text-[10px] font-mono text-red-500 hover:text-red-700 hover:underline cursor-pointer transition-all"
                            title="Remove this yearly goal"
                          >
                            Remove Goal
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Column 3: Set/Configure goals form column */}
          <div className="space-y-4">
            <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-editorial-dark/50 border-b border-editorial-dark/10 pb-1.5 flex items-center gap-1.5">
              <Settings size={12} className="text-editorial-accent" />
              Configure Yearly Targets
            </h4>

            <div className="bg-editorial-dark/[0.02] border border-editorial-dark/10 p-4 space-y-4">
              <p className="text-[11px] font-sans text-editorial-dark/70 leading-relaxed italic">
                Set year-long targets for your key metrics below. Keep track of daily habits (boolean), target sums (numeric/counter), or subjective averages (rating).
              </p>

              <div className="space-y-3.5 max-h-[360px] overflow-y-auto pr-1">
                {trackers.map(tracker => {
                  const hasGoal = tracker.yearlyGoal !== undefined;
                  const inputVal = localYearlyGoals[tracker.id] ?? '';
                  const colorStyles = COLOR_MAP[tracker.color] || COLOR_MAP.emerald;

                  return (
                    <div key={tracker.id} className="border-b border-editorial-dark/5 pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`h-2.5 w-2.5 shrink-0 ${colorStyles.bg}`} />
                          <span className="font-serif font-medium text-xs text-editorial-dark truncate">{tracker.name}</span>
                        </div>
                        <span className="text-[8px] font-mono text-editorial-dark/40 uppercase tracking-widest">{tracker.type}</span>
                      </div>

                      {hasGoal ? (
                        <div className="flex items-center justify-between bg-editorial-bg border border-editorial-dark/10 px-2 py-1 text-[10px] font-mono text-editorial-dark/60">
                          <span>Target: <strong className="text-editorial-dark font-bold">{tracker.yearlyGoal}</strong> {tracker.type === 'rating' ? 'avg' : tracker.unit || 'units'}</span>
                          <button
                            onClick={() => onUpdateTracker({ ...tracker, yearlyGoal: undefined })}
                            className="text-[9px] text-red-500 hover:text-red-700 font-bold cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1.5">
                          <input
                            type="number"
                            placeholder={tracker.type === 'rating' ? 'e.g. 4.5 avg' : tracker.type === 'boolean' ? 'e.g. 150 days' : 'e.g. 500'}
                            step={tracker.type === 'rating' ? '0.1' : '1'}
                            value={inputVal}
                            onChange={(e) => setLocalYearlyGoals(prev => ({ ...prev, [tracker.id]: e.target.value }))}
                            className="flex-1 bg-editorial-bg border border-editorial-dark/20 text-xs font-mono px-2 py-1 outline-hidden focus:border-editorial-accent rounded-none h-8"
                          />
                          <button
                            type="button"
                            disabled={!inputVal}
                            onClick={() => {
                              const val = Number(inputVal);
                              if (!isNaN(val) && val > 0) {
                                onUpdateTracker({ ...tracker, yearlyGoal: val });
                                setLocalYearlyGoals(prev => {
                                  const next = { ...prev };
                                  delete next[tracker.id];
                                  return next;
                                });
                              }
                            }}
                            className={`px-3 py-1 text-[10px] font-mono uppercase font-bold tracking-wider rounded-none h-8 transition-colors ${
                              inputVal
                                ? 'bg-editorial-dark text-editorial-bg hover:bg-editorial-accent cursor-pointer'
                                : 'bg-editorial-dark/5 text-editorial-dark/30 border border-editorial-dark/10 cursor-not-allowed'
                            }`}
                          >
                            Set
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
