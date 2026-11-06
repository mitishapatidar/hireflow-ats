'use client';

import React from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  Send,
  Award,
  Building2,
  BarChart3,
  CheckSquare,
  UserCheck,
  GitPullRequest,
  TrendingUp,
  Settings,
  LineChart,
  User,
  Shield,
  HelpCircle,
  Bell,
  Search,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  LogOut,
  FolderKanban,
  FileText,
  LucideProps,
} from 'lucide-react';

export const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  LayoutDashboard,
  Users,
  Briefcase,
  Calendar,
  Send,
  Award,
  Building2,
  BarChart3,
  CheckSquare,
  UserCheck,
  GitPullRequest,
  TrendingUp,
  Settings,
  LineChart,
  User,
  Shield,
  HelpCircle,
  Bell,
  Search,
  Menu,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  LogOut,
  FolderKanban,
  FileText,
};

interface NavIconProps extends LucideProps {
  name: string;
}

export function NavIcon({ name, ...props }: NavIconProps) {
  const IconComponent = ICON_MAP[name] || FileText;
  return <IconComponent {...props} />;
}
