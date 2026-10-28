# Android liste4 — seçilmiş host/statik kanıt

[Sonuç ve hash'ler](result.json), [APK ELF64/RELRO](apk-elf64.json),
[SAF/picker](saf-host.txt), [kalıcı SQL](suppression-sql.txt),
[kaynak maliyeti önce](resource-before.txt) / [sonra](resource-after.txt),
[llvm çapraz kontrol](llvm-crosscheck.txt) / [RELRO padding](graphics-padding-crosscheck.txt).

Tekrarlanabilir araçlar tools/check-android-apk.py, tools/test-android-saf.py,
tools/test-android-files-retry.py ve tools/check-android-resource-costs.py.
APK/binary/özel ham log veya tüm .local-evidence eklenmedi.

Gerçek Android emülatör/cihaz/JNI/PC-ACL/Photos runtime ve fiziksel kabul NOT_RUN.
İlk modulo-only RELRO tanılaması tam sözleşme olmadığı için final kararı değildir;
tam LOAD/padding/no-writable-overlap sözleşmesi final52PASS'i destekler.
