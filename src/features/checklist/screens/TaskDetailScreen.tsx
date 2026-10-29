import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AuthScreenSkeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import {
  addTaskComment,
  deleteTask,
  getWeddingTask,
  listTaskComments,
  setTaskStatus,
} from '@/features/checklist/services/checklistService';
import type { TaskWithRelations } from '@/features/checklist/types';
import { commentSchema } from '@/features/checklist/validation/taskSchemas';
import { isTaskOverdue, statusLabel } from '@/features/checklist/utils/taskHelpers';
import { formatWeddingDateLabel } from '@/features/weddings/utils/countdown';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  author: { display_name: string } | null;
};

export function TaskDetailScreen() {
  const router = useRouter();
  const { weddingId, taskId } = useLocalSearchParams<{ weddingId: string; taskId: string }>();
  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!taskId || !weddingId) return;

    let cancelled = false;

    void (async () => {
      const [taskResult, commentsResult, membership] = await Promise.all([
        getWeddingTask(taskId),
        listTaskComments(taskId),
        supabase
          .from('wedding_members')
          .select('role')
          .eq('wedding_id', weddingId)
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
          .maybeSingle(),
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
            author: row.author,
          })),
        );
      }
      const role = membership.data?.role;
      setCanWrite(Boolean(role && role !== 'viewer'));
      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [taskId, weddingId, reloadToken]);

  async function onToggleDone() {
    if (!task || !canWrite) return;
    setBusy(true);
    const next = task.status === 'done' ? 'todo' : 'done';
    const result = await setTaskStatus(task.id, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setTask(result.data);
  }

  async function onDelete() {
    if (!task || !canWrite || !weddingId) return;
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
    if (!taskId || !canWrite) return;
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

  if (isLoading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AuthScreenSkeleton />
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

      <Card style={styles.card}>
        <AppText variant="title">{task.title}</AppText>
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

      {canWrite ? (
        <View style={styles.actions}>
          <Button
            label={task.status === 'done' ? 'Reopen task' : 'Mark complete'}
            loading={busy}
            onPress={() => void onToggleDone()}
          />
          <Button
            label="Edit task"
            variant="secondary"
            onPress={() =>
              router.push(`/(app)/weddings/${weddingId}/checklist/${task.id}/edit` as Href)
            }
          />
          <Button label="Delete task" variant="danger" onPress={onDelete} disabled={busy} />
        </View>
      ) : null}

      <Card style={styles.card}>
        <AppText variant="label">Comments</AppText>
        {comments.length === 0 ? (
          <AppText variant="caption" color="textMuted">
            No comments yet.
          </AppText>
        ) : (
          comments.map((comment) => (
            <View key={comment.id} style={styles.comment}>
              <AppText variant="caption" color="textMuted">
                {comment.author?.display_name || 'Member'}
              </AppText>
              <AppText variant="body">{comment.body}</AppText>
            </View>
          ))
        )}
        {canWrite ? (
          <>
            <TextField
              label="Add a comment"
              value={commentBody}
              onChangeText={setCommentBody}
              editable={!busy}
            />
            <Button label="Post comment" loading={busy} onPress={() => void onAddComment()} />
          </>
        ) : null}
      </Card>
    </Screen>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <AppText variant="caption" color="textMuted">
        {label}
      </AppText>
      <AppText variant="bodyMedium" style={{ color: colors.text }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
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
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  center: {
    textAlign: 'center',
  },
});
