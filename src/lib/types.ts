import type { TeamRole } from './capabilities';

export type GlobalRole = 'super_admin' | 'user';
export type TaskStatus = 'OPEN' | 'IN_PROGRESS' | 'BLOCKED' | 'IN_REVIEW' | 'DONE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  global_role: GlobalRole;
  status: string;
}

export interface Team {
  id: string;
  team_key: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  created_by: string | null;
  created_at: string;
}

export interface Membership {
  id: string;
  team_id: string;
  user_id: string;
  team_role: TeamRole;
  permissions: string[];
  status: 'active' | 'invited' | 'removed';
  joined_at: string;
}

export interface Task {
  id: string;
  team_id: string;
  seq: number;
  tag: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  progress: number;
  assignee_id: string | null;
  labels: string[];
  due_date: string | null;
  remarks: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sheet_url: string | null;
}

export interface Comment {
  id: string;
  task_id: string;
  team_id: string;
  author_id: string | null;
  body: string;
  created_at: string;
}

export interface College {
  id: string;
  team_id: string;
  name: string;
  city: string | null;
  caretaker_name: string | null;
  caretaker_email: string | null;
  caretaker_phone: string | null;
  designation: string | null;
  employee_id: string | null;
  status: 'active' | 'on_hold' | 'closed';
  notes: string | null;
  sheet_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CollegePerson {
  id: string;
  college_id: string;
  name: string;
  employee_id: string | null;
  mobile: string | null;
  email: string | null;
  designation: string | null;
  created_at: string;
}

export const COLLEGE_STATUS_META: Record<College['status'], { label: string; color: string }> = {
  active: { label: 'Active', color: 'hsl(152 58% 42%)' },
  on_hold: { label: 'On hold', color: 'hsl(36 92% 48%)' },
  closed: { label: 'Closed', color: 'hsl(240 8% 55%)' }
};

export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body: string | null;
  task_id: string | null;
  team_id: string | null;
  is_read: boolean;
  created_at: string;
}

export const STATUS_META: Record<TaskStatus, { label: string; color: string; dot: string }> = {
  OPEN: { label: 'Open', color: 'hsl(220 14% 50%)', dot: '#8b93a7' },
  IN_PROGRESS: { label: 'In Progress', color: 'hsl(250 84% 60%)', dot: '#6d5cf0' },
  BLOCKED: { label: 'Blocked', color: 'hsl(358 70% 55%)', dot: '#e0475a' },
  IN_REVIEW: { label: 'In Review', color: 'hsl(36 92% 48%)', dot: '#ef9d16' },
  DONE: { label: 'Done', color: 'hsl(152 58% 40%)', dot: '#2fa06a' },
  CANCELLED: { label: 'Cancelled', color: 'hsl(240 8% 55%)', dot: '#8a8a99' }
};

export const PRIORITY_META: Record<TaskPriority, { label: string; color: string }> = {
  LOW: { label: 'Low', color: 'hsl(220 12% 55%)' },
  MEDIUM: { label: 'Medium', color: 'hsl(210 80% 55%)' },
  HIGH: { label: 'High', color: 'hsl(30 90% 52%)' },
  URGENT: { label: 'Urgent', color: 'hsl(358 75% 56%)' }
};

export const BOARD_COLUMNS: TaskStatus[] = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE'];
