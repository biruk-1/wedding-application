import * as DocumentPicker from 'expo-document-picker';
import { cacheDirectory, downloadAsync } from 'expo-file-system/legacy';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Header } from '@/components/layout/Header';
import { Screen } from '@/components/layout/Screen';
import { WeddingTabBar, weddingTabBarInset } from '@/components/navigation/WeddingTabBar';
import { FormSkeleton } from '@/components/skeletons/ScreenSkeletons';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { RefreshNotice } from '@/components/ui/RefreshNotice';
import { TextField } from '@/components/ui/TextField';
import { DocumentRow } from '@/features/documents/components/DocumentRow';
import {
  useDeleteWeddingDocument,
  useRenameWeddingDocument,
  useSignedDocumentUrl,
  useUploadWeddingDocument,
  useWeddingFiles,
} from '@/features/documents/queries';
import type { WeddingFileListItem } from '@/features/documents/types';
import { documentKindFromName } from '@/features/documents/utils/fileHelpers';
import { useWedding, useWeddingRole } from '@/features/weddings/queries';
import { useBackTo } from '@/lib/navigation';
import { errorMessage } from '@/lib/query/queryError';
import { spacing } from '@/theme/spacing';
import type { AppColors } from '@/theme/types';
import { useColors } from '@/theme/WeddingThemeContext';
import { useThemedStyles } from '@/theme/useThemedStyles';

