// Display catalogue only: presence does not imply an implemented adapter or valid access.
export const destinationProviders = [
  { id: 'webdav', code: 'P1', kind: 'protocol' },
  { id: 'smb', code: 'P2', kind: 'protocol' },
  { id: 'ftp', code: 'P3', kind: 'protocol' },
  { id: 'sftp', code: 'P4', kind: 'protocol' },
  { id: 's3-compatible', code: 'P5', kind: 'protocol' },
  { id: 'amazon-s3', code: 'C1', kind: 'cloud' },
  { id: 'box', code: 'C2', kind: 'cloud' },
  { id: 'cloudme', code: 'C3', kind: 'cloud' },
  { id: 'dropbox', code: 'C4', kind: 'cloud' },
  { id: 'google-drive', code: 'C5', kind: 'cloud' },
  { id: 'google-cloud-storage', code: 'C6', kind: 'cloud' },
  { id: 'kolab-now', code: 'C7', kind: 'cloud' },
  { id: 'mega', code: 'C8', kind: 'cloud' },
  { id: 'onedrive', code: 'C9', kind: 'cloud' },
  { id: 'nextcloud', code: 'C10', kind: 'cloud' },
  { id: 'yandex-disk', code: 'C11', kind: 'cloud' },
] as const;

export type DestinationProviderId = (typeof destinationProviders)[number]['id'];
