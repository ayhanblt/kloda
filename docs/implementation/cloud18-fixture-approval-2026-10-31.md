# Step18 group A — fixture approval / 31 Ekim 2026

Kullanıcı 31.10.2026'da açıkça onayladı:

- Docker Hub resmî `nextcloud` imajı (`nextcloud:31-apache`) yalnız bu Mac'te,
  mevcut tek kullanımlık fixture CA'lı HTTPS arkasında çalıştırılır. Veri ve
  anahtarlar `/tmp/kloda-step18/` altında kalır; dış ağa yayın yok.
- Codex'in step16a cihazlarından (`KlodaWebDavStep15`, `Kloda-WebDAV15-Disposable`)
  ayrı, tek kullanımlık iOS Simulator `Kloda-Cloud18-Disposable` ve Android AVD
  `KlodaCloud18` oluşturulur. Mevcut sistem imajı kullanılır; imaj indirmek ayrıca
  sorulur. Yalnız bu fixture uygulamasının Keychain/Keystore kayıtları yazılır;
  Photos/medya yazma izni yok.

Kapsam dışı: gerçek Nextcloud/CloudMe/Kolab hesabı, fiziksel cihaz (adım21),
ürün aktivasyonu. [ADR0027](../decisions/0027-multiple-dav-based-cloud-destinations.md).
