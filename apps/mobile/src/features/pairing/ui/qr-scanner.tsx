import { CameraView, useCameraPermissions } from 'expo-camera';
import { cssInterop } from 'nativewind';
import { Camera, RotateCcw, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, View } from 'react-native';
import { Text } from '../../../shared/ui/text';

import { colors } from '../../../shared/ui/tokens';
import { PairingButton } from './pairing-button';

const NativeCamera = cssInterop(CameraView, { className: 'style' });

interface Props {
  foreground: boolean;
  onScan: (qr: string) => void;
  onStop: () => void;
}

export function QrScanner({ foreground, onScan, onStop }: Props) {
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
      <Text className="text-[22px] font-inter-semibold leading-7 text-ink">{t('pairing.scanTitle')}</Text>
      <Text className="font-sans text-sm leading-5 text-muted">{t('pairing.scanDescription')}</Text>
      {!permission && !permissionError && <ActivityIndicator accessibilityLabel={t('pairing.loadingCamera')} color={colors.ink} />}
      {permissionError && <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-error">{t('pairing.cameraError')}</Text>}
      {permission && !permission.granted && (
        <View className="gap-3">
          <Camera color={colors.muted} size={32} />
          <Text className="font-sans text-sm leading-5 text-muted">{t(permission.status === 'denied' ? 'pairing.cameraDenied' : 'pairing.cameraPermission')}</Text>
          <PairingButton disabled={requesting} label={t(permission.canAskAgain ? 'pairing.allowCamera' : 'pairing.openSettings')} onPress={() => void request()} />
        </View>
      )}
      {permissionError && !permission && <PairingButton label={t('pairing.allowCamera')} onPress={() => void request()} disabled={requesting} />}
      {permission?.granted && !failed && foreground && (
        <View className="h-[300px] items-center justify-center overflow-hidden rounded-3xl bg-primary">
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
      {permission?.granted && !foreground && <Text className="font-sans text-sm leading-5 text-muted">{t('pairing.cameraPaused')}</Text>}
      {failed && (
        <View className="gap-3">
          <Text accessibilityRole="alert" className="font-sans text-sm leading-5 text-error">{t('pairing.cameraUnavailable')}</Text>
          <PairingButton label={t('pairing.retryCamera')} secondary icon={<RotateCcw color={colors.ink} size={20} />} onPress={() => setFailed(false)} />
        </View>
      )}
      <PairingButton label={t('pairing.stopScan')} secondary icon={<X color={colors.ink} size={20} />} onPress={onStop} />
    </View>
  );
}
