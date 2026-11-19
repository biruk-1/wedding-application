/** Task row plus the relations the checklist renders; shared with the integration tests. */
export const TASK_SELECT = `
  id, wedding_id, title, description, category_id, due_date, priority, status, sort_order,
  template_id, created_by, created_at, updated_at, completed_at, event_id, parent_task_id,
  category:task_categories ( id, slug, name_en, icon ),
  assignees:task_assignees (
    user_id,
    assigned_at,
    profile:profiles!task_assignees_user_id_fkey ( id, display_name )
  )
`;

