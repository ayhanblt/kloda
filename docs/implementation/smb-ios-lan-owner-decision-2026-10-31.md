# SMB16a — iOS OS LAN sahibini yeniden kullanma / 31 Ekim2026

Durum: **A kullanıcı tarafından açıkça onaylandı ve uygulandı**. SMB kapalı.

Pozitif Simulator Keychain/custody dilimi tamamlandı: [kanıt](evidence/smb-native-publication-step16-2026-10-30/ios-custody-2026-10-31.json). Üretim signing/gerçek cihaz kilidi kabulü açık.

## Neden kapsam onayı gerekiyor

Mevcut OS LAN sahibi `pairing-native::route::Route` private; Swift'e verilmiş bağımsız bağlı-socket/route-lease API'si yok. D8'in onaylı `kloda_smb_publish_bound` köprüsü bağlı socket'i tüketir, OS route yetkisi üretmez. Ayrı Swift route politikası yazmak yerine mevcut iOS interface/prefix/witness/binding politikasını yeniden kullanmak iki yeni native sembol gerektirir. [AGENTS.md](../../AGENTS.md) “Scope and capture discipline”: “If implementation expands an approved decision (more files/lines, a new ABI, etc.), present the expanded diff and obtain explicit approval again.” Bu yeni ABI genişlemesi için geçerlidir; tarihî otomatik ret tekrar açılmıyor.

## A — dar iOS route köprüsü (onaylı/uygulandı)

[Somut diff](evidence/smb-native-publication-step16-2026-10-30/ios-lan-owner-proposal.patch): yeni Rust modülü + lib kaydı, canonical/header mirror ve yeni native Swift yayın girişi. Üretim kaynaklarına uygulandı; iki sembol mevcut iOS paketleme export kapısına eklendi. Ek dosyalar bu dar kapsamın test fixture/runner kanıtıdır. SDK, dependency, route politikası ve storage C ABI değişmez.

- `kloda_ios_lan_with_socket`: yalnız bounded numeric IP+port; mevcut Route::for_peer/connect ile en fazla5s bağlantı; gerçek route+witness ve socket senkron callback sonuna kadar Rust'ta tutulur. Callback'e borrowed FD ve borrowed route lease verilir. Rust tüm dönüşlerde orijinal socket'i kapatır.
- `kloda_ios_lan_current`: yalnız mevcut native callback süresindeki lease geçerlidir. Kalıcı handle/JS girdisi/arka planda kaçan pointer yok. Kaybolan/değişen OS witness eski işi yeniden yetkilendirmez.
- Swift `publishLan`: worker/profile/context ve kaynak callback kontrolü bağlantıdan önce; socket duplicate'ini mevcut tüketen `publishBound` yoluna verir. Callback0 ve yerel Completed aynı profile/vault ve route/current-source denetimine tabidir. Salt socket teslimi yetki değildir.
- Seçili Files bookmark/kalıcı generation sahibinin gerçek bağlanması sonraki dilimdir; `currentSource` native callback'i tek başına o kabul değildir. Android karşılığı bu iOS diff'inde yoktur. Ürün UI/queue/schedule açılmaz; Photos mutasyonu, yeni SDK veya signing kapsamı eklenmez.

## Doğrulama ve sınırlar

[Taze kanıt ve log manifesti](evidence/smb-native-publication-step16-2026-10-30/ios-lan-owner-2026-10-31.json). Rust2 test (route double/lifetime/FD/ret), Swift7 senaryo (gerçek owner/publication/SQLite; vault/route/SMB double), gerçek Simulator ABI link/ret ve mevcut native witness metadata/sticky-refusal testleri PASS. Sabit1.99iOS-target Clippy PASS; ilk eski proc-macro önbelleği hatası silmeden ayrı target diziniyle çözüldü. Mevcut build aracıyla arm64device+Simulator paketleme ve11export PASS. Ayrı aynı-agent review yapıldı; bağımsız review değildir.

Gerçek LAN kabul edilmiş socket üzerinden SMB yayın/revoke geçişi, seçili Files bookmark/kalıcı generation bağı, üretim signing/cihaz custody ve fiziksel kabul açık. Test double'ları bu kapıları kapatmaz. Sonraki iş seçili Files yetki/generation bağları; bu köprü için bekleyen onay yok. SMB kapalı.
## B — seçilmeyen alternatif: bu ABI genişlemesini uygulama

Keychain kanıtı korunur; OS LAN/Files sahibi açık kalır, SMB kapalı tutulur. Yeni transport/SDK veya daha gevşek LAN politikası seçilmez.
