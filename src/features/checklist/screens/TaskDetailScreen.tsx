import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { TaskDetailSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import { useAuth } from '@/features/auth/hooks/useAuth';
import {
  addTaskComment,
  deleteTask,
  deleteTaskComment,
  getWeddingTask,
  listTaskActivity,
  listTaskComments,
  setTaskStatus,
  type TaskActivityItem,
} from '@/features/checklist/services/checklistService';
import type { TaskWithRelations } from '@/features/checklist/types';
import { commentSchema } from '@/features/checklist/validation/taskSchemas';
import { isTaskOverdue, statusLabel } from '@/features/checklist/utils/taskHelpers';
import { useWeddingAccess } from '@/features/team/queries';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useThemedStyles } from '@/theme/useThemedStyles';

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: { display_name: string } | null;
};

function activityLabel(item: TaskActivityItem): string {
  switch (item.action) {
    case 'task.created':
      return 'created this task';
    case 'task.updated':
      return 'updated this task';
    case 'task.assignees_set':
      return 'changed assignees';
    case 'task.comment_added':
      return 'added a comment';
    case 'task.comment_deleted':
      return 'removed a comment';
    case 'task.deleted':
      return 'deleted this task';
    default:
      return item.action;
  }
}

export function TaskDetailScreen() {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { user } = useAuth();
  const { weddingId, taskId } = useLocalSearchParams<{ weddingId: string; taskId: string }>();
  const { can, isOwner, isLoading: roleLoading } = useWeddingAccess(weddingId);
  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [activity, setActivity] = useState<TaskActivityItem[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const isAssignee = useMemo(
    () => Boolean(user?.id && task?.assignees.some((a) => a.user_id === user.id)),
    [task, user],
  );
  const canToggleStatus = can('tasks.update') || isAssignee;
  const canComment = can('tasks.comment') || isAssignee;
  const canEdit = can('tasks.update');
  const canDelete = can('tasks.delete');

  useEffect(() => {
    if (!taskId || !weddingId) return;

    let cancelled = false;

    void (async () => {
      const [taskResult, commentsResult, activityResult] = await Promise.all([
        getWeddingTask(taskId),
        listTaskComments(taskId),
        listTaskActivity(weddingId, taskId),
      ]);

      if (cancelled) return;

      if (!taskResult.ok) {
        setTask(null);
        setError(taskResult.error.message);
      } else {
        setTask(taskResult.data);
        setError(null);
      }
      if (commentsResult.ok) {
        setComments(
          commentsResult.data.map((row) => ({
            id: row.id,
            body: row.body,
            created_at: row.created_at,
            author_id: row.author_id,
            author: row.author,
          })),
        );
      }
      if (activityResult.ok) {
        setActivity(activityResult.data);
      }
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [taskId, weddingId, reloadToken]);

  async function onToggleDone() {
    if (!task || !canToggleStatus) return;
    setBusy(true);
    const next = task.status === 'done' ? 'todo' : 'done';
    const result = await setTaskStatus(task.id, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setTask(result.data);
    setReloadToken((value) => value + 1);
  }

  async function onDelete() {
    if (!task || !canDelete || !weddingId) return;
    Alert.alert('Delete task?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            setBusy(true);
            const result = await deleteTask(task.id);
            setBusy(false);
            if (!result.ok) {
              setError(result.error.message);
              return;
            }
            router.replace(`/(app)/weddings/${weddingId}/checklist` as Href);
          })();
        },
      },
    ]);
  }

  async function onAddComment() {
    if (!taskId || !canComment) return;
    const parsed = commentSchema.safeParse({ body: commentBody });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid comment');
      return;
    }
    setBusy(true);
    const result = await addTaskComment(taskId, parsed.data.body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setCommentBody('');
    setReloadToken((value) => value + 1);
  }

  async function onDeleteComment(commentId: string) {
    setBusy(true);
    const result = await deleteTaskComment(commentId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setReloadToken((value) => value + 1);
  }

  if (isLoading || roleLoading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <TaskDetailSkeleton />
      </Screen>
    );
  }

  if (!task) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <Header title="Task" showBack onBack={() => router.back()} />
        <AppText color="danger" style={styles.center}>
          {error ?? 'Task unavailable'}
        </AppText>
        <Button label="Retry" onPress={() => setReloadToken((value) => value + 1)} />
      </Screen>
    );
  }

  const overdue = isTaskOverdue(task);

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header
        title="Task details"
        showBack
        onBack={() => router.replace(`/(app)/weddings/${weddingId}/checklist` as Href)}
      />

      <Card style={styles.card} ornament>
        <AppText variant="title" color="heading">
          {task.title}
        </AppText>
        {task.description ? (
          <AppText variant="body" color="textMuted">
            {task.description}
          </AppText>
        ) : null}
        <View style={styles.badges}>
          <Badge label={statusLabel(task.status)} tone={task.status === 'done' ? 'success' : 'neutral'} />
          <Badge label={task.priority} tone={task.priority === 'urgent' ? 'danger' : 'primary'} />
          {overdue ? <Badge label="Overdue" tone="danger" /> : null}
        </View>
        <Detail label="Category" value={task.category?.name_en ?? 'Uncategorized'} />
        <Detail label="Due date" value={formatWeddingDateLabel(task.due_date) ?? 'Not set'} />
        <Detail
          label="Assignees"
          value={
            task.assignees.length === 0
              ? 'Unassigned'
              : task.assignees.map((a) => a.profile?.display_name || 'Member').join(', ')
          }
        />
      </Card>

      <AuthFormError message={error} />

      <View style={styles.actions}>
        {canToggleStatus ? (
          <Button
            label={task.status === 'done' ? 'Reopen task' : 'Mark complete'}
            loading={busy}
            onPress={() => void onToggleDone()}
          />
        ) : null}
        {canEdit ? (
          <Button
            label="Edit task"
            variant="secondary"
            onPress={() =>
              router.push(`/(app)/weddings/${weddingId}/checklist/${task.id}/edit` as Href)
            }
          />
        ) : null}
        {canDelete ? (
          <Button label="Delete task" variant="danger" onPress={onDelete} disabled={busy} />
        ) : null}
      </View>

      <Card style={styles.card}>
        <AppText variant="label">Comments</AppText>
        {comments.length === 0 ? (
          <AppText variant="caption" color="textMuted">
            No comments yet.
          </AppText>
        ) : (
          comments.map((comment) => {
            const canRemove = comment.author_id === user?.id || isOwner;
            return (
              <View key={comment.id} style={styles.comment}>
                <View style={styles.commentHeader}>
                  <AppText variant="caption" color="textMuted">
                    {comment.author?.display_name || 'Member'}
                  </AppText>
                  {canRemove ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Delete comment"
                      disabled={busy}
                      onPress={() => void onDeleteComment(comment.id)}>
                      <AppText variant="caption" color="danger">
                        Delete
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
                <AppText variant="body">{comment.body}</AppText>
              </View>
            );
          })
        )}
        {canComment ? (
          <>
            <TextField
              label="Add a comment"
              value={commentBody}
              onChangeText={setCommentBody}
              editable={!busy}
              multiline
            />
            <Button label="Post comment" loading={busy} onPress={() => void onAddComment()} />
          </>
        ) : null}
      </Card>

      <Card style={styles.card}>
        <AppText variant="label">Activity</AppText>
        {activity.length === 0 ? (
          <AppText variant="caption" color="textMuted">
            No activity yet.
          </AppText>
        ) : (
          activity.map((item) => (
            <View key={item.id} style={styles.activityRow}>
              <AppText variant="caption" color="textMuted">
                {item.actor_name || 'Someone'} {activityLabel(item)}
                {item.created_at
                  ? ` · ${formatWeddingDateLabel(item.created_at.slice(0, 10)) ?? ''}`
                  : ''}
              </AppText>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.detail}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant="body">{value}</AppText>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
    card: {
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    badges: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    detail: {
      gap: spacing.xxs,
    },
    actions: {
      gap: spacing.md,
      marginBottom: spacing.xl,
    },
    comment: {
      gap: spacing.xxs,
      paddingVertical: spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    commentHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    activityRow: {
      paddingVertical: spacing.xs,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    center: {
      textAlign: 'center',
      marginBottom: spacing.md,
    },
  });
}
