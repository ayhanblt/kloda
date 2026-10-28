# Liste10 seçilmiş kanıtlar —28 Ekim2026

[Kapsam, çalıştırılanlar, açıklar ve SDK yan etkisi](../../mobile-integrated-step10-2026-10-28.md).
Bunlar sentetik özel test verileri; READY gerçek transfer/authority kabulü değildir.

- checks-accepted.json + mobile-tests-accepted.log:108/11suite, lint/TS/iki export.
- app-build.json: gerçek iOS Simulator app derlemesi.
- storage-checks.json + snapshot-runtime.json: typed storage classifier derleme/runtime sınırları.
- snapshot-cost-run.log:256MiB yalnız staging/hash, gerçek provider/PhotoKit/LAN değil.
- host-visual-result.json:3dil×2width DOM yaklaşımı.
- source-hashes.json: yalnız bu dilimin kaynak byte hash'leri; tüm dirty ağacın veya Git commit'in tamamlanması iddiası yok.
- android-runtime-blocked.json:APK derleme PASS; Android runtime unauthorized/NOT_RUN; owned process kapanışı.
- sdk-config-incident.json: SDK config olayı, metadata/hash ve kesin bilinmeyenler. Restore/cleanup yapılmadı.

## İncelenen son ekranlar

- sources-tr-accepted.png: safearea/font/anaCTA.
- computer-en-normal.png, computer-de-final.png: PC-first tasarım/ayrı izin rehberi.
- activity-tr-final.png: ACK/unknown fixture, tamamlandı diye gösterilmez.
- activity-de-large-accepted.png + activity-de-large-controls.png:fontScale2.643/gövde/altkontrol.
- activity-tr-landscape.png:852×393 kısa viewport.
- webdav-keyboard-accepted.png:secureinput/test/uyarı kaydırılarak erişilebilir.

## Önceki başarısız gözlemler (PASS değildir)

source-before-safearea.png, activity-de-large.png, webdav-keyboard-before.png
aynı grupta düzeltilen native görünüm kusurlarını gösterir. computer-de-normal.png
ara eksik stil görüntüsüdür; nedeni kanıtlanmadı, odaklı son çekim ayrıdır.
Debug araç overlay/sistem fontu vardır; release piksel/font kabulü değil.
Tam VoiceOver/TalkBack, gerçek telefon/PC, LAN, power-loss veya pil kabulü yok.
