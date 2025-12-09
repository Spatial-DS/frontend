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
  Coffee,
  Footprints,
  Image,
  Briefcase,
  Package,
  UsersRound,
  Archive,
  Eye,
  EyeClosed // Import EyeClosed here
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
  Coffee,
  Footprints,
  Image,
  Briefcase,
  Package,
  UsersRound,
  Archive,
  Eye,
  EyeClosed, // Add to map
  default: AlertCircle
};

/**
 * Renders a Lucide icon based on a string name.
 * @param {object} props
 * @param {string} props.name - The name of the lucide icon.
 * @param {number} props.size - The size of the icon.
 * @param {string} props.className - Additional CSS classes.
 * @param {object} props.style - Inline styles.
 */
function Icon({ name, size = 20, className = '', style={} }) {
  const LucideIcon = iconMap[name] || iconMap.default;
  return <LucideIcon size={size} className={className} style={style} />;
}

export default Icon;