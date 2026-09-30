import { NativeModule, requireNativeModule } from 'expo';

export interface NativeSchedule {
  intervalHours: 12 | 24;
  localTime: string;
}

declare class KlodaSyncRuntimeModule extends NativeModule<{}> {
  loadSchedule(): Promise<NativeSchedule>;
  saveSchedule(intervalHours: 12 | 24, localTime: string): Promise<void>;
}

export default requireNativeModule<KlodaSyncRuntimeModule>('KlodaSyncRuntime');
