/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Heart,
  Activity,
  Flame,
  Droplet,
  Clock,
  Brain,
  Smile,
  Coins,
  BookOpen,
  Sparkles,
  Coffee,
  Moon,
  Sun,
  Dumbbell,
  Apple,
  DollarSign,
  CheckSquare,
  Code,
  PenTool,
  Cloud,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  BarChart2,
  TrendingUp,
  Settings,
  X,
  PlusCircle,
  HelpCircle,
  Filter,
  Check,
  ChevronDown,
  Info,
  History,
  LayoutDashboard,
  Sliders,
  Sparkle,
  Search,
  Download,
  Upload,
  AlertCircle
} from 'lucide-react';

export const iconMap = {
  Heart,
  Activity,
  Flame,
  Droplet,
  Clock,
  Brain,
  Smile,
  Coins,
  BookOpen,
  Sparkles,
  Coffee,
  Moon,
  Sun,
  Dumbbell,
  Apple,
  DollarSign,
  CheckSquare,
  Code,
  PenTool,
  Cloud,
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  BarChart2,
  TrendingUp,
  Settings,
  X,
  PlusCircle,
  HelpCircle,
  Filter,
  Check,
  ChevronDown,
  Info,
  History,
  LayoutDashboard,
  Sliders,
  Sparkle,
  Search,
  Download,
  Upload,
  AlertCircle
};

export type IconName = keyof typeof iconMap;

interface LucideIconProps {
  name: string;
  className?: string;
  size?: number;
}

export function LucideIcon({ name, className = '', size = 20 }: LucideIconProps) {
  // Fallback to Sparkles if not found
  const IconComponent = iconMap[name as IconName] || Sparkles;
  return <IconComponent className={className} size={size} />;
}
