/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Tracker, CATEGORIES, COLOR_MAP, TrackerType } from '../types';
import { LucideIcon } from './LucideIcon';
import { Trash2, Edit2, X, Check, Calendar, Settings, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ManageTrackersProps {
  trackers: Tracker[];
  onDeleteTracker: (trackerId: string) => void;
  onUpdateTracker: (updatedTracker: Tracker) => void;
  logsCountMap: Record<string, number>;
}

const COLORS = ['emerald', 'blue', 'indigo', 'violet', 'amber', 'rose', 'orange'];
const AVAILABLE_ICONS = [
  'Droplet', 'Flame', 'Heart', 'BookOpen', 'Clock', 'Smile', 'Brain',
  'Coins', 'Dumbbell', 'Apple', 'DollarSign', 'CheckSquare', 'Code',
  'PenTool', 'Coffee', 'Moon', 'Sun', 'Cloud', 'Sparkles', 'Activity'
];

export function ManageTrackers({ trackers, onDeleteTracker, onUpdateTracker, logsCountMap }: ManageTrackersProps) {
  const [editingTrackerId, setEditingTrackerId] = useState<string | null>(null);

  // Form states for active edit
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editColor, setEditColor] = useState('');
  const [editIcon, setEditIcon] = useState('');
  const [editTargetValue, setEditTargetValue] = useState<string>('');
  const [hasTarget, setHasTarget] = useState(false);

  const startEdit = (tracker: Tracker) => {
    setEditingTrackerId(tracker.id);
    setEditName(tracker.name);
    setEditDescription(tracker.description || '');
    setEditCategory(tracker.category);
    setEditColor(tracker.color);
    setEditIcon(tracker.icon);
    setHasTarget(tracker.targetValue !== undefined);
    setEditTargetValue(tracker.targetValue ? tracker.targetValue.toString() : '');
  };

  const cancelEdit = () => {
    setEditingTrackerId(null);
  };

  const saveEdit = (tracker: Tracker) => {
    if (!editName.trim()) return;

    const updated: Tracker = {
      ...tracker,
      name: editName.trim(),
      description: editDescription.trim() || undefined,
      category: editCategory,
      color: editColor,
      icon: editIcon,
      targetValue: hasTarget && editTargetValue !== '' ? Number(editTargetValue) : undefined,
    };

    onUpdateTracker(updated);
    setEditingTrackerId(null);
  };

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

                  <div className="grid grid-cols-2 gap-3">
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
                    {tracker.type !== 'rating' && (
                      <div>
                        <label className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1">Goal Settings</label>
                        <div className="flex gap-1.5">
                          <button
                            type="button; button"
                            onClick={() => {
                              setHasTarget(!hasTarget);
                              setEditTargetValue('');
                            }}
                            className={`px-3 py-1.5 border rounded-none text-[11px] font-mono uppercase tracking-wider transition-all cursor-pointer ${
                              hasTarget
                                ? 'bg-editorial-accent border-editorial-accent text-editorial-bg'
                                : 'bg-editorial-dark/5 border-editorial-dark/10 text-editorial-dark/50'
                            }`}
                          >
                            Goal
                          </button>
                          {hasTarget && (
                            <input
                              type="number"
                              value={editTargetValue}
                              placeholder="Qty"
                              onChange={(e) => setEditTargetValue(e.target.value)}
                              className="w-16 px-2 py-1 border border-editorial-dark/20 bg-editorial-bg font-mono text-xs rounded-none"
                            />
                          )}
                        </div>
                      </div>
                    )}
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
    </div>
  );
}
