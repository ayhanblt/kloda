import { CameraView, useCameraPermissions } from 'expo-camera';
import { cssInterop } from 'nativewind';
import { Camera, RotateCcw, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, View } from 'react-native';
import { Text } from '../../../shared/ui/text';

import { useThemeColors } from '../../../shared/theme/theme-provider';
import { PairingButton } from './pairing-button';

const NativeCamera = cssInterop(CameraView, { className: 'style' });

interface Props {
  foreground: boolean;
  onScan: (qr: string) => void;
  onStop: () => void;
}

export function QrScanner({ foreground, onScan, onStop }: Props) {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [failed, setFailed] = useState(false);
  const [permissionError, setPermissionError] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    if (foreground) void getPermission().catch(() => setPermissionError(true));
  }, [foreground, getPermission]);

  const request = async () => {
    setRequesting(true);
    setPermissionError(false);
    try {
      if (permission?.canAskAgain === false) await Linking.openSettings();
      else await requestPermission();
    } catch {
      setPermissionError(true);
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View className="gap-4">
      <Text className="text-[22px] font-inter-semibold leading-7 text-primary-text">{t('pairing.scanTitle')}</Text>
      <Text className="font-sans text-sm leading-5 text-secondary-text">{t('pairing.scanDescription')}</Text>
      {!permission && !permissionError && <ActivityIndicator accessibilityLabel={t('pairing.loadingCamera')} color={colors['text-primary']} />}
      {permissionError && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t('pairing.cameraError')}</Text>}
      {permission && !permission.granted && (
        <View className="gap-3">
          <Camera color={colors['text-secondary']} size={32} />
          <Text className="font-sans text-sm leading-5 text-secondary-text">{t(permission.status === 'denied' ? 'pairing.cameraDenied' : 'pairing.cameraPermission')}</Text>
          <PairingButton disabled={requesting} label={t(permission.canAskAgain ? 'pairing.allowCamera' : 'pairing.openSettings')} onPress={() => void request()} />
        </View>
      )}
      {permissionError && !permission && <PairingButton label={t('pairing.allowCamera')} onPress={() => void request()} disabled={requesting} />}
      {permission?.granted && !failed && foreground && (
        <View className="h-[300px] items-center justify-center overflow-hidden rounded-2xl bg-action">
          <NativeCamera
            className="absolute inset-0"
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data, type }) => { if (type === 'qr') onScan(data); }}
            onMountError={() => setFailed(true)}
          />
          <View pointerEvents="none" className="h-52 w-52 rounded-2xl border-2 border-white" />
        </View>
      )}
      {permission?.granted && !foreground && <Text className="font-sans text-sm leading-5 text-secondary-text">{t('pairing.cameraPaused')}</Text>}
      {failed && (
        <View className="gap-3">
          <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-danger-text">{t('pairing.cameraUnavailable')}</Text>
          <PairingButton label={t('pairing.retryCamera')} variant="secondary" icon={<RotateCcw color={colors['text-primary']} size={20} />} onPress={() => setFailed(false)} />
        </View>
      )}
      <PairingButton label={t('pairing.stopScan')} variant="secondary" icon={<X color={colors['text-primary']} size={20} />} onPress={onStop} />
    </View>
  );
}
