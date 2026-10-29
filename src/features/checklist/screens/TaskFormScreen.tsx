import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { AuthScreenSkeleton } from '@/components/ui/Skeleton';
import { TextField } from '@/components/ui/TextField';
import { AuthFormError } from '@/features/auth/components/AuthFormError';
import {
  createTask,
  getWeddingTask,
  listTaskCategories,
  listWeddingMembersForAssign,
  updateTask,
} from '@/features/checklist/services/checklistService';
import {
  fieldErrorsFromZod,
  taskFormSchema,
  taskPriorities,
  taskStatuses,
} from '@/features/checklist/validation/taskSchemas';
import { statusLabel } from '@/features/checklist/utils/taskHelpers';
import { colors } from '@/theme/colors';
import { radii } from '@/theme/radii';
import { spacing } from '@/theme/spacing';

export function TaskFormScreen({ mode }: { mode: 'create' | 'edit' }) {
  const router = useRouter();
  const { weddingId, taskId } = useLocalSearchParams<{ weddingId: string; taskId?: string }>();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<(typeof taskPriorities)[number]>('medium');
  const [status, setStatus] = useState<(typeof taskStatuses)[number]>('todo');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<{ id: string; name_en: string }[]>([]);
  const [members, setMembers] = useState<{ user_id: string; display_name: string }[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(mode === 'edit');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!weddingId) return;
    let cancelled = false;
    void (async () => {
      const [cats, mems] = await Promise.all([
        listTaskCategories(),
        listWeddingMembersForAssign(weddingId),
      ]);
      if (cancelled) return;
      if (cats.ok) setCategories(cats.data.map((c) => ({ id: c.id, name_en: c.name_en })));
      if (mems.ok) setMembers(mems.data);

      if (mode === 'edit' && taskId) {
        const task = await getWeddingTask(taskId);
        if (!cancelled && task.ok) {
          setTitle(task.data.title);
          setDescription(task.data.description ?? '');
          setCategoryId(task.data.category_id ?? '');
          setDueDate(task.data.due_date ?? '');
          setPriority((task.data.priority as (typeof taskPriorities)[number]) || 'medium');
          setStatus((task.data.status as (typeof taskStatuses)[number]) || 'todo');
          setAssigneeIds(task.data.assignees.map((a) => a.user_id));
        } else if (!cancelled && !task.ok) {
          setFormError(task.error.message);
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [weddingId, taskId, mode]);

  function toggleAssignee(userId: string) {
    setAssigneeIds((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  async function onSubmit() {
    if (submitting || !weddingId) return;
    setFormError(null);
    const parsed = taskFormSchema.safeParse({
      title,
      description,
      categoryId,
      dueDate,
      priority,
      status,
      assigneeIds,
    });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFromZod(parsed.error));
      return;
    }
    setFieldErrors({});
    setSubmitting(true);

    const payload = {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      categoryId: parsed.data.categoryId ?? null,
      dueDate: parsed.data.dueDate ?? null,
      priority: parsed.data.priority,
      status: parsed.data.status,
      assigneeIds: parsed.data.assigneeIds,
    };

    const result =
      mode === 'create'
        ? await createTask({ weddingId, ...payload })
        : await updateTask(taskId!, payload);

    setSubmitting(false);
    if (!result.ok) {
      setFormError(result.error.message);
      return;
    }

    router.replace(`/(app)/weddings/${weddingId}/checklist/${result.data.id}` as Href);
  }

  if (loading) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AuthScreenSkeleton />
      </Screen>
    );
  }

  return (
    <Screen scroll keyboardAvoiding>
      <StatusBar style="dark" />
      <Header
        title={mode === 'create' ? 'New task' : 'Edit task'}
        showBack
        onBack={() => router.back()}
      />
      <View style={styles.form}>
        <TextField
          label="Title"
          value={title}
          onChangeText={setTitle}
          error={fieldErrors.title}
          editable={!submitting}
        />
        <TextField
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          helperText="Optional"
          error={fieldErrors.description}
          editable={!submitting}
          style={styles.multiline}
        />
        <AppText variant="label">Category</AppText>
        <View style={styles.chips}>
          <Chip
            label="None"
            selected={!categoryId}
            onPress={() => setCategoryId('')}
          />
          {categories.map((category) => (
            <Chip
              key={category.id}
              label={category.name_en}
              selected={categoryId === category.id}
              onPress={() => setCategoryId(category.id)}
            />
          ))}
        </View>
        <TextField
          label="Due date"
          placeholder="YYYY-MM-DD"
          value={dueDate}
          onChangeText={setDueDate}
          helperText="Optional"
          error={fieldErrors.dueDate}
          editable={!submitting}
          autoCapitalize="none"
        />
        <AppText variant="label">Priority</AppText>
        <View style={styles.chips}>
          {taskPriorities.map((value) => (
            <Chip
              key={value}
              label={value}
              selected={priority === value}
              onPress={() => setPriority(value)}
            />
          ))}
        </View>
        <AppText variant="label">Status</AppText>
        <View style={styles.chips}>
          {taskStatuses.map((value) => (
            <Chip
              key={value}
              label={statusLabel(value)}
              selected={status === value}
              onPress={() => setStatus(value)}
            />
          ))}
        </View>
        <AppText variant="label">Assignees</AppText>
        <AppText variant="caption" color="textMuted">
          Optional — choose wedding members
        </AppText>
        <View style={styles.chips}>
          {members.map((member) => (
            <Chip
              key={member.user_id}
              label={member.display_name}
              selected={assigneeIds.includes(member.user_id)}
              onPress={() => toggleAssignee(member.user_id)}
            />
          ))}
        </View>
        <AuthFormError message={formError} />
        <Button
          label={mode === 'create' ? 'Create task' : 'Save changes'}
          loading={submitting}
          onPress={() => void onSubmit()}
        />
      </View>
    </Screen>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}>
      <AppText
        variant="caption"
        style={{ color: selected ? colors.onPrimary : colors.textMuted, textTransform: 'capitalize' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
    paddingBottom: spacing['2xl'],
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
