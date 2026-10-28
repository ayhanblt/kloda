# Fiziksel Android — sınırlı liste4 başlangıcı

[Sonuç/hash](result.json), [yerel4PASS + UI önkoşulu](local-run-precondition.txt),
[eksik scope güvenli ret](default-scope-guard.txt), [ayrı PID reopen](restart.json).
[Kullanıcı unlock sonrası final5PASS](local-run-final.txt) önceki UI önkoşul
engeline ait sonucu supersede eder; eski çıktı tarihsel olarak korunur.

Yalnız yeni test paketi ve `-e scope local-files` kullanıldı. Günlük profilin
Photos kitaplığı/restore/PC aktarımı çalıştırılmadı. USB serial, ham cihaz/paket
dökümü, arşiv veya anahtar verisi paylaşılmadı.

İlk koşuda FGS başlamadan visible/focus önkoşulu eksikti. Manuel unlock sonrası
dar FGS primitive kontrolü geçti; gerçek native transfer/Expo UI kabulü değildir.
Mac alıcısı signing/readiness engelli, ücretli üyelik yokluğu kullanıcı tarafından
teyit edildi; fiziksel test onayı bunu supersede etmez. Yeni test paketi kaldırıldı.
