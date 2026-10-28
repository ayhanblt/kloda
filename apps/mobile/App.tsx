import 'react-native-gesture-handler';
import './global.css';
import './src/shared/i18n';

import { App } from './src/app/App';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { Text } from './src/shared/ui/text';
import { useFonts } from 'expo-font';
import interRegular from '../../assets/fonts/inter/Inter-Regular.ttf';
import interMedium from '../../assets/fonts/inter/Inter-Medium.ttf';
import interSemiBold from '../../assets/fonts/inter/Inter-SemiBold.ttf';
import interBold from '../../assets/fonts/inter/Inter-Bold.ttf';
import { useTranslation } from 'react-i18next';
import { cssInterop } from 'nativewind';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';

const GestureRoot = cssInterop(GestureHandlerRootView, { className: 'style' });

export default function MobileApp() {
  const { t } = useTranslation();
  const [fontsLoaded, fontError] = useFonts({
    KlodaInterRegular: interRegular,
    KlodaInterMedium: interMedium,
    KlodaInterSemiBold: interSemiBold,
    KlodaInterBold: interBold,
  });
  if (!fontsLoaded && !fontError) return <ActivityIndicator accessibilityLabel={t('pairing.loading')} />;
  return (
    <SafeAreaProvider>
      <GestureRoot className="flex-1">
        <StatusBar barStyle="dark-content" />
        {fontError && <View className="bg-surface p-3"><Text accessibilityRole="alert" className="text-sm text-error">{t('ui.fontUnavailable')}</Text></View>}
        <App />
        <Toaster />
      </GestureRoot>
    </SafeAreaProvider>
  );
}
