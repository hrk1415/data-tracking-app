/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tracker, TrackerType, CATEGORIES, COLOR_MAP } from '../types';
import { LucideIcon, iconMap } from './LucideIcon';
import { X, Check } from 'lucide-react';

interface AddTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (tracker: Tracker) => void;
}

const AVAILABLE_ICONS = [
  'Droplet', 'Flame', 'Heart', 'BookOpen', 'Clock', 'Smile', 'Brain',
  'Coins', 'Dumbbell', 'Apple', 'DollarSign', 'CheckSquare', 'Code',
  'PenTool', 'Coffee', 'Moon', 'Sun', 'Cloud', 'Sparkles', 'Activity'
];

const COLORS = ['emerald', 'blue', 'indigo', 'violet', 'amber', 'rose', 'orange'];

export function AddTrackerModal({ isOpen, onClose, onAdd }: AddTrackerModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('health');
  const [type, setType] = useState<TrackerType>('counter');
  const [unit, setUnit] = useState('');
  const [hasTarget, setHasTarget] = useState(false);
  const [targetValue, setTargetValue] = useState<number | ''>('');
  const [selectedColor, setSelectedColor] = useState('emerald');
  const [selectedIcon, setSelectedIcon] = useState('Heart');

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleTypeChange = (newType: TrackerType) => {
    setType(newType);
    if (newType === 'boolean') {
      setUnit('');
      setHasTarget(true);
      setTargetValue(1);
    } else if (newType === 'rating') {
      setUnit('');
      setHasTarget(false);
      setTargetValue('');
    } else {
      setHasTarget(false);
      setTargetValue('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Tracker name is required';
    }

    if (hasTarget && targetValue === '') {
      newErrors.targetValue = 'Goal value is required if daily goal is enabled';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newTracker: Tracker = {
      id: `tracker-${Date.now()}`,
      name: name.trim(),
      description: description.trim() || undefined,
      category,
      type,
      unit: (type === 'counter' || type === 'numeric') && unit.trim() ? unit.trim() : undefined,
      color: selectedColor,
      icon: selectedIcon,
      targetValue: hasTarget && targetValue !== '' ? Number(targetValue) : undefined,
      createdAt: new Date().toISOString(),
    };

    onAdd(newTracker);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('health');
    setType('counter');
    setUnit('');
    setHasTarget(false);
    setTargetValue('');
    setSelectedColor('emerald');
    setSelectedIcon('Heart');
    setErrors({});
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-editorial-dark/65 backdrop-blur-xs"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 15 }}
            transition={{ duration: 0.3 }}
            className="relative w-full max-w-lg overflow-hidden rounded-none bg-editorial-bg border border-editorial-dark/15 shadow-2xl flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-editorial-dark/15 px-6 py-4">
              <h3 className="font-serif font-medium text-lg text-editorial-dark flex items-center gap-2">
                <LucideIcon name="PlusCircle" className="text-editorial-accent" size={18} />
                Create New Tracker
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="rounded-none p-1 text-editorial-dark/40 hover:bg-editorial-accent-light/40 hover:text-editorial-dark transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Tracker Name */}
              <div>
                <label htmlFor="tracker-name" className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1.5">
                  Tracker Name *
                </label>
                <input
                  id="tracker-name"
                  type="text"
                  placeholder="e.g. Gym Session, Water, Caffeine"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (errors.name) {
                      setErrors(prev => {
                        const next = { ...prev };
                        delete next.name;
                        return next;
                      });
                    }
                  }}
                  className={`w-full rounded-none border px-4 py-2.5 text-sm bg-editorial-bg font-sans outline-hidden transition-all ${
                    errors.name
                      ? 'border-red-400 focus:border-red-600'
                      : 'border-editorial-dark/20 focus:border-editorial-accent'
                  }`}
                />
                {errors.name && (
                  <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1 font-sans italic">
                    <LucideIcon name="AlertCircle" size={11} /> {errors.name}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label htmlFor="tracker-desc" className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1.5">
                  Description <span className="text-editorial-dark/40 font-normal italic lowercase">(optional)</span>
                </label>
                <textarea
                  id="tracker-desc"
                  rows={2}
                  placeholder="What are you measuring and why?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-none border border-editorial-dark/20 bg-editorial-bg px-4 py-2 text-sm outline-hidden focus:border-editorial-accent transition-all resize-none font-sans"
                />
              </div>

              {/* Grid of Category and Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Category */}
                <div>
                  <label htmlFor="tracker-category" className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1.5">
                    Category
                  </label>
                  <select
                    id="tracker-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-none border border-editorial-dark/20 px-4 py-2.5 text-sm bg-editorial-bg font-serif text-editorial-dark focus:border-editorial-accent outline-hidden transition-all"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tracker Type */}
                <div>
                  <label htmlFor="tracker-type" className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1.5">
                    Log Metric Type
                  </label>
                  <select
                    id="tracker-type"
                    value={type}
                    onChange={(e) => handleTypeChange(e.target.value as TrackerType)}
                    className="w-full rounded-none border border-editorial-dark/20 px-4 py-2.5 text-sm bg-editorial-bg font-serif text-editorial-dark focus:border-editorial-accent outline-hidden transition-all"
                  >
                    <option value="counter">Counter (+ / - increments)</option>
                    <option value="numeric">Number (e.g., Weight, Sleep)</option>
                    <option value="boolean">Boolean (Done / Not Done)</option>
                    <option value="rating">Rating (Scale of 1 - 5 Stars)</option>
                  </select>
                </div>
              </div>

              {/* Conditional unit & target options */}
              {(type === 'counter' || type === 'numeric') && (
                <div className="grid grid-cols-2 gap-4 pt-1">
                  {/* Unit */}
                  <div>
                    <label htmlFor="tracker-unit" className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1.5">
                      Measurement Unit <span className="text-editorial-dark/40 font-normal italic lowercase">(ml, kg, hrs)</span>
                    </label>
                    <input
                      id="tracker-unit"
                      type="text"
                      placeholder="e.g. ml, hrs, steps"
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full rounded-none border border-editorial-dark/20 bg-editorial-bg px-4 py-2.5 text-sm font-sans outline-hidden focus:border-editorial-accent transition-all"
                    />
                  </div>

                  {/* Daily Goal Toggle / Value */}
                  <div>
                    <label className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-1.5">
                      Daily Goal
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setHasTarget(!hasTarget);
                          setTargetValue('');
                        }}
                        className={`px-3 py-2.5 rounded-none border text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                          hasTarget
                            ? 'bg-editorial-accent border-editorial-accent text-editorial-bg'
                            : 'bg-editorial-dark/5 border-editorial-dark/15 text-editorial-dark/40 hover:bg-editorial-accent-light/30'
                        }`}
                      >
                        {hasTarget ? 'Enabled' : 'Disabled'}
                      </button>
                      {hasTarget && (
                        <input
                          type="number"
                          placeholder="Goal qty"
                          value={targetValue}
                          onChange={(e) => {
                            setTargetValue(e.target.value === '' ? '' : Number(e.target.value));
                            if (errors.targetValue) {
                              setErrors(prev => {
                                const next = { ...prev };
                                delete next.targetValue;
                                return next;
                              });
                            }
                          }}
                          className={`w-full rounded-none border px-3 py-2 text-sm bg-editorial-bg font-mono outline-hidden focus:border-editorial-accent transition-all ${
                            errors.targetValue
                              ? 'border-red-400'
                              : 'border-editorial-dark/20'
                          }`}
                        />
                      )}
                    </div>
                    {errors.targetValue && (
                      <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1 font-sans italic">
                        <LucideIcon name="AlertCircle" size={11} /> Goal value required
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Choose Theme Color */}
              <div>
                <span className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-2">
                  Theme Accent Color
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {COLORS.map((col) => {
                    const mapped = COLOR_MAP[col];
                    const bgClass = mapped ? mapped.bg : 'bg-gray-500';
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setSelectedColor(col)}
                        className={`group relative h-8 w-8 rounded-none ${bgClass} border border-editorial-dark/15 transition-all transform hover:scale-105 flex items-center justify-center cursor-pointer`}
                      >
                        {selectedColor === col && (
                          <Check className="text-white h-4 w-4 stroke-[3px]" />
                        )}
                        <span className="sr-only">{col}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Icon Selector Grid */}
              <div>
                <span className="block text-[10px] font-mono font-medium text-editorial-dark/60 uppercase tracking-widest mb-2">
                  Representing Icon
                </span>
                <div className="grid grid-cols-5 sm:grid-cols-7 gap-2 p-3 rounded-none border border-editorial-dark/10 bg-editorial-dark/5 max-h-40 overflow-y-auto">
                  {AVAILABLE_ICONS.map((iconName) => (
                    <button
                      key={iconName}
                      type="button"
                      onClick={() => setSelectedIcon(iconName)}
                      className={`flex aspect-square flex-col items-center justify-center rounded-none border p-1 transition-all cursor-pointer bg-editorial-bg ${
                        selectedIcon === iconName
                          ? 'border-editorial-accent text-editorial-accent bg-editorial-accent-light'
                          : 'border-editorial-dark/10 hover:bg-editorial-accent-light/30 text-editorial-dark/60'
                      }`}
                    >
                      <LucideIcon name={iconName} size={18} />
                    </button>
                  ))}
                </div>
              </div>
            </form>

            {/* Footer Actions */}
            <div className="border-t border-editorial-dark/15 px-6 py-4 bg-editorial-accent-light/40 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-none border border-editorial-dark/20 bg-editorial-bg px-4 py-2.5 text-xs font-mono uppercase tracking-wider text-editorial-dark hover:bg-editorial-accent-light/40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="rounded-none bg-editorial-dark px-5 py-2.5 text-xs font-mono uppercase tracking-wider text-editorial-bg hover:bg-editorial-accent transition-colors cursor-pointer"
              >
                Add Tracker
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
