import { CameraView, useCameraPermissions } from 'expo-camera';
import { Camera, RotateCcw, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../../shared/ui/tokens';
import { PairingButton } from './pairing-button';

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
    <View style={styles.container}>
      <Text style={styles.title}>{t('pairing.scanTitle')}</Text>
      <Text style={styles.body}>{t('pairing.scanDescription')}</Text>
      {!permission && !permissionError && <ActivityIndicator accessibilityLabel={t('pairing.loadingCamera')} color={colors.ink} />}
      {permissionError && <Text accessibilityRole="alert" style={styles.error}>{t('pairing.cameraError')}</Text>}
      {permission && !permission.granted && (
        <View style={styles.section}>
          <Camera color={colors.muted} size={32} />
          <Text style={styles.body}>{t(permission.status === 'denied' ? 'pairing.cameraDenied' : 'pairing.cameraPermission')}</Text>
          <PairingButton disabled={requesting} label={t(permission.canAskAgain ? 'pairing.allowCamera' : 'pairing.openSettings')} onPress={() => void request()} />
        </View>
      )}
      {permissionError && !permission && <PairingButton label={t('pairing.allowCamera')} onPress={() => void request()} disabled={requesting} />}
      {permission?.granted && !failed && foreground && (
        <View style={styles.cameraFrame}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={({ data, type }) => { if (type === 'qr') onScan(data); }}
            onMountError={() => setFailed(true)}
          />
          <View pointerEvents="none" style={styles.scanTarget} />
        </View>
      )}
      {permission?.granted && !foreground && <Text style={styles.body}>{t('pairing.cameraPaused')}</Text>}
      {failed && (
        <View style={styles.section}>
          <Text accessibilityRole="alert" style={styles.error}>{t('pairing.cameraUnavailable')}</Text>
          <PairingButton label={t('pairing.retryCamera')} secondary icon={<RotateCcw color={colors.ink} size={20} />} onPress={() => setFailed(false)} />
        </View>
      )}
      <PairingButton label={t('pairing.stopScan')} secondary icon={<X color={colors.ink} size={20} />} onPress={onStop} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  section: { gap: 12 },
  title: { color: colors.ink, fontSize: 22, lineHeight: 28, fontWeight: '600' },
  body: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.error, fontSize: 14, lineHeight: 20 },
  cameraFrame: { height: 300, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  scanTarget: { height: 208, width: 208, borderWidth: 2, borderColor: colors.elevated, borderRadius: 16 },
});
