# FIX-R4 — kota kesintisi sonrası dar Sonnet devri

## Durum ve tek hedef

KISMİ / review-ready değil. Aynı onaylı D25-M FIX-R4 tamamlanacak; yeniden INITIAL
başlatma. Ana model Sonnet 5.5, son oturum effort `medium`; eski uzun transcript'i
taşıma. Eski oturum `ses_e12419b36ffeFqxl6FsfQ6vTjM` bu işi eşzamanlı sürdürmesin.
Yeni sohbet, kullanıcı onaylı büyük bağlam devridir; kabul/sayaç sıfırlamaz.
Başlangıç HEAD `508b3f0486a7ce04628ec0c3681d995573e5721d`.

Tek sözleşme: `docs/implementation/plans/next-plan.md` §FIX-R4 onaylı DECISION
(1180–1201 durum tablosu ve dar doğrulama). Son review: aynı evidence kökünün
`review.md` §FIX-R3 engelleyici bulgular (188–190). Yalnız G25-R1/R2/R4;
R3/R5'i yeniden açma. INITIAL ret=1; R1/R2/R4 başarısız FIX=3, R3 geçmiş=2.
FIX-R4 kullanıcı tarafından ayrıca onaylıdır; bu kesinti yeni başarısız review değildir.

## Diske yazılmış yarım uygulama

16 dosyanın FIX-R4 baseline kopyası, FIX-R3 final hash setiyle 16/16 eşleşti.
Bu dizindeki `source.sha256` güncel 16 dosyayı, `partial-vs-r3.diff` yedi değişen
dosyayı, `snapshot.json` zaman/HEAD/satır sayılarını kaydeder. Başlangıçta bu hash'leri
dar doğrula; fark varsa yalnız değişen alanı incele. Baseline'ı yeniden alma/ezme.

- `tools/capture-ui.py`: canlı `Interrupts` nesnesi ve `_settle` tek commit yolu.
- `tools/ui-capture/supervision.py`: `Interrupts.commit`, `_persist_strays`,
  sinyal öncesi kaçakları kalıcılaştırma.
- `desktop.py`: boş launch gözlemi artık `gone` yapmıyor; intent açık.
- `common.py`: boş PLTE reddi; phase sunucusu `ios.py` içine taşındı.
- `test_capture.py`, `test_supervision.py`: yeni karşıtlar ve birleştirilmiş testler.
Bu liste uygulama varlığını gösterir; doğru/kabul edilmiş olduğu iddiası değildir.
`ios_build.py`, fixture tarifi, matrix üçlüsü ve mobile capture kaynakları byte-aynı.

## Cihazsız kanıt — 19.11

`finalized()` test fixture selection düzeltildi. Güncel `../logs/unittest-final.{log,exit}`
68/68 OK, exit 0; `source-final.sha256` 16/16 eşleşti. Bu suite tekrar koşulmaz.
Desktop cleanup/iOS phase temsilci ve resume NOT_RUN; sıradaki iş §Kalan doğrulama
ve devir. Aşağıdaki 1 FAIL tarihi kayıt, aktif talimat değil.

### Önceki kesinti kaydı

Son kayıt `../logs/unittest.log`: **68 test / 1 FAIL / 19.996 s**,
`../logs/unittest.exit`: **1**. Bu audit test çalıştırmadı; log için kaynak hash'i
önceden kaydedilmemiş olduğundan yeni kaynakların PASS'i olarak kullanılmaz.
Tek hata:
`FinalizationTests.test_offline_cleanup_cannot_confirm_and_a_confirmed_result_survives_it`
(`tools/ui-capture/test_supervision.py:114–124`):
beklenen `(0, 'PASS')`, gerçek `(1, 'FAIL')`.

Önce bu birleşik testin ikinci senaryosunun kayıt/cleanup state izolasyonunu ve
`finalized` → `_settle` → public cleanup yolunu incele. Test state hatası mı üretim
hatası mı henüz kanıtlanmadı; beklenen onaylı sonucu gevşetme. Dar yeniden üretim:
`python3 -I -B -m unittest discover -s tools/ui-capture -p 'test_supervision.py' -k test_offline_cleanup_cannot_confirm_and_a_confirmed_result_survives_it`
Tam stdout/stderr ve asıl exit code'u mevcut `fix-r4/logs/` içine ayrı adla kaydet.
Kök neden → minimum fix → bu yol ve onaysız offline komşu; sonra gerekli tek suite.

## Satır sınırı: güncel engel yok

Boş/yorum hariç: test_supervision **299**, test_capture **292**, CLI **289**,
ios **288**, common **227**, supervision **178**, desktop **251**. JSON envanteri
Python/TS 300 satır kod sınırına katılmadı. Geçici `test_scratch_r4.py` artık yok.
Yeni dosya/kapsam izni isteme; tekrar sırf satır kazanmak için testleri sıkıştırma.
Gerçek gerekli ekleme temiz biçimde sığmazsa o zaman somut kapsam kararı getir.

Test sayısı FIX-R3'te 72, son koşuda 68: birleştirme tek başına kapsam kaybı değildir.
Ancak baseline ile değişen assertion'ları hedefli eşle: özellikle yabancı grup üyesi,
lost supervisor/recovered run, receipt'ler ve normal/offline finalizasyon. Çıkarılan
test adlarını otomatik gereksiz sayma; eşdeğer kanıt yoksa ilgili korumayı geri getir.

## Kalan doğrulama ve devir

Onay tablosunun kesinti kararının iki yanı, write failure/SIGKILL, write-ahead
kaçak+iki retry, sıfır sinyal, belirsiz launch ve boş/geçerli palet karşıtlarını
mevcut testlere eşle. Başarılı etkilenmeyen kontrolleri yeniden başlatma.
Saf kontrol geçmeden native/temsilci koşuya geçme. Değişen Desktop cleanup ve
iOS phase taşıması için gereken dar temsilci/resume'u seç; mevcut fixture'ı kullan,
yeni native rebuild veya tam matris açma. Nihai kaynak hash/diff ve logları kaydet.
Faz3 görselleri, F1 fix2, FO1 Faz4, step19/OS/fiziksel/release kapıları korunur.
Tamamlanınca checkbox açık, aynı GPT review sohbetine kısa devir; self-review kabul
değildir. Ürün kodu/dependency/commit/push yok. Hassas işi Haiku'ya devretme.
