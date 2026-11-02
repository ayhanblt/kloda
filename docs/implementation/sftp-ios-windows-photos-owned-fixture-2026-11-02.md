# 16b — exact onaylı iOS Windows SFTP Photos testi

Somut fixture önce `FixtureMediaEnabled=false` derlendi. Kullanıcı02.11 exact kapsamı açıkça onayladı; yalnız onaylı runtime için flag=true yapıldı.
SMB Photos onayı SFTP'ye taşınmaz; CURRENT/preflight medya fixture için exact izin ister.

Yalnız `Kloda-WebDAV15-Disposable` / `497AAA0F-967E-4781-9468-3F05CA2D3D5A`, yeni
`com.kloda.fixture.sftp16.windowsphotos.*` bundle/Keychain grubu ve Windows'taki boş
`C:\KlodaTest16b\upload` test klasörü kullanılır. Sunucu `192.168.1.54:2222`, hesap
`kloda16b`; Windows konsolundan bağımsız doğrulanan pin:
`SHA256:JO6gTt4ojeX0s5ivDmtoHrvZ+0DLuXAeKcW2+ZNTmzQ`.

Yeni bir 1×1 PNG kaynak ve yalnız bu fixture'a ait albüm oluşturulur. Gerçek kaynak
seçimi, bound LAN socket, native vault/profile, resource+SFTP manifest yayını,
fsync/CLOSE/rename ACK, taze hash download, restore/repeat/reopen çalışır. Üç restore
çağrısında beklenen bir yeni asset+albüm; toplam beklenen2 asset+2 albüm. Hata halinde
muhafazakâr üst sınır4 asset+4 albüm. Seed yalnız bir kez; bilinmeyen sonuç otomatik
retry/adoption veya yeni seed izni vermez. Genel Photos taraması/kişisel cihaz/NAS yok.

Temizlik yalnız source ledger ve native restore receipt kimlikleriyle, nonce/PNG
bytes/favorite/album membership doğrulanarak yapılır. Başarıda kaynak+çıktı tam olarak
2 asset+2 albüm silinir ve kimlikler tekrar fetch edilerek yoklukları doğrulanır.
Restore öncesi hata için `cleanup-source` yalnız doğrulanmış1 kaynak asset+albümü
silebilir; bilinmeyen restore sonucu korunur. Keychain temizliği yalnız bu yeni
bundle'ın `.sftp.native.v1/profile` kaydıdır. Geçici parola dosyaları test sonunda silinir.

Kod:
- `packages/sftp-native/apple/tests/IosSftpWindowsPhotosApp.swift`
- `tools/build-ios-sftp-windows-fixture.py photos`

Derlenen build ledger:
`/var/folders/cm/fsyld6dn5xl1p74jcds8tc640000gn/T/kloda-windows-sftp16b-photos-qx333xet/ownership.json`.
Durum: exact kullanıcı onayı sonrası seed/reopen/cleanup PASS;2asset+2albüm temizlendi. Güncel ledger `kloda-windows-sftp16b-photos-xwpgb660/ownership.json`; ilk izin bekleme hatası medya oluşturmadan durdu. [Sonuç+temizlik](evidence/sftp-closure-step16b-2026-11-01/manifest.json).
