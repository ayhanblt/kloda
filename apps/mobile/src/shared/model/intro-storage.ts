import * as SecureStore from 'expo-secure-store';

const INTRO_SEEN_KEY = 'kloda.intro.seen';

export async function loadIntroSeen(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(INTRO_SEEN_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function saveIntroSeen(): Promise<void> {
  try {
    await SecureStore.setItemAsync(INTRO_SEEN_KEY, '1');
  } catch {
    // Non-fatal: intro state will stay in memory for the active session.
  }
}
