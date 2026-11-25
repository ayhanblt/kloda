# Kloda Third-Party Notices (V1 1.0.0)

Kloda incorporates open-source software components across its desktop, mobile, and native Rust runtime packages.
Complete resolved Rust crate dependency licenses and full upstream texts are included in:

- [packages/sftp-native/THIRD_PARTY_NOTICES.md](packages/sftp-native/THIRD_PARTY_NOTICES.md)
- [packages/ftps-native/THIRD_PARTY_NOTICES.md](packages/ftps-native/THIRD_PARTY_NOTICES.md)

## Application & Runtime Frameworks

- **Electron** (`electron`) — MIT License
- **React & React DOM** (`react`, `react-dom`) — MIT License
- **React Native** (`react-native`) — MIT License
- **Expo SDK & Modules** (`expo`, `expo-camera`, `expo-dev-client`, `expo-font`, `expo-secure-store`) — MIT License
- **better-sqlite3** (`better-sqlite3`) & **SQLite** (Public Domain) — MIT License
- **Tailwind CSS** & **NativeWind** — MIT License
- **i18next** / **react-i18next** — MIT License
- **lucide-react** / **lucide-react-native** — ISC License
- **qrcode** (`qrcode`) — MIT License
- **OkHttp** / **Kotlin Standard Library** / **AndroidX Browser** — Apache-2.0 License
- **Google Play Services Auth** (`com.google.android.gms:play-services-auth`) — Android Software Development Kit License

## Native Rust Crates (`pairing-native`, `storage-native`, `sftp-native`, `ftps-native`)

- **ring** — Apache-2.0 / ISC-style (BoringSSL-derived) License
- **rustls**, **rustls-webpki**, **rustls-pki-types** — Apache-2.0 OR ISC OR MIT
- **rusqlite** & **libsqlite3-sys** (bundled SQLite) — MIT / Public Domain
- **cap-std** — Apache-2.0 WITH LLVM-exception OR Apache-2.0 OR MIT
- **russh** / **russh-sftp** — Apache-2.0 (see `packages/sftp-native/THIRD_PARTY_NOTICES.md`)
- **suppaftp** & **p256** / **aes-gcm** / **argon2** — Apache-2.0 OR MIT (see `packages/ftps-native/THIRD_PARTY_NOTICES.md`)
- **zeroize**, **serde**, **serde_json**, **jni**, **napi-derive** — Apache-2.0 OR MIT
