/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TrackerType = 'counter' | 'numeric' | 'boolean' | 'rating';

export interface Tracker {
  id: string;
  name: string;
  category: string;
  type: TrackerType;
  unit?: string;
  color: string; // e.g., 'emerald', 'blue', 'indigo', 'violet', 'amber', 'rose', 'orange'
  icon: string; // Name of Lucide icon
  targetValue?: number; // Optional daily goal/target
  description?: string;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  trackerId: string;
  value: number; // For counter/numeric/rating, or 1/0 for boolean
  date: string; // YYYY-MM-DD
  note?: string;
  timestamp: string;
}

export interface TrackerCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export const CATEGORIES: TrackerCategory[] = [
  { id: 'health', name: 'Health & Wellness', color: 'emerald', icon: 'Heart' },
  { id: 'fitness', name: 'Fitness & Sport', color: 'blue', icon: 'Flame' },
  { id: 'productivity', name: 'Productivity & Work', color: 'indigo', icon: 'Briefcase' },
  { id: 'mind', name: 'Mind & Mood', color: 'violet', icon: 'Brain' },
  { id: 'finance', name: 'Finance & Saving', color: 'amber', icon: 'Coins' },
  { id: 'custom', name: 'Custom & Other', color: 'rose', icon: 'Sparkles' },
];

export const COLOR_MAP: Record<string, { bg: string; text: string; border: string; accent: string; lightBg: string }> = {
  emerald: {
    bg: 'bg-editorial-emerald',
    text: 'text-editorial-emerald',
    border: 'border-editorial-emerald/30',
    accent: 'bg-editorial-emerald-light hover:bg-editorial-emerald-light/80 text-editorial-emerald',
    lightBg: 'bg-editorial-emerald-light/50',
  },
  blue: {
    bg: 'bg-editorial-blue',
    text: 'text-editorial-blue',
    border: 'border-editorial-blue/30',
    accent: 'bg-editorial-blue-light hover:bg-editorial-blue-light/80 text-editorial-blue',
    lightBg: 'bg-editorial-blue-light/50',
  },
  indigo: {
    bg: 'bg-editorial-indigo',
    text: 'text-editorial-indigo',
    border: 'border-editorial-indigo/30',
    accent: 'bg-editorial-indigo-light hover:bg-editorial-indigo-light/80 text-editorial-indigo',
    lightBg: 'bg-editorial-indigo-light/50',
  },
  violet: {
    bg: 'bg-editorial-violet',
    text: 'text-editorial-violet',
    border: 'border-editorial-violet/30',
    accent: 'bg-editorial-violet-light hover:bg-editorial-violet-light/80 text-editorial-violet',
    lightBg: 'bg-editorial-violet-light/50',
  },
  amber: {
    bg: 'bg-editorial-amber',
    text: 'text-editorial-amber',
    border: 'border-editorial-amber/30',
    accent: 'bg-editorial-amber-light hover:bg-editorial-amber-light/80 text-editorial-amber',
    lightBg: 'bg-editorial-amber-light/50',
  },
  rose: {
    bg: 'bg-editorial-rose',
    text: 'text-editorial-rose',
    border: 'border-editorial-rose/30',
    accent: 'bg-editorial-rose-light hover:bg-editorial-rose-light/80 text-editorial-rose',
    lightBg: 'bg-editorial-rose-light/50',
  },
  orange: {
    bg: 'bg-editorial-orange',
    text: 'text-editorial-orange',
    border: 'border-editorial-orange/30',
    accent: 'bg-editorial-orange-light hover:bg-editorial-orange-light/80 text-editorial-orange',
    lightBg: 'bg-editorial-orange-light/50',
  },
};

export interface Milestone {
  id: string;
  time: string; // HH:MM
  text: string;
}

export interface DailyReflection {
  date: string; // YYYY-MM-DD
  text: string;
  updatedAt?: string;
  milestones?: Milestone[];
  showMilestonesOnDashboard?: boolean;
}

