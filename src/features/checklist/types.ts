import type { Database } from '@/types/database.types';

export type WeddingTask = Database['public']['Tables']['wedding_tasks']['Row'];
export type TaskCategory = Database['public']['Tables']['task_categories']['Row'];
export type ChecklistTemplate = Database['public']['Tables']['checklist_templates']['Row'];
export type TaskComment = Database['public']['Tables']['task_comments']['Row'];
export type TaskAssignee = Database['public']['Tables']['task_assignees']['Row'];

export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskWithRelations = WeddingTask & {
  category: Pick<TaskCategory, 'id' | 'slug' | 'name_en' | 'icon'> | null;
  assignees: {
    user_id: string;
    assigned_at: string;
    profile: { id: string; display_name: string } | null;
  }[];
};

export type StatusFilter = 'all' | 'todo' | 'in_progress' | 'done' | 'overdue';

export type CreateTaskInput = {
  weddingId: string;
  title: string;
  description?: string | null;
  categoryId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigneeIds?: string[];
};

export type UpdateTaskInput = {
  title?: string;
  description?: string | null;
  categoryId?: string | null;
  dueDate?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  assigneeIds?: string[];
};

export type ChecklistProgress = {
  total: number;
  completed: number;
  overdue: number;
  upcoming: number;
  percent: number;
};
