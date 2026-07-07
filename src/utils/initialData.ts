/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Tracker, LogEntry } from '../types';

export function getInitialTrackers(): Tracker[] {
  return [
    {
      id: 'water-tracker',
      name: 'Water Intake',
      category: 'health',
      type: 'counter',
      unit: 'ml',
      color: 'blue',
      icon: 'Droplet',
      targetValue: 2000,
      description: 'Keep hydrated throughout the day. Target is 2 Liters (2000 ml).',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'steps-tracker',
      name: 'Daily Steps',
      category: 'fitness',
      type: 'numeric',
      unit: 'steps',
      color: 'emerald',
      icon: 'Flame',
      targetValue: 10000,
      description: 'Track daily walking. Goal of 10,000 steps for physical health.',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'focus-tracker',
      name: 'Focus Work',
      category: 'productivity',
      type: 'numeric',
      unit: 'hrs',
      color: 'indigo',
      icon: 'Clock',
      targetValue: 6,
      description: 'Deep work and study hours free from distractions.',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'mood-tracker',
      name: 'Daily Mood',
      category: 'mind',
      type: 'rating',
      color: 'violet',
      icon: 'Smile',
      description: 'Rate your overall happiness and mental state from 1 (low) to 5 (high).',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'reading-tracker',
      name: 'Read 20+ Mins',
      category: 'productivity',
      type: 'boolean',
      color: 'amber',
      icon: 'BookOpen',
      targetValue: 1,
      description: 'Read a book, article, or publication for at least 20 minutes.',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

export function getInitialLogs(): LogEntry[] {
  const trackers = getInitialTrackers();
  const logs: LogEntry[] = [];
  const now = new Date();

  // Generate logs for the last 12 days (excluding today, which the user can log themselves)
  for (let i = 12; i >= 1; i--) {
    const logDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = logDate.toISOString().split('T')[0];

    trackers.forEach(tracker => {
      let value = 0;
      let note = '';

      if (tracker.id === 'water-tracker') {
        // Random water intake between 1000ml and 2500ml in increments of 250ml
        const increments = [1000, 1250, 1500, 1750, 2000, 2250, 2500];
        value = increments[Math.floor(Math.sin(i) * 3 + 3) % increments.length];
        if (value >= 2000) note = 'Met water target!';
      } else if (tracker.id === 'steps-tracker') {
        // Step tracker between 5000 and 12500 steps
        value = Math.floor(7500 + Math.sin(i * 1.5) * 3500 + Math.cos(i) * 1000);
        if (value > 10000) note = 'Awesome walk today!';
      } else if (tracker.id === 'focus-tracker') {
        // Focus hours between 2.5 and 8 hours
        value = Math.round((5 + Math.sin(i * 2) * 2.5 + Math.random() * 0.5) * 10) / 10;
        if (value > 6) note = 'Super productive session!';
      } else if (tracker.id === 'mood-tracker') {
        // Mood ratings from 3 to 5
        const moodOptions = [3, 4, 4, 5, 4, 3, 5];
        value = moodOptions[Math.floor(Math.abs(Math.sin(i * 3)) * moodOptions.length) % moodOptions.length];
        if (value === 5) note = 'Felt fantastic!';
      } else if (tracker.id === 'reading-tracker') {
        // Boolean: 1 (true) or 0 (false)
        value = (Math.cos(i) + 0.2) > 0 ? 1 : 0;
        if (value === 1) note = 'Read chapters of Atomic Habits';
      }

      logs.push({
        id: `${tracker.id}-${dateStr}`,
        trackerId: tracker.id,
        value,
        date: dateStr,
        note: note || undefined,
        timestamp: new Date(logDate.getTime() + 12 * 60 * 60 * 1000).toISOString(), // Mid-day
      });
    });
  }

  return logs;
}
