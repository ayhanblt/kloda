# Claude salt-okunur review kaydı — geçmiş iş tek seferlik incelemesi

Ayrı oturum Claude okuma geçişleri; kod/doküman değiştirilmedi, commit yok, kayıtlı
başarılı testler tekrarlanmadı. Bu kayıt "geçmiş review" adımının yapıldığını belgeler;
bağımsız-review kapısını sizin akış tanımınıza göre kapatıp kapatmadığı kullanıcı kararıdır.

## 1) 16c FTPS + 17 S3 güvenlik review — 10.11.2026 — TAMAM

- B1 Orta: `use-ftps-items.ts:36` / `use-smb-items.ts:36` / `use-sftp-items.ts:36`
  Hermes'te olmayan `crypto.randomUUID`; polyfill yok. Kabul: Hermes build'de bir
  review/restore aksiyonu veya S3'teki native UUID fabrikası desenine taşıma.
- B2 Düşük: iOS S3 fixture-CA güveni Swift bayrağında (`IosS3Client.swift:69-81`);
  `tools/check-s3-native.mjs` yalnız Rust artifact'ini tarar. Kabul: release app
  binary'sinde nm marker kontrolünü 20–21 dağıtım kapısına ekle.
- B3 Düşük: FTPS Rust motorunda zeroize yok (`request.rs:10`, `android_jni.rs:95`);
  S3 ile tutarsız. Kabul: Drop-zeroize veya ADR0022'ye kabul edilen sapma notu.
- B4 Düşük: Android vault'larda `setUnlockedDeviceRequired(true)` yok
  (`AndroidS3Vault.kt`, `AndroidFtpsVault.kt`). Kabul: değerlendir/belgele.
- Olumlu: webpki-only TLS + hostname + route-lease pin; 3 katman https/redirect-off;
  iki platformda özdeş 3-adım monoton journal; kayıp ACK → restart_review_required;
  CompletionAck ≠ Completed; custody JS'e sızmıyor. ADR0022'ye birebir uyum.

## 2) Kırmızı Jest + saha bulguları eşleştirme — 10.11.2026 — TAMAM

- `s3-diagnostic-page.spec.tsx:35` kök neden: spec son AppState listener'ı yakalıyor;
  `configured:true` ile iki `S3ItemsPanel` sonradan kayıt yapıp handler'ı eziyor.
  Ürün kodu doğru; spec düzeltmesi gerekir (tüm handler'ları çağır veya items mock).
- Saha A1→`runtime_phone.rs`/`pairing.ts`; A2→`AndroidWebDavRuntime.kt`/`WebDavRun.kt`;
  A3→`backup-management.ts` (teşhis metni zayıf); A4→`backup_retention_files.rs:16,19,159`
  tasarlanmış davranış, defect değil; A5 açık ürün kararı (grill-me);
  B WebDAV→`webdav.ts:35,62` iki kaba hata kovası kullanıcı gözlemini açıklıyor.

## 3) Lovable referans ↔ mobil/masaüstü UI ekran-ekran fark — 11.11.2026 — TAMAM

Çeviri eşliği tam: mobil TR/EN/DE 654/654/654, desktop 388/388/388 anahtar; JSX
literal metin ve literal prop taramaları boş (gömülü çevirisiz metin bulunamadı).

- G1 Orta: Mobil Etkinlik'te Lovable "Şu an / Geçmiş" segmented sekmesi yok
  (`activity.tsx.reference:17,35` ↔ `activity-page.tsx` tek scroll). Kabul: segment +
  geçmiş görünümü GPT planıyla; gerçek journal verisi, demo state kopyalanmaz.
- G2 Orta: Desktop /d/tray (D13) placeholder (`App.tsx:82` yalnız başlık+açıklama);
  tray paneli (durum pill, pencereyi aç, gelen aktarımı duraklat, çık) uygulanmadı.
  ADR0018/Linux görünür-kontrol kısıtıyla birlikte planlanmalı.
- G3 Düşük: Desktop Settings (D12) eksikleri: close-behavior (tray/quit) seçimi ve
  version satırı. Tema+dil+autostart+quit+sleep notu mevcut. Close-on-blur ADR0018
  kararına dokunur; fark bilinçliyse ADR'ye not düş.
- G4 Düşük: Mobil Settings (M13) eksikleri: hücresel veri anahtarı, gizlilik bölümü
  (foto erişim durumu, bildirimler) ve sürüm satırı. Gerçek native yetenek olmadan
  demo switch kopyalanmaz; kapsam kararı + GPT planı gerekir.
- G5 Düşük: Desktop'ta ayrı /d/sources (D10) ekranı yok; klasör seçimi
  `BackupSetup.tsx` 'sources' adımına gömülü. Bilinçli birleşimse belgele.
- G6 Bilgi: /lock-screen tasarımı step19 (iOS Live Activities) kapısında; yeni eksik değil.
- Eşleşen aile ler: /m Status home (6 durum + disabled + StatusHero) ✓, /m/photos +
  foto detayı ✓, /m/backups (hedef filtreli) ✓, /m bağlantı/provider aileleri ✓,
  pair-pc/pair-qr ✓, sources/schedule ✓; /d receiver/welcome/pair/devices/incoming/
  backups/trash/connections aileleri ✓; /d/jobs → WebDavActivity kısmi ✓.
- Desktop'ta `pairing-card`/`pairing-button` legacy sınıf adları sürüyor; referans
  sözleşmesi gereği ilgili ekran uyarlanırken ele alınır (toplu rewrite yok).
