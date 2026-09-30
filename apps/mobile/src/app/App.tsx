import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';

interface NativeScheduleRuntime {
  loadSchedule(): Promise<{ intervalHours: 12 | 24; localTime: string }>;
  saveSchedule(intervalHours: 12 | 24, localTime: string): Promise<void>;
}

const runtime = globalThis.require?.('react-native').NativeModules.KlodaSyncRuntime as NativeScheduleRuntime | undefined;

export function App() {
  const [intervalHours, setIntervalHours] = useState<12 | 24>(12);
  const [localTime, setLocalTime] = useState('12:00');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void runtime?.loadSchedule().then((schedule) => {
      setIntervalHours(schedule.intervalHours);
      setLocalTime(schedule.localTime);
    });
  }, []);

  const saveSchedule = async () => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(localTime)) return setMessage('Use HH:mm for the local start time.');
    if (!runtime) return setMessage('Kloda native runtime is unavailable. Rebuild the development app.');
    await runtime.saveSchedule(intervalHours, localTime);
    setMessage('Automatic sync schedule saved.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.step}>Step 1 of 2</Text>
      <Text style={styles.title}>Select folders to back up</Text>
      <Text style={styles.description}>Choose your sources, then set a local automatic sync time.</Text>
      <View style={styles.options}>
        <Button onPress={() => setIntervalHours(12)} title={`Every 12 hours${intervalHours === 12 ? ' ✓' : ''}`} />
        <Button onPress={() => setIntervalHours(24)} title={`Every 24 hours${intervalHours === 24 ? ' ✓' : ''}`} />
      </View>
      <TextInput accessibilityLabel="Local start time" onChangeText={setLocalTime} style={styles.time} value={localTime} />
      <Button onPress={() => void saveSchedule()} title="Save automatic sync" />
      {message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#fff8f5', flex: 1, gap: 16, justifyContent: 'center', padding: 24 },
  description: { color: '#57534E', fontSize: 16 },
  message: { color: '#57534E', fontSize: 14 },
  options: { gap: 8 },
  step: { color: '#57534E', fontSize: 13, fontWeight: '600', textTransform: 'uppercase' },
  time: { backgroundColor: '#FFFFFF', borderColor: '#E7E5E4', borderWidth: 1, borderRadius: 8, padding: 12 },
  title: { color: '#1C1917', fontSize: 28, fontWeight: '700' },
});
