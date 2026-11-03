import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getMyProfile,
  updateMyProfile,
  uploadAvatar,
} from '@/features/settings/services/profileService';
import type { ProfileUpdateInput } from '@/features/settings/types';
import { useUserId } from '@/features/weddings/queries';
import { unwrap } from '@/lib/query/queryError';
import { queryKeys, staleTimes } from '@/lib/query/queryKeys';

export function useMyProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.profile(userId ?? ''),
    queryFn: async ({ signal }) => unwrap(await getMyProfile(userId!, signal)),
    enabled: Boolean(userId),
    staleTime: staleTimes.wedding,
  });
}

export function useUpdateMyProfile() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProfileUpdateInput) => {
      if (!userId) throw new Error('Sign in to edit your profile.');
      return unwrap(await updateMyProfile(userId, input));
    },
    onSuccess: (profile) => {
      if (!userId) return;
      queryClient.setQueryData(queryKeys.profile(userId), profile);
    },
  });
}

export function useUploadAvatar() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { uri: string; mimeType?: string | null }) => {
      if (!userId) throw new Error('Sign in to update your photo.');
      const current = unwrap(await getMyProfile(userId));
      const uploaded = unwrap(await uploadAvatar({ userId, ...input }));
      return unwrap(
        await updateMyProfile(userId, {
          displayName: current.display_name || 'Member',
          phone: current.phone,
          avatarUrl: uploaded.publicUrl,
        }),
      );
    },
    onSuccess: (profile) => {
      if (!userId) return;
      queryClient.setQueryData(queryKeys.profile(userId), profile);
    },
  });
}
