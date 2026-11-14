import { useRouter } from 'expo-router';
import { BleLogScreen } from '../src/features/detection';

export default function BleLogRoute() {
  const router = useRouter();
  return <BleLogScreen onBack={() => router.back()} />;
}
