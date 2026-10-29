import { supabase } from '@/lib/supabase';
import { mapChecklistError, type ChecklistUserMessage } from '@/features/checklist/services/checklistErrors';
import type {
  ChecklistTemplate,
  CreateTaskInput,
  TaskCategory,
  TaskComment,
  TaskWithRelations,
  UpdateTaskInput,
  WeddingTask,
} from '@/features/checklist/types';
import type { Database } from '@/types/database.types';

export type ChecklistResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ChecklistUserMessage };

function fail(error: { message?: string; code?: string } | Error | null): ChecklistResult<never> {
  return { ok: false, error: mapChecklistError(error) };
}

const TASK_SELECT = `
  *,
  category:task_categories ( id, slug, name_en, icon ),
  assignees:task_assignees (
    user_id,
    assigned_at,
    profile:profiles ( id, display_name )
  )
`;

function normalizeTask(row: Record<string, unknown>): TaskWithRelations {
  const category = row.category as TaskWithRelations['category'] | TaskWithRelations['category'][] | null;
  const assigneesRaw = (row.assignees ?? []) as {
    user_id: string;
    assigned_at: string;
    profile: { id: string; display_name: string } | { id: string; display_name: string }[] | null;
  }[];

  return {
    ...(row as unknown as WeddingTask),
    category: Array.isArray(category) ? category[0] ?? null : category,
    assignees: assigneesRaw.map((item) => ({
      user_id: item.user_id,
      assigned_at: item.assigned_at,
      profile: Array.isArray(item.profile) ? item.profile[0] ?? null : item.profile,
    })),
  };
}

export async function listTaskCategories(): Promise<ChecklistResult<TaskCategory[]>> {
  const { data, error } = await supabase
    .from('task_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) return fail(error);
  return { ok: true, data: data ?? [] };
}

export async function listWeddingTasks(weddingId: string): Promise<ChecklistResult<TaskWithRelations[]>> {
  const { data, error } = await supabase
    .from('wedding_tasks')
    .select(TASK_SELECT)
    .eq('wedding_id', weddingId)
    .order('sort_order', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false });

  if (error) return fail(error);
  return { ok: true, data: (data ?? []).map((row) => normalizeTask(row as Record<string, unknown>)) };
}

export async function getWeddingTask(taskId: string): Promise<ChecklistResult<TaskWithRelations>> {
  const { data, error } = await supabase
    .from('wedding_tasks')
    .select(TASK_SELECT)
    .eq('id', taskId)
    .maybeSingle();
  if (error) return fail(error);
  if (!data) {
    return { ok: false, error: { code: 'not_found', message: 'Task not found or unavailable.' } };
  }
  return { ok: true, data: normalizeTask(data as Record<string, unknown>) };
}

async function replaceAssignees(taskId: string, assigneeIds: string[]): Promise<ChecklistResult<true>> {
  const { error: deleteError } = await supabase.from('task_assignees').delete().eq('task_id', taskId);
  if (deleteError) return fail(deleteError);

  const unique = [...new Set(assigneeIds)];
  if (unique.length === 0) return { ok: true, data: true };

  const { error: insertError } = await supabase.from('task_assignees').insert(
    unique.map((user_id) => ({ task_id: taskId, user_id })),
  );
  if (insertError) return fail(insertError);
  return { ok: true, data: true };
}

export async function createTask(input: CreateTaskInput): Promise<ChecklistResult<TaskWithRelations>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('wedding_tasks')
    .insert({
      wedding_id: input.weddingId,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      category_id: input.categoryId ?? null,
      due_date: input.dueDate ?? null,
      priority: input.priority ?? 'medium',
      status: input.status ?? 'todo',
      created_by: user?.id ?? null,
    })
    .select('id')
    .single();

  if (error) return fail(error);

  if (input.assigneeIds && input.assigneeIds.length > 0) {
    const assigned = await replaceAssignees(data.id, input.assigneeIds);
    if (!assigned.ok) return assigned;
  }

  return getWeddingTask(data.id);
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput,
): Promise<ChecklistResult<TaskWithRelations>> {
  const patch: Database['public']['Tables']['wedding_tasks']['Update'] = {};
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.description !== undefined) patch.description = input.description?.trim() || null;
  if (input.categoryId !== undefined) patch.category_id = input.categoryId;
  if (input.dueDate !== undefined) patch.due_date = input.dueDate;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.status !== undefined) patch.status = input.status;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('wedding_tasks').update(patch).eq('id', taskId);
    if (error) return fail(error);
  }

  if (input.assigneeIds !== undefined) {
    const assigned = await replaceAssignees(taskId, input.assigneeIds);
    if (!assigned.ok) return assigned;
  }

  return getWeddingTask(taskId);
}

