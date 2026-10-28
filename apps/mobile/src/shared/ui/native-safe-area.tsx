import { cssInterop } from 'nativewind';
import { SafeAreaView } from 'react-native-safe-area-context';

export const NativeSafeArea = cssInterop(SafeAreaView, { className: 'style' });
