import 'react-native-gesture-handler';
import './global.css';
import './src/shared/i18n';

import { App } from './src/app/App';
import { StatusBar } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';

export default function MobileApp() {
  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="dark-content" />
        <App />
        <Toaster />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