export async function setTaskStatus(
  taskId: string,
  status: WeddingTask['status'],
): Promise<ChecklistResult<TaskWithRelations>> {
  return updateTask(taskId, { status: status as UpdateTaskInput['status'] });
}

export async function deleteTask(taskId: string): Promise<ChecklistResult<true>> {
  const { error } = await supabase.from('wedding_tasks').delete().eq('id', taskId);
  if (error) return fail(error);
  return { ok: true, data: true };
}

export async function listChecklistTemplates(): Promise<ChecklistResult<ChecklistTemplate[]>> {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error) return fail(error);
  return { ok: true, data: data ?? [] };
}

/**
 * Seeds tasks from active templates that are not already present (by template_id).
 * No dedicated RPC exists; inserts rely on wedding_tasks RLS (can_write_wedding).
 */
export async function initializeChecklistFromTemplates(
  weddingId: string,
  weddingDate: string | null,
): Promise<ChecklistResult<{ inserted: number; skipped: number }>> {
  const templatesResult = await listChecklistTemplates();
  if (!templatesResult.ok) return templatesResult;

  const { data: existing, error: existingError } = await supabase
    .from('wedding_tasks')
    .select('template_id')
    .eq('wedding_id', weddingId)
    .not('template_id', 'is', null);

  if (existingError) return fail(existingError);

  const used = new Set((existing ?? []).map((row) => row.template_id).filter(Boolean) as string[]);
  const toInsert = templatesResult.data.filter((template) => !used.has(template.id));

  if (toInsert.length === 0) {
    return { ok: true, data: { inserted: 0, skipped: templatesResult.data.length } };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rows = toInsert.map((template, index) => {
    let dueDate: string | null = null;
    if (weddingDate && template.suggested_days_before != null) {
      const [y, m, d] = weddingDate.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() - template.suggested_days_before);
      dueDate = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, '0'),
        String(date.getDate()).padStart(2, '0'),
      ].join('-');
    }

    return {
      wedding_id: weddingId,
      category_id: template.category_id,
      template_id: template.id,
      title: template.title_en,
      description: template.description_en,
      due_date: dueDate,
      status: 'todo' as const,
      priority: 'medium' as const,
      sort_order: template.sort_order + index,
      created_by: user?.id ?? null,
    };
  });

  const { error } = await supabase.from('wedding_tasks').insert(rows);
  if (error) return fail(error);

  return {
    ok: true,
    data: {
      inserted: toInsert.length,
      skipped: templatesResult.data.length - toInsert.length,
    },
  };
}

export async function listWeddingMembersForAssign(weddingId: string): Promise<
  ChecklistResult<{ user_id: string; role: string; display_name: string }[]>
> {
  const { data, error } = await supabase
    .from('wedding_members')
    .select('user_id, role, profile:profiles ( display_name )')
    .eq('wedding_id', weddingId);

  if (error) return fail(error);

  const members = (data ?? []).map((row) => {
    const profile = row.profile as { display_name: string } | { display_name: string }[] | null;
    const resolved = Array.isArray(profile) ? profile[0] : profile;
    return {
      user_id: row.user_id,
      role: row.role,
      display_name: resolved?.display_name?.trim() || 'Member',
    };
  });

  return { ok: true, data: members };
}

export async function listTaskComments(taskId: string): Promise<
  ChecklistResult<(TaskComment & { author: { display_name: string } | null })[]>
> {
  const { data, error } = await supabase
    .from('task_comments')
    .select('*, author:profiles ( display_name )')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });

  if (error) return fail(error);

  const comments = (data ?? []).map((row) => {
    const author = row.author as { display_name: string } | { display_name: string }[] | null;
    return {
      ...(row as unknown as TaskComment),
      author: Array.isArray(author) ? author[0] ?? null : author,
    };
  });

  return { ok: true, data: comments };
}

export async function addTaskComment(
  taskId: string,
  body: string,
): Promise<ChecklistResult<TaskComment>> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return fail(new Error('authentication required'));
  }

  const { data, error } = await supabase
    .from('task_comments')
    .insert({
      task_id: taskId,
      author_id: user.id,
      body: body.trim(),
    })
    .select('*')
    .single();

  if (error) return fail(error);
  return { ok: true, data };
}
