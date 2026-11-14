import { useRouter } from 'expo-router';
import { AuthScreenView } from '../src/features/auth';

export default function AuthRoute() {
  const router = useRouter();
  const leave = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)'));
  return <AuthScreenView onDone={leave} onBack={leave} />;
}
