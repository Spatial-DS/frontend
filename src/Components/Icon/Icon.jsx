import React from 'react';
import {
  BookOpen,
  Calculator,
  LayoutGrid,
  Settings,
  Library,
  Target,
  Ruler,
  FileUp,
  UploadCloud,
  ListChecks,
  Map,
  AppWindow,
  Users,
  Monitor,
  Waypoints,
  DoorOpen,
  PersonStanding,
  Palette,
  Move,
  ArchiveRestore,
  Building,
  UserCog,
  Toilet,
  Baby,
  ArrowDownToDot,
  List,
  Trash2,
  GripVertical,
  ChevronRight,
  Plus,
  User,
  Lock,
  HelpCircle,
  AlertCircle,
  // --- NEW ADDITIONS ---
  Coffee,
  Footprints,
  Image,
  Briefcase,
  Package,
  UsersRound,
  Archive
} from 'lucide-react';

// Map string names to the actual components
const iconMap = {
  BookOpen,
  Calculator,
  LayoutGrid,
  Settings,
  Library,
  Target,
  Ruler,
  FileUp,
  UploadCloud,
  ListChecks,
  Map,
  AppWindow,
  Users,
  Monitor,
  Waypoints,
  DoorOpen,
  PersonStanding,
  Palette,
  Move,
  ArchiveRestore,
  Building,
  UserCog,
  Toilet,
  Baby,
  ArrowDownToDot,
  List,
  Trash2,
  GripVertical,
  ChevronRight,
  Plus,
  User,
  Lock,
  HelpCircle,
  AlertCircle,
  // --- NEW MAPPINGS ---
  Coffee,
  Footprints,
  Image,
  Briefcase,
  Package,
  UsersRound,
  Archive,
  default: AlertCircle
};

/**
 * Renders a Lucide icon based on a string name.
 * @param {object} props
 * @param {string} props.name - The name of the lucide icon.
 * @param {number} props.size - The size of the icon.
 * @param {string} props.className - Additional CSS classes.
 */
function Icon({ name, size = 20, className = '' }) {
  const LucideIcon = iconMap[name] || iconMap.default;
  return <LucideIcon size={size} className={className} />;
}

export default Icon;