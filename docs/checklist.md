# Wedding checklist (Task 6)

Scoped to a selected wedding under `/(app)/weddings/[weddingId]/checklist`.

## Features

- Progress (completed / total, overdue, upcoming)
- Filters: All, To do, In progress, Completed, Overdue + category chips + search
- Create / edit tasks (title, description, category, due date, priority, status, assignees)
- Complete / reopen (optimistic UI with rollback)
- Task details, delete confirmation, comments
- Starter checklist from `checklist_templates` seed (skips templates already linked via `template_id`)

## Database

| Table | Usage |
| --- | --- |
| `wedding_tasks` | CRUD via RLS (`is_wedding_member` / `can_write_wedding`) |
| `task_categories` | Active lookup filter chips |
| `checklist_templates` | Optional starter seed |
| `task_assignees` | Member assignment (must be wedding members) |
| `task_comments` | Writer comments (`author_id = auth.uid()`) |

`completed_at` is maintained by trigger `wedding_tasks_sync_completed_at`.

Viewers can read tasks; only `owner|partner|planner|collaborator` can write.

No dedicated `initialize_checklist` RPC exists. Initialization inserts tasks client-side under RLS and skips duplicate `template_id`s for that wedding.

## Deferred

- Parent/sub-tasks UI (`parent_task_id`)
- Event linking (`event_id`)
- Atomic multi-row template RPC (nice-to-have; not required by current migrations)
