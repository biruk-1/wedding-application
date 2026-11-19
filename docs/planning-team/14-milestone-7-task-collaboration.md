# Planning Team — 14. Milestone 7: tasks and collaboration

Status: **implemented locally.** Applied to the local Supabase stack. Nothing deployed.

## 1. Database

`supabase/migrations/20261106140000_team_task_collaboration.sql`

| Piece | Behaviour |
| --- | --- |
| `set_task_assignees(task_id, user_ids)` | Requires `tasks.assign`; assignees must be wedding members; atomic delete+insert; sets `assigned_by` |
| `private.is_task_assignee` | Used by UPDATE RLS |
| `wedding_tasks` UPDATE policy | `tasks.update` **or** assignee |
| `wedding_tasks_assignee_column_guard` | Assignees without `tasks.update` may only change `status` (plus `completed_at` / `updated_at` side effects) |
| Task activity triggers | `task.created` / `updated` / `deleted`, `task.comment_added` / `comment_deleted`, plus assignees via RPC |
| Activity SELECT | Task rows with `required_permission = tasks.view` readable by anyone with `tasks.view` (detail history) |

Comment INSERT/DELETE policies from Milestone 5 already match the matrix (`tasks.comment` or assignee; author or owner delete).

## 2. Application

- `replaceAssignees` → `set_task_assignees` RPC
- Checklist tabs: **Assigned to me**; dashboard section **Your tasks**
- Status toggles allowed for `tasks.update` or current assignee
- Task detail: comment delete, activity feed, permission-scoped actions
- `TaskFilterBar` / `useWeddingChecklist` include `assigned_to_me`

## 3. Tests

| Suite | Result |
| --- | --- |
| `planning_team_tasks.sql` | PASS |
| Existing SQL suites | PASS |
| Vitest checklist helpers | PASS |

## 4. Still deferred

- Full multi-role integration pass (Milestone 9)
- Production apply — local only until explicitly approved

Planning Team management screens landed in Milestone 8 (doc 15).
