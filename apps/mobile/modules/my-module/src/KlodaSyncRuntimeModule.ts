import { NativeModule, requireNativeModule } from 'expo';

export type NativeSourceKind = 'directory' | 'photos';

export interface NativeDirectorySource {
  displayName: string;
  id: string;
  kind: NativeSourceKind;
  reference: string;
}

export interface NativePhotoSource {
  displayName: string;
  id: string;
  kind: NativeSourceKind;
  reference: string;
}

export interface NativePhotoAlbum {
  displayName: string;
  id: string;
}

export interface NativeSourceAccess {
  accessible: boolean;
  id: string;
}

export interface NativeSourceJobPreparation {
  queuedFiles: number;
  scannedSources: number;
}

export interface NativeSchedule {
  backupMode?: 'live' | 'scheduled';
  intervalHours: 12 | 24;
  localTime: string;
}

export interface NativeStorageConfig {
  endpoint: string;
  targetPath: string;
  username: string;
}

declare class KlodaSyncRuntimeModule extends NativeModule<{}> {
  loadDirectorySources(): Promise<NativeDirectorySource[]>;
  loadPhotoSources(): Promise<NativePhotoSource[]>;
  loadSchedule(): Promise<NativeSchedule>;
  loadStorageConfig(): Promise<NativeStorageConfig | null>;
  pickDirectory(request: string): Promise<NativeDirectorySource | null>;
  prepareSourceJobs(): Promise<NativeSourceJobPreparation>;
  removeDirectorySource(id: string): Promise<void>;
  removePhotoSource(id: string): Promise<void>;
  loadPhotoAlbums(): Promise<NativePhotoAlbum[]>;
  validateDirectorySources(): Promise<NativeSourceAccess[]>;
  selectPhotoAlbum(id: string): Promise<NativePhotoSource | null>;
  selectPhotoLibrary(): Promise<NativePhotoSource | null>;
  saveSchedule(intervalHours: 12 | 24, localTime: string): Promise<void>;
  saveLiveSchedule?(): Promise<void>;
  saveStorageConfig(endpoint: string, targetPath: string, username: string): Promise<void>;
}

export default requireNativeModule<KlodaSyncRuntimeModule>('KlodaSyncRuntime');
