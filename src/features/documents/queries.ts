import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createSignedDocumentUrl,
  deleteWeddingDocument,
  listWeddingFiles,
  renameWeddingDocument,
  uploadWeddingDocument,
  type UploadDocumentInput,
} from '@/features/documents/services/documentService';
import type { WeddingFileListItem } from '@/features/documents/types';
import { useUserId } from '@/features/weddings/queries';
import { unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';

export function useWeddingFiles(weddingId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.weddingFiles(userId ?? '', weddingId ?? ''),
    queryFn: async ({ signal }) => unwrap(await listWeddingFiles(weddingId!, signal)),
    enabled: Boolean(userId && weddingId),
    staleTime: staleTimes.collaborative,
  });
}

export function useUploadWeddingDocument(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: Omit<UploadDocumentInput, 'weddingId' | 'userId'> & { onProgress?: (n: number) => void },
    ) => {
      if (!userId) throw new Error('Sign in to upload documents.');
      return unwrap(
        await uploadWeddingDocument({
          ...input,
          weddingId,
          userId,
        }),
      );
    },
    onSuccess: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.weddingFiles(userId, weddingId) });
    },
  });
}

export function useRenameWeddingDocument(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ fileId, displayName }: { fileId: string; displayName: string }) =>
      unwrap(await renameWeddingDocument(weddingId, fileId, displayName)),
    onSuccess: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.weddingFiles(userId, weddingId) });
    },
  });
}

export function useDeleteWeddingDocument(weddingId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: Pick<WeddingFileListItem, 'id' | 'storage_path'>) =>
      unwrap(await deleteWeddingDocument(weddingId, file)),
    onSuccess: () => {
      if (!userId) return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.weddingFiles(userId, weddingId) });
    },
  });
}

export function useSignedDocumentUrl() {
  return useMutation({
    mutationFn: async (storagePath: string) => unwrap(await createSignedDocumentUrl(storagePath)),
  });
}
