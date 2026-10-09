# Upstream byte signer — iç source/policy karar notu

- Tarih: 2026-10-06
- Statü: bounded duplicate/contribution kontrolü tarihsel teslim; [ADR0013](../decisions/0013-qr-based-local-lan-pairing.md) sonrası **archival/non-actionable**. Matrix/upstream signer/contribution/fork current product task, TODO veya gate değildir; publication/supported SDK API acceptance yok.
- Bu belge Kloda repo içi kaynak/karar kaydıdır. Upstream'a gönderilecek metin değildir; copy/paste issue/comment/PR body olarak kullanılmaz. İnsan yazarlığı veya upstream contribution review yapıldığı iddia edilmez.

## Somut engel

[CONTRIBUTING AI policy](https://github.com/matrix-org/matrix-rust-sdk/blob/b18166c68bb958a21f0bca8b2d8320cb53583362/CONTRIBUTING.md#ai-policy) §1 AI yardımı/suggestion motivasyonu dâhil disclosure; §2 lisans hakkını doğrulama effort; §3 submitting human accountability ister. §4 insanın okuyacağı issue/comment/PR/commit/docs/code-comment iletişiminin AI-generated olmamasını, §5 general AI review olmamasını, §6 autonomous-looking/agent/vibe-coding katkı yapılmamasını şart koşar. Machine translation/grammar exception AI-authored technical issue taslağını uygun hâle getirmez.

Parent [current CONTRIBUTING path last-change metadata](https://api.github.com/repos/matrix-org/matrix-rust-sdk/commits?path=CONTRIBUTING.md&per_page=1)'da `ef565f18b5bb4efbfc7b5f95e7ce023d743e05a6` (2026-06-23) gördü; SDK0.19.1 baseline pinned file da aynı policy metnini içerir. GitHub metadata bu submission'ın policy/legal approval'ı veya independent signature verification değildir.

**Karar sınırı:** AI-generated sendable body hazırlanmadı/yayımlanmadı; paraphrase veya disclosure atlayarak human authorship gibi sunulmaz. Future optional upstream iletişimi human independent sources/authorship, disclosure ve license/accountability gerektirir; human review yapılmadı. Bu contribution kuralı Kloda repo içi Codex workflow'u değiştirmez. Kloda auth ayrı P-256 identity'ye geçtiği için upstream communication veya SDK fork artık required product adımı değildir.

## Duplicate kontrolü — sınırlı arama, absence proof değil

Aşağıdaki GitHub issue search çağrıları read-only çalıştı; state filtresi yok, issue+PR kapsamı. Search lexical sonuçları incomplete=false; repository code/main scan veya maintainers' discussion room taraması değil.

| Query | Gözlenen sonuç | Limit |
| --- | --- | --- |
| [sign_bytes / device signer / TLS sign](https://api.github.com/search/issues?q=repo%3Amatrix-org%2Fmatrix-rust-sdk%20%28%22sign_bytes%22%20OR%20%22device%20signer%22%20OR%20%22TLS%20sign%22%29&per_page=10) | total_count0 | Bu index/query için; public supported API veya duplicate hiç yok iddiası değil |
| [arbitrary bytes / raw signing / CertificateVerify](https://api.github.com/search/issues?q=repo%3Amatrix-org%2Fmatrix-rust-sdk%20%28%22arbitrary%20bytes%22%20OR%20%22raw%20signing%22%20OR%20%22CertificateVerify%22%29&per_page=10) |2 hit: PR5817 room-event type load, PR4035 sliding-sync share_pos | Title/body'de talep edilen device binary signer değil; comments/index broad match olabilir |
| [in:title,body sign bytes](https://api.github.com/search/issues?q=repo%3Amatrix-org%2Fmatrix-rust-sdk%20in%3Atitle%2Cbody%20sign%20bytes&per_page=10) |8 hit:6986/6976 serde media bytes;7033 timeline method;5200 restored-session key upload;6826 IndexedDB Uint8Array;5939 QR bytes;4500 migration byte handling;5134 EncryptionInfo Arc |8 title/metadata candidate görülüp farklı konu kategorileri ayrıldı; relevant exact device-only byte callback request bulunmadı. Bütün comments/code incelenmiş sayılmaz |

Bounded check'te doğrudan duplicate saptanmadı; human submission öncesi güncel duplicate/discussion kontrolü ayrıca yapılır. Yanlış lexical matches SDK implementation veya sign support kanıtı olarak kullanılmadı.

## Contribution route kaynakları

- [Pinned CONTRIBUTING chat rooms](https://github.com/matrix-org/matrix-rust-sdk/blob/b18166c68bb958a21f0bca8b2d8320cb53583362/CONTRIBUTING.md#chat-rooms): potential changes/direction için development room önerilir. Human bu route'u policy'ye uygun kullanabilir; agent oda/issue mesajı göndermedi.
- [Pinned PR template](https://github.com/matrix-org/matrix-rust-sdk/blob/b18166c68bb958a21f0bca8b2d8320cb53583362/.github/pull_request_template.md): public API changelog checkbox, AI-help checkbox, Signed-off-by. AI checkbox iletişim/agent-mode yasaklarına waiver değildir.
- [Sign off](https://github.com/matrix-org/matrix-rust-sdk/blob/b18166c68bb958a21f0bca8b2d8320cb53583362/CONTRIBUTING.md#sign-off): DCO contributor identity/rights declaration; isim/email veya sign-off burada uydurulmadı. Issue discussion ile code PR signoff aynı requirement diye sunulmadı.
- [Writing changelog entries](https://github.com/matrix-org/matrix-rust-sdk/blob/b18166c68bb958a21f0bca8b2d8320cb53583362/CONTRIBUTING.md#writing-changelog-entries): future accepted code API change için crate towncrier fragment ve PR number/type. Burada upstream code, PR numarası veya placeholder changelog yaratılmadı.

## Teknik girdi hazır; katkı ve supported source ayrı

Önceki SDK byte-signing proposal [dar prerequisite'in historical bölümünde](native-peer-session-prerequisite.md#historical-upstream-api-proposal--non-actionable-archive) sınıflandırıldı. ADR0011 owned in-process query yönünü, ADR0012 P-256 identity'yi korur; ADR0013 Matrix/SAS ve key binding'i current pairing path'ten çıkarır. Requirements yalnız archive technical input'tur; yeni upstream research/task açılmaz.

Current checkpoint [frozen KLODA-QR-PAIR-V1](../security/qr-pairing-v1-protocol.md) + [future-only QR roadmap](qr-pairing-implementation-roadmap.md): actual mutual TLS P-256 possession/QR PC SPKI equality, same-channel secret proof, PC approval/durable pins ve ACK recovery. Protocol bytes/minimum native behavior frozen; actual platform API/ABI/adoption/integration unverified, product pairing not implemented. Backend-independent trust file authority değildir. Android device-local signer scoped CLOSED/PASS diğer LAN/platform/authority gate'lerini kapatmaz. Eski corpus veya upstream API beklenmez; bu tur native/feasibility execution yok.

## Verification sınırı

Gerçek GitHub read-only search/contribution metadata çağrıları gözlendi; yeni signing/TLS runtime, private key/source media, production credential veya upstream publication yok. Ayrı internal Kloda pass source/privacy, no AI-body-as-human, no fabricated DCO/license/absence/readiness ve contribution review ayrımını kontrol etti. Documentation smoke75 relative link/13 anchor pass;6 selected source/document hash + exact result capsule extract/restore pass. Evidence `.local-evidence/archives/upstream-byte-policy-2026-10-06.*`, archive SHA256 `864a88efaa9f08875f542d3867a508603cd5b98738e00b2847c814a5b4659b81`; checkpoint bu verification satırından önce alındı. Bu AI pass upstream human contribution review değildir. Önceki source-only ve native/physical gate ayrımları korunur.