export function DocumentsScreen() {
  const colors = useColors();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const tabInset = weddingTabBarInset(insets.bottom);
  const { weddingId } = useLocalSearchParams<{ weddingId: string }>();
  const goBack = useBackTo(`/(app)/weddings/${weddingId}/more`);
  const wedding = useWedding(weddingId);
  const { canWrite } = useWeddingRole(weddingId);
  const filesQuery = useWeddingFiles(weddingId);
  const upload = useUploadWeddingDocument(weddingId ?? '');
  const rename = useRenameWeddingDocument(weddingId ?? '');
  const remove = useDeleteWeddingDocument(weddingId ?? '');
  const signed = useSignedDocumentUrl();

  const [progress, setProgress] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<WeddingFileListItem | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const onPickUpload = useCallback(async () => {
    if (!canWrite || !weddingId || upload.isPending) return;
    setActionError(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
        type: [
          'application/pdf',
          'image/*',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      setProgress(0);
      upload.mutate(
        {
          displayName: asset.name || 'document',
          mimeType: asset.mimeType ?? null,
          uri: asset.uri,
          size: asset.size ?? null,
          onProgress: setProgress,
        },
        {
          onError: (error) => {
            setProgress(null);
            setActionError(errorMessage(error));
          },
          onSuccess: () => setProgress(null),
        },
      );
    } catch (error) {
      setProgress(null);
      setActionError(errorMessage(error));
    }
  }, [canWrite, weddingId, upload]);

  const openFile = useCallback(
    async (file: WeddingFileListItem) => {
      setActionError(null);
      try {
        const { url } = await signed.mutateAsync(file.storage_path);
        const kind = documentKindFromName(file.display_name);
        if (kind === 'image' || kind === 'pdf') {
          const supported = await Linking.canOpenURL(url);
          if (supported) {
            await Linking.openURL(url);
            return;
          }
        }
        if (await Sharing.isAvailableAsync()) {
          const target = `${cacheDirectory ?? ''}${file.display_name}`;
          const download = await downloadAsync(url, target);
          await Sharing.shareAsync(download.uri, { dialogTitle: file.display_name });
          return;
        }
        await Linking.openURL(url);
      } catch (error) {
        setActionError(errorMessage(error));
      }
    },
    [signed],
  );

  const onMore = useCallback(
    (file: WeddingFileListItem) => {
      const buttons: {
        text: string;
        style?: 'cancel' | 'destructive' | 'default';
        onPress?: () => void;
      }[] = [
        { text: 'Open / download', onPress: () => void openFile(file) },
      ];
      if (canWrite) {
        buttons.push({
          text: 'Rename',
          onPress: () => {
            setRenaming(file);
            setRenameValue(file.display_name);
          },
        });
        buttons.push({
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete document?',
              `Remove “${file.display_name}” from this wedding? This cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    setActionError(null);
                    remove.mutate(
                      { id: file.id, storage_path: file.storage_path },
                      { onError: (error) => setActionError(errorMessage(error)) },
                    );
                  },
                },
              ],
            );
          },
        });
      }
      buttons.push({ text: 'Cancel', style: 'cancel' });
      Alert.alert(file.display_name, undefined, buttons);
    },
    [canWrite, openFile, remove],
  );

  if (!weddingId) {
    return (
      <Screen>
        <StatusBar style="dark" />
        <AppText color="danger">Missing wedding.</AppText>
      </Screen>
    );
  }

  const header = (
    <Header title="Documents" subtitle={wedding.data?.title} showBack onBack={goBack} />
  );

  if (filesQuery.isPending) {
    return (
      <Screen scroll>
        <StatusBar style="dark" />
        {header}
        <FormSkeleton fields={4} />
      </Screen>
    );
  }

  if (filesQuery.isError && !filesQuery.data) {
    return (
      <Screen>
        <StatusBar style="dark" />
        {header}
        <AppText color="danger">{errorMessage(filesQuery.error)}</AppText>
        <Button label="Retry" onPress={() => void filesQuery.refetch()} />
      </Screen>
    );
  }

  const files = filesQuery.data ?? [];

  return (
    <View style={styles.root}>
      <Screen padded={false}>
        <StatusBar style="dark" />
        <FlatList
          data={files}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <DocumentRow file={item} onOpen={(f) => void openFile(f)} onMore={onMore} />
          )}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          contentContainerStyle={[styles.content, { paddingBottom: tabInset }]}
          ListHeaderComponent={
            <View>
              {header}
              <RefreshNotice
                error={filesQuery.isRefetchError ? filesQuery.error : null}
                onRetry={() => void filesQuery.refetch()}
              />
              <AppText variant="body" color="textMuted" style={styles.intro}>
                Keep contracts, quotes, receipts, and inspiration files with this wedding. Files stay
                private to wedding members.
              </AppText>
              {canWrite ? (
                <Button
                  label="Upload document"
                  loading={upload.isPending}
                  onPress={() => void onPickUpload()}
                  style={styles.uploadBtn}
                />
              ) : (
                <AppText variant="caption" color="textMuted" style={styles.intro}>
                  Viewers can open documents but only writers can upload or delete.
                </AppText>
              )}
              {progress != null ? (
                <Card style={styles.progressCard}>
                  <AppText variant="caption" color="textMuted">
                    Uploading… {Math.round(progress * 100)}%
                  </AppText>
                  <View style={styles.track}>
                    <View style={[styles.fill, { width: `${Math.round(progress * 100)}%` }]} />
                  </View>
                </Card>
              ) : null}
              {actionError ? (
                <AppText color="danger" variant="caption" style={styles.error}>
                  {actionError}
                </AppText>
              ) : null}
              {renaming ? (
                <Card style={styles.renameCard}>
                  <AppText variant="label">Rename document</AppText>
                  <TextField
                    value={renameValue}
                    onChangeText={setRenameValue}
                    autoCapitalize="none"
                  />
                  <View style={styles.renameActions}>
                    <Button
                      label="Cancel"
                      variant="secondary"
                      size="compact"
                      fullWidth={false}
                      onPress={() => setRenaming(null)}
                    />
                    <Button
                      label="Save"
                      size="compact"
                      fullWidth={false}
                      loading={rename.isPending}
                      onPress={() => {
                        rename.mutate(
                          { fileId: renaming.id, displayName: renameValue },
                          {
                            onError: (error) => setActionError(errorMessage(error)),
                            onSuccess: () => setRenaming(null),
                          },
                        );
                      }}
                    />
                  </View>
                </Card>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            <EmptyState
              title="No documents yet"
              description="Upload venue agreements, vendor quotes, receipts, or inspiration images."
              action={
                canWrite ? (
                  <Button label="Upload document" onPress={() => void onPickUpload()} />
                ) : undefined
              }
            />
          }
          refreshControl={
            <RefreshControl
              refreshing={filesQuery.isRefetching && !upload.isPending}
              onRefresh={() => void filesQuery.refetch()}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      </Screen>
      <View style={styles.tabBar}>
        <WeddingTabBar weddingId={weddingId} />
      </View>
    </View>
  );
}

function createStyles(colors: AppColors) {
  return StyleSheet.create({
  root: { flex: 1 },
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  intro: {
    marginBottom: spacing.lg,
  },
  uploadBtn: {
    marginBottom: spacing.lg,
  },
  progressCard: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  error: {
    marginBottom: spacing.md,
  },
  renameCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  renameActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sep: { height: spacing.md },
  });
}
