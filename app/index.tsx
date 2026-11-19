import { useAuth } from '@/features/auth/hooks/useAuth';
import { AuthLoadingScreen } from '@/features/auth/screens/AuthLoadingScreen';
import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen';

/**
 * Public landing for signed-out visitors. Signed-in users only pass through here:
 * `useAuthGate` replace()s them to `/(app)`. Do not use `<Redirect />` here
 * (it can leave Linking without an initial state on native).
 */
export default function Index() {
  const { session } = useAuth();
  if (session) return <AuthLoadingScreen label="Loading Kiburan…" />;
  return <WelcomeScreen />;
}
