#!/bin/sh
# P3-06 FTPS tek, uçtan uca tekrar üretim tarifi (fixture-only, evidence-only; üretim/ürün kaynağı değişmez).
# Kullanım: build-recipe.sh <repo-root>
# Boş sahipli geçici kökten: yeni test PKI + resmi ProFTPD (sabit sürüm, yalnız loopback) → klonda mevcut seçici +
# aynı CA'yı gömen test .so/androidTest APK → yalnız kayıtlı sahipli read-only AVD'de tek normal pozitif transfer →
# alıcı boyut/SHA → başarı, hata, zaman aşımı, INT veya TERM'de tek `finally` temizliği.
# Yaşam döngüsünü (Docker/emülatör/ADB niyet kaydı, mutlak monotonik süre sınırı, temizlik) tek gömülü Python 3 stdlib
# yürütücüsü sahiplenir; kabuk yalnız onu başlatır. Bu dosyaya özel anahtar, parola (testin kamuya açık sabiti
# `probe`/`unused` hariç) veya üretilmiş binary eklenmez. Aidiyet kaydı <geçici kök>/ownership.json (sır içermez).
# Çıkış: 0 yalnız PASS + temizlik sağlam; 1 hata; 2 önkoşul; 3 süre aşımı; 128+N sinyal; 4 CLEANUP_INCOMPLETE (kalan kimlik yazılır).
# Host kapanması / SIGKILL sonrası otomatik temizlik iddiası yok.
# Linkli alt parçalar (reuse): ../ftps-host-representative/proftpd/{proftpd.conf.final,debs-b.sha256,RESULT.md},
#   ../ftps-host-representative/probe.py (ftplib byte+SHA probu; burada yeniden koşulmaz), selector.diff.
set -eu
[ "$#" -eq 1 ] || { echo "usage: $0 <repo-root>" >&2; exit 2; }
HERE="$(cd "$(dirname "$0")" && pwd)"
export KLODA_RECIPE_HERE="$HERE"
exec python3 -I - "$1" <<'PYEOF'
import hashlib, json, os, re, shutil, signal, subprocess, sys, tempfile, time, zipfile

# ---------------------------------------------------------------- sabitler (kayıtlı)
HERE = os.environ["KLODA_RECIPE_HERE"]
EV = os.path.join(HERE, "..")
CONF_FINAL = os.path.join(EV, "ftps-host-representative/proftpd/proftpd.conf.final")
DEBS_SHA = os.path.join(EV, "ftps-host-representative/proftpd/debs-b.sha256")
SELECTOR_DIFF = os.path.join(HERE, "selector.diff")
BASE_DIGEST = "sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852"  # ubuntu:24.04 arm64
PKG_VER = "1.3.8.b+dfsg-1ubuntu0.1"  # proftpd-core + proftpd-mod-crypto
AVD, SERIAL, EMU_PORT = "KlodaFtps16c", "emulator-5590", 5590
PORTS = (27449, 27450, 27451)
HOME = os.path.expanduser("~")
SDK = os.path.join(HOME, "Library/Android/sdk")
NDK = os.path.join(SDK, "ndk/27.1.12297006")
BIN = os.path.join(NDK, "toolchains/llvm/prebuilt/darwin-x86_64/bin")
EMULATOR = os.path.join(SDK, "emulator/emulator")
TC = "1.99.0-aarch64-apple-darwin"
TESTPKG = "com.kloda.sync.test"
APK_REL = "apps/mobile/modules/my-module/android/build/outputs/apk/androidTest/debug/my-module-debug-androidTest.apk"
ATEST = "apps/mobile/modules/my-module/android/src/androidTest"
KT = ATEST + "/java/com/kloda/sync"
ASSET = ATEST + "/assets/kloda-ftps16"
JNI_SYMS = ("Java_com_kloda_sync_FtpsNativeEngine_publishBound", "Java_com_kloda_sync_FtpsNativeEngine_readBound",
            "kloda_ftps_publish_bound", "kloda_ftps_read_bound")
MARKER = "kloda_ftps_owned_fixture_marker"
LABEL_KEY, ROLE_KEY = "kloda.p3-06.ftps", "kloda.p3-06.role"
TMPBASE = os.environ.get("KLODA_RECIPE_TMPBASE", "/private/tmp")


def cap(name, default):  # test düğmeleri süreleri yalnız KISALTABİLİR
    try:
        return min(default, float(os.environ[name])) if os.environ.get(name) else default
    except ValueError:
        return default


TOTAL = cap("KLODA_RECIPE_TOTAL_S", 3600)         # tüm koşu için mutlak monotonik son tarih
BOOT = cap("KLODA_RECIPE_BOOT_S", 300)            # AVD boot son tarihi
QUERY = cap("KLODA_RECIPE_ADB_QUERY_S", 5)        # her ADB boot sorgusu
CALL = cap("KLODA_RECIPE_CALL_S", 30)             # kısa Docker/ADB çağrıları
CLEAN = cap("KLODA_RECIPE_CLEANUP_S", 240)        # temizlik bütçesi (ayrı monotonik saat)
T0 = time.monotonic()
END = T0 + TOTAL


class Fail(Exception):
    code = 1


class Timeout(Fail):
    code = 3


class Interrupted(BaseException):
    def __init__(self, sig):
        self.sig = sig


class Res:
    def __init__(self, rc, out, err):
        self.rc, self.out, self.err = rc, out, err


def killpg(p):
    try:
        os.killpg(p.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        pass


def nap(sec, until):
    """Mutlak `until` tarihini aşmayan uyku: kalan süre uykudan HEMEN önce okunur; kalan sıfırsa uyku yok."""
    rest = until - time.monotonic()
    if rest > 0:
        time.sleep(min(sec, rest))


def run(cmd, cap=None, check=True, out=None, env=None, cwd=None, inp=None, cleanup=False, until=None):
    """Tek alt süreç; kendi süreç grubunda. Çağrı son tarihi TEK monotonik örnekten türer:
    d = min(parent END [cleanup=False ise], until [mutlak, çağıran aşama], now + cap). Göreli süre tekrar tarihe çevrilmez.
    Popen sonrası ve her bloklayan beklemeden önce kalan süre yeniden okunur; taban yok. Süre tükenmişse YENİ komut/bekleme
    yok: yalnız beklemesiz sinyal/poll. İşletim sistemi süreç yaratma gecikmesi geri alınmaz."""
    now = time.monotonic()
    d = float("inf") if cap is None else now + cap
    if until is not None:
        d = min(d, until)
    if not cleanup:
        d = min(d, END)
    if d - now <= 0:
        raise Timeout("no time budget before %s (no command started)" % cmd[0])
    fh = open(out, "wb") if out else None
    if d - time.monotonic() <= 0:              # hazırlık (open) deadline'ı tüketti: aynı d, yeni pencere yok; Popen olmaz
        if fh:
            fh.close()
        raise Timeout("deadline reached while preparing %s (no command started)" % cmd[0])
    try:
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE if inp is not None else subprocess.DEVNULL,
                             stdout=fh if fh else subprocess.PIPE, stderr=subprocess.STDOUT if fh else subprocess.PIPE,
                             env=env, cwd=cwd, start_new_session=True)
    except OSError as e:
        if fh:
            fh.close()
        raise Fail("cannot exec %s: %s" % (cmd[0], e))

    def reap():  # sinyal beklemesiz; kalan süre (yeniden okunur) varsa yalnız o kadar bekle, yoksa poll
        killpg(p)
        rest = d - time.monotonic()
        try:
            if rest > 0:
                p.wait(timeout=rest)
            else:
                p.poll()
        except Exception:
            pass
        for h in (p.stdin, p.stdout, p.stderr):
            try:
                if h:
                    h.close()
            except Exception:
                pass

    try:
        first = d - time.monotonic()           # Popen sonrası yeniden okuma
        if first <= 0:
            reap()                             # bütçe spawn'da bitti: bekleme yok
            raise Timeout("%s: budget consumed by process creation (no wait performed)" % cmd[0])
        try:
            o, e = p.communicate(input=inp.encode() if inp is not None else None, timeout=first * 0.8)
        except subprocess.TimeoutExpired:
            reap()
            raise Timeout("%s timed out (deadline reached)" % cmd[0])
    except BaseException:
        if p.poll() is None:
            reap()
        raise
    finally:
        if fh:
            fh.close()
    r = Res(p.returncode, (o or b"").decode(errors="replace"), (e or b"").decode(errors="replace"))
    if check and r.rc != 0:
        tail = (r.err or r.out)[-300:].strip()
        raise Fail("%s rc=%d %s" % (cmd[0], r.rc, tail))
    return r


# ---------------------------------------------------------------- önkoşul (kaynak yaratmadan)
def preflight(R):
    def abort(msg):
        print("ABORT: " + msg, file=sys.stderr)
        sys.exit(2)
    try:
        if run(["pgrep", "-f", "qemu-system"], CALL, check=False).out.strip():
            abort("emulator already running (not ours)")
        if run(["adb", "devices"], CALL).out.partition("\n")[2].strip():
            abort("adb device present (not ours)")
        for p in PORTS + (EMU_PORT,):
            if run(["lsof", "-nP", "-iTCP:%d" % p, "-sTCP:LISTEN"], CALL, check=False).out.strip():
                abort("port %d busy" % p)
        if run(["docker", "image", "inspect", "ubuntu:24.04", "--format", "{{.Id}}"], CALL).out.strip() != BASE_DIGEST:
            abort("base image differs from recorded")
    except Fail as e:
        abort("preflight tool failure: %s" % e)
    src = open(os.path.join(R, KT, "AndroidFtpsFilesChecks.kt")).read()
    if '"probe"' not in src or '"unused"' not in src:
        abort("test credential contract (probe/unused) changed")
    if not re.search(r"^Pkg.Revision\s*=\s*27\.1\.12297006", open(os.path.join(NDK, "source.properties")).read(), re.M):
        abort("NDK 27.1.12297006 missing")


# ---------------------------------------------------------------- aidiyet kaydı (niyet işlemden ÖNCE yazılır)
W = RUN = None
LEDGER = {"docker": [], "adb": [], "emulator": None, "image": None}
EMU = None            # subprocess.Popen (yalnız bu scriptin başlattığı)
EMU_DEAD = False


def save_ledger():
    with open(os.path.join(W, "ownership.json"), "w") as f:
        json.dump(LEDGER, f, indent=1)


def docker_create(role, flags, image, cmd):
    name = "kloda-p3-06-ftps-%s-%s" % (role, RUN)
    rec = {"name": name, "role": role, "id": None}
    LEDGER["docker"].append(rec)          # benzersiz ad + etiket: oluşturma isteğinden önce kayda girer
    save_ledger()
    r = run(["docker", "create", "--name", name, "--label", "%s=%s" % (LABEL_KEY, RUN), "--label", "%s=%s" % (ROLE_KEY, role),
             "--pull", "never"] + flags + [image] + cmd, CALL)
    cid = r.out.strip().split("\n")[-1].strip()
    if not re.fullmatch(r"[0-9a-f]{12,64}", cid):
        raise Fail("docker create returned no id for %s" % name)
    rec["id"] = cid
    save_ledger()
    return rec


def docker_exit_ok(rec):
    r = run(["docker", "inspect", "--type", "container", "--format", "{{.State.ExitCode}}", rec["id"]], CALL)
    if r.out.strip() != "0":
        raise Fail("container %s exit code %s" % (rec["name"], r.out.strip()))


def docker_resolve(ref, name, role, want_id, until):
    """-> (state, full_id). state: absent | own | foreign | unknown. 'own' yalnız TAM kimlik (64 hex), ad, koşu etiketi ve rol
    birlikte doğrulanırsa (ve create ID döndüyse aynı ID ise)."""
    try:
        r = run(["docker", "inspect", "--type", "container", "--format",
                 '{{.Id}}|{{.Name}}|{{index .Config.Labels "%s"}}|{{index .Config.Labels "%s"}}' % (LABEL_KEY, ROLE_KEY), ref],
                cap=15, until=until, check=False, cleanup=True)
    except Fail:
        return "unknown", ""
    if r.rc != 0:
        return ("absent", "") if re.search(r"no such", r.out + r.err, re.I) else ("unknown", "")
    try:
        cid, nm, lab, rl = r.out.strip().split("|")
    except ValueError:
        return "unknown", ""
    if not re.fullmatch(r"[0-9a-f]{64}", cid):
        return "unknown", cid
    if nm == "/" + name and lab == RUN and rl == role and (want_id is None or want_id == cid):
        return "own", cid
    return "foreign", cid


# ---------------------------------------------------------------- tek temizlik (başarı/hata/INT/TERM)
SIGSEEN = []            # temizlik sırasında gelen INT/TERM (kaydedilir; temizlik kesilmez; PASS verilmez)


def kill_emulator_group(until):
    """Koşulsuz ve SONLU; `until` = mutlak G. TERM/KILL sinyali bekleme gerektirmez (G geçmişse de anında gider); bekleme
    payı her seferinde TEK okumadan `until`'ı aşmayacak şekilde türetilir, kısa uykular `min(aralık, kalan)`. Ölü doğrulanamazsa
    False (çağıran PGID ile CLEANUP_INCOMPLETE yazar)."""
    global EMU_DEAD
    if EMU is None or EMU_DEAD:
        return True
    pgid = EMU.pid

    def alive():
        EMU.poll()
        try:
            os.killpg(pgid, 0)
            return True
        except ProcessLookupError:
            return False
        except PermissionError:
            return True

    def wait_dead(stop):  # `stop` mutlak; her uyku öncesi kalan yeniden okunur
        while alive():
            rest = stop - time.monotonic()
            if rest <= 0:
                break
            time.sleep(min(0.05, rest))
        return not alive()

    if alive():
        for sig, frac in ((signal.SIGTERM, 0.67), (signal.SIGKILL, 0.75)):
            try:
                os.killpg(pgid, sig)
            except (ProcessLookupError, PermissionError):
                pass
            now = time.monotonic()                               # tek örnek: pay bundan türer ve `until`'ı aşmaz
            rest = until - now
            if wait_dead(now + rest * frac if rest > 0 else now):
                break
        rest = until - time.monotonic()                          # reap öncesi yeniden okuma
        try:
            if rest > 0:
                EMU.wait(timeout=rest)
            else:
                EMU.poll()                                       # beklemesiz
        except Exception:
            pass
    dead = not alive()
    if dead:
        EMU_DEAD = True
    return dead


def cleanup():
    """Tek t0 (girişte bir kez). D = t0+CLEAN; grup rezervi E = min(17, CLEAN/3); ADB en geç A = t0+min(ADB_SLICE,(CLEAN-E)/2);
    grup G = A+E; Docker D. Hepsi başta hesaplanır; hiçbir adım yeni bütçe açamaz. Anahtar temizliği bağımsız ve ilk;
    grup adımı ADB'den hemen sonra, sonucu ne olursa olsun denenir. Kalan kimlikleri döndürür."""
    left = []
    t0 = time.monotonic()
    D = t0 + CLEAN
    E = min(17.0, CLEAN / 3.0)
    A = t0 + min(min(15.0, CLEAN / 4.0), (CLEAN - E) / 2.0)
    G = A + E

    def step(label, fn):
        try:
            fn()
        except BaseException as e:  # noqa: BLE001 — bir adım takılsa/patlasa diğerleri denenir
            left.append("%s:%s" % (label, type(e).__name__))

    # 1) yerel özel anahtarlar (yerel, takılmaz; bağımsız)
    def keys():
        for rel in ("pki/ca.key", "pki/server.key", "pki/server.csr", "pki/ca.srl", "conf/server.key"):
            pth = os.path.join(W, rel)
            try:
                os.unlink(pth)
            except FileNotFoundError:
                pass
            if os.path.exists(pth):
                left.append("file:" + pth)
    step("keys", keys)

    # 2a) ADB teardown: yalnız aidiyeti doğrulanmış (bu scriptin canlı süreci + AVD adı) emülatöre; her çağrı ve polling `A`
    def adb_teardown():
        if EMU is None or EMU.poll() is not None or not LEDGER["adb"]:
            return
        try:
            v = run(["adb", "-s", SERIAL, "emu", "avd", "name"], cap=CALL, until=A, check=False, cleanup=True)
        except Fail:
            return  # ADB cevap vermiyor/bütçe yok: dokunma; aidiyetli grup 2b'de kapanır (-read-only emülatörle yok olur)
        if not (v.rc == 0 and v.out.strip().split("\n")[0].strip() == AVD):
            return  # doğrulanamadı: ADB'ye dokunma
        for it in reversed(list(LEDGER["adb"])):
            if it["kind"] == "install":
                cmds = [["adb", "-s", SERIAL, "shell", "pm", "clear", TESTPKG], ["adb", "-s", SERIAL, "uninstall", TESTPKG]]
            else:
                cmds = [["adb", "-s", SERIAL, "reverse", "--remove", "tcp:%d" % it["port"]]]
            for c in cmds:
                try:
                    run(c, cap=10, until=A, check=False, cleanup=True)
                except Fail:
                    pass
        try:  # zarif durdurma da yalnız doğrulanmış emülatöre
            run(["adb", "-s", SERIAL, "emu", "kill"], cap=10, until=A, check=False, cleanup=True)
        except Fail:
            return
        now = time.monotonic()
        stop = min(A, now + 5)                                   # tek örnek; polling `A`'yı aşmaz
        while EMU.poll() is None:
            rest = stop - time.monotonic()                       # her uyku öncesi yeniden okuma; kalan sıfırsa uyku yok
            if rest <= 0:
                break
            time.sleep(min(0.05, rest))
    step("adb-teardown", adb_teardown)

    # 2b) emülatör süreç grubu: ADB sonucu ne olursa olsun; sınır G; doğrulanamazsa PGID ile kalan
    def emulator_group():
        if EMU is not None and not kill_emulator_group(G):
            left.append("emulator-pgid:%d" % EMU.pid)
    step("emulator-group", emulator_group)

    # 3) Docker: inspect → remove → recheck zincirinin HER adımı D taşır; yalnız inspect ile doğrulanan TAM ID'ye `rm -f`
    for rec in reversed(list(LEDGER["docker"])):
        def one(rec=rec):
            nm, rl, known = rec["name"], rec["role"], rec["id"]
            if D - time.monotonic() <= 0:
                left.append("docker:%s:budget-exhausted(%s)" % (nm, known or "id-unknown"))
                return
            st, cid = docker_resolve(known or nm, nm, rl, known, D)
            if st == "absent":
                if known:
                    return  # create ID döndürmüştü; kaynak yok
                # create yanıtı alınamadı: tek NotFound daemon'daki create'in bittiğini göstermez -> temiz DEĞİL
                left.append("docker:%s:create-outcome-unknown(not-found,may-appear-late)" % nm)
                return
            if st == "unknown":
                left.append("docker:%s:unverified" % nm)
                return
            if st == "foreign":
                left.append("docker:%s:foreign:%s(not removed)" % (nm, cid))
                return
            if D - time.monotonic() <= 0:                        # inspect dönüşü D'yi geçti: remove başlatılmaz
                left.append("docker:%s:%s:budget-exhausted(verified-not-removed)" % (nm, cid))
                return
            try:
                run(["docker", "rm", "-f", cid], cap=20, until=D, check=False, cleanup=True)
            except Fail:
                pass
            if D - time.monotonic() <= 0:                        # remove dönüşü D'yi geçti: recheck başlatılmaz
                left.append("docker:%s:%s:rm-unverified(deadline)" % (nm, cid))
                return
            st2, _ = docker_resolve(cid, nm, rl, cid, D)
            if st2 != "absent":
                left.append("docker:%s:%s:%s" % (nm, cid, "rm-unverified" if st2 == "unknown" else "still-present"))
        step("docker:" + rec["name"], one)
    return left


# ---------------------------------------------------------------- yardımcılar
def nm_syms(path, logpath):
    r = run([os.path.join(BIN, "llvm-nm"), "--dynamic", "--defined-only", path], 60)  # rc != 0 -> Fail
    if not r.out.strip():
        raise Fail("llvm-nm empty output: %s" % path)
    open(logpath, "w").write(r.out)
    return {ln.split()[-1] for ln in r.out.splitlines() if ln.strip()}


def need(have, names, where):
    for n in names:
        if n not in have:
            raise Fail("missing symbol %s in %s" % (n, where))


def sha256(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def apply_selector(kt):
    p = os.path.join(kt, "AndroidFtpsFilesChecks.kt")
    s = open(p).read()
    a = "fun run(instrumentation: Instrumentation, root: File) {"
    assert s.count(a) == 1
    s = s.replace(a, "fun run(instrumentation: Instrumentation, root: File, positiveOnly: Boolean = false) {", 1)
    b = "        check(journal.state(complete).completed && journal.state(complete).step == 3)\n"
    assert s.count(b) == 1
    s = s.replace(b, b + '        if (positiveOnly) { println("FTPS_POSITIVE_REMOTE=android-owned-$unique-complete.bin"); return }\n', 1)
    open(p, "w").write(s)
    p = os.path.join(kt, "AndroidFilesQueueRecoveryInstrumentation.kt")
    s = open(p).read()
    a = '"ftps-files", '
    assert a in s and '"ftps-files-positive"' not in s
    s = s.replace(a, '"ftps-files", "ftps-files-positive", ', 1)
    c = '      if (scope == "ftps-files" || scope == "ftps-sources") {\n'
    assert s.count(c) == 1
    s = s.replace(c, '      if (scope == "ftps-files-positive") {\n'
                     '        group("ftps-owned-positive") { AndroidFtpsFilesChecks.run(this, scratch, positiveOnly = true) }\n'
                     '        finish(Activity.RESULT_OK, Bundle().apply { putString("stream", "FTPS owned positive publication PASS\\n") }); return\n'
                     '      }\n' + c, 1)
    open(p, "w").write(s)


ENTRY = """#!/bin/sh
set -e
mkdir -p /srv/ftp/upload /var/log/proftpd /var/run/proftpd
id kloda_probe >/dev/null 2>&1 || useradd -d /srv/ftp/upload -s /bin/sh kloda_probe   # konfigin `User` süreç kimliği (parolasız/kilitli)
id probe >/dev/null 2>&1 || useradd -d /srv/ftp/upload -s /bin/sh probe                # Android test sabiti
echo "probe:unused" | chpasswd
chown probe /srv/ftp/upload
exec proftpd -n -c /run/kloda/proftpd.conf
"""
INSTALL_SH = """set -eu
DEBIAN_FRONTEND=noninteractive dpkg -i /debs/*.deb > /tmp/dpkg.out 2>&1 || { tail -20 /tmp/dpkg.out; exit 1; }
for p in proftpd-core proftpd-mod-crypto; do
  [ "$(dpkg-query -W -f='${db:Status-Status}' "$p")" = installed ] || { echo "not configured: $p"; exit 1; }
  dpkg-query -W "$p"
done
ls /usr/lib/proftpd | grep -x mod_tls.so
"""


# ---------------------------------------------------------------- ana akış
def start_emulator(logpath):
    """Doğrudan emülatör başlatma (ayrı süreç grubu). Niyet önce kayda girer; log handle'ı ve sinyal maskesi hazırlığından SONRA,
    Popen hemen öncesinde parent END aynen yeniden kontrol edilir (yeni pencere yok; süreç yaratma gecikmesi için garanti yok).
    Her çıkış yolunda eski sinyal maskesi geri yüklenir ve handle kapanır; handler'lara dokunulmaz."""
    global EMU
    LEDGER["emulator"] = {"avd": AVD, "serial": SERIAL, "pid": None}
    save_ledger()
    unblock = lambda: signal.pthread_sigmask(signal.SIG_UNBLOCK, {signal.SIGINT, signal.SIGTERM})  # noqa: E731  (yalnız çocuk)
    logf, old = None, None
    try:
        logf = open(logpath, "wb")
        old = signal.pthread_sigmask(signal.SIG_BLOCK, {signal.SIGINT, signal.SIGTERM})  # Popen→atama arası sinyal penceresi yok
        if END - time.monotonic() <= 0:        # hazırlık parent deadline'ını tüketti: Popen olmaz
            raise Timeout("parent deadline reached before emulator spawn (no process started)")
        EMU = subprocess.Popen([EMULATOR, "-avd", AVD, "-read-only", "-port", str(EMU_PORT), "-no-window", "-no-audio",
                                "-no-boot-anim", "-no-snapshot-save"], stdin=subprocess.DEVNULL, stdout=logf,
                               stderr=subprocess.STDOUT, start_new_session=True, preexec_fn=unblock)
        LEDGER["emulator"]["pid"] = EMU.pid
    finally:
        try:
            if logf is not None:
                logf.close()        # önce handle (sinyaller hâlâ bloklu); close hata verse de maske aşağıda restore edilir
        finally:
            if old is not None:     # bekleyen INT/TERM yalnız burada teslim olur: close zaten denenmiş/tamamlanmış
                signal.pthread_sigmask(signal.SIG_SETMASK, old)   # eski maske (UNBLOCK ile varsayma yok)
    save_ledger()


def wait_ready(ca, logpath, ready_end):
    """Host readiness: sorgu ve uyku doğrudan MUTLAK ready_end alır; tüketilmişse yeni sorgu/uyku yok."""
    while True:
        try:
            r = run(["openssl", "s_client", "-connect", "localhost:27449", "-starttls", "ftp", "-CAfile", ca,
                     "-verify_hostname", "localhost", "-verify_return_error"], cap=10, until=ready_end, check=False, inp="QUIT\n")
            open(logpath, "w").write(r.out + r.err)
            if r.rc == 0 and re.search(r"Verification: OK|Verify return code: 0", r.out + r.err):
                return
        except Timeout:
            pass  # sorgu kendi tarihini tüketti; aşağıdaki kontrol yeni sorgu/uykuyu keser
        if ready_end - time.monotonic() <= 0:
            raise Fail("service not reachable with verified TLS on 27449")
        nap(1, ready_end)


def wait_boot(boot_end):
    """AVD boot: her sorgu ve polling uykusu doğrudan MUTLAK boot_end alır; tüketilmişse yeni sorgu/uyku yok."""
    while True:
        if EMU.poll() is not None:
            raise Fail("emulator exited early rc=%s" % EMU.returncode)
        if boot_end - time.monotonic() <= 0:
            raise Timeout("AVD boot deadline exceeded (window %.0fs, parent deadline %.0fs)" % (BOOT, TOTAL))
        try:
            r = run(["adb", "-s", SERIAL, "shell", "getprop", "sys.boot_completed"], cap=QUERY, until=boot_end, check=False)
            if r.rc == 0 and r.out.strip() == "1":
                return
        except Timeout:
            pass  # askıda sorgu kendi tarihinde öldürüldü; boot_end içinde yeniden dene
        nap(2.0, boot_end)


def pipeline(R):
    global EMU
    L = lambda n: os.path.join(W, "logs", n)  # noqa: E731
    pki = lambda n: os.path.join(W, "pki", n)  # noqa: E731
    IMG = "kloda-p3-06-ftps-pro:%s" % RUN
    LEDGER["image"] = IMG

    # 1) yeni test PKI
    run(["openssl", "req", "-x509", "-newkey", "rsa:3072", "-nodes", "-keyout", pki("ca.key"), "-out", pki("ca.pem"), "-days", "3",
         "-subj", "/CN=kloda-p3-06-test-ca", "-addext", "basicConstraints=critical,CA:TRUE,pathlen:0",
         "-addext", "keyUsage=critical,keyCertSign,cRLSign", "-addext", "subjectKeyIdentifier=hash"], 120)
    run(["openssl", "req", "-newkey", "rsa:2048", "-nodes", "-keyout", pki("server.key"), "-out", pki("server.csr"),
         "-subj", "/CN=localhost"], 120)
    open(pki("ext.cnf"), "w").write("subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\n"
                                    "keyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n"
                                    "subjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always\n")
    run(["openssl", "x509", "-req", "-in", pki("server.csr"), "-CA", pki("ca.pem"), "-CAkey", pki("ca.key"), "-CAcreateserial",
         "-out", pki("server.pem"), "-days", "2", "-extfile", pki("ext.cnf")], 120)
    run(["openssl", "verify", "-x509_strict", "-CAfile", pki("ca.pem"), "-verify_hostname", "localhost", pki("server.pem")], 60)
    print("CA_FILE_SHA256=" + sha256(pki("ca.pem")))

    # 2a) indirme (ağlı, geçici, aidiyetli)
    acq = docker_create("acq", ["-v", "%s/debs:/out" % W], "ubuntu:24.04", [
        "sh", "-c", "set -e; apt-get update -qq >/dev/null; apt-get install --download-only --no-install-recommends -y -qq "
                    "proftpd-core=%s proftpd-mod-crypto=%s >/dev/null; cp /var/cache/apt/archives/*.deb /out/" % (PKG_VER, PKG_VER)])
    run(["docker", "start", "-a", acq["id"]], 900, out=L("acquire.log"))
    docker_exit_ok(acq)
    want = {}
    for ln in open(DEBS_SHA):
        if ln.strip():
            h, n = ln.split()
            want[n] = h
    have = {n: sha256(os.path.join(W, "debs", n)) for n in os.listdir(os.path.join(W, "debs")) if n.endswith(".deb")}
    if have != want:  # sapma = dur (sessiz fallback yok)
        raise Fail(".deb set differs from recorded debs-b.sha256")

    # 2b) kurulum --network none; dpkg başarısızsa commit yok
    inst = docker_create("inst", ["--network", "none", "-v", "%s/debs:/debs:ro" % W], "ubuntu:24.04", ["sh", "-c", INSTALL_SH])
    run(["docker", "start", "-a", inst["id"]], 600, out=L("install.log"))
    docker_exit_ok(inst)
    run(["docker", "commit", "--change", "LABEL %s=%s" % (LABEL_KEY, RUN), inst["id"], IMG], 120)

    # 3) sunucu: create + start ayrı
    shutil.copy(CONF_FINAL, os.path.join(W, "conf/proftpd.conf"))
    for n in ("server.pem", "server.key"):
        shutil.copy(pki(n), os.path.join(W, "conf", n))
    open(os.path.join(W, "conf/entry.sh"), "w").write(ENTRY)
    os.chmod(os.path.join(W, "conf/entry.sh"), 0o755)
    for n in ("server.key", "proftpd.conf"):
        os.chmod(os.path.join(W, "conf", n), 0o600)
    flags = []
    for p in PORTS:
        flags += ["-p", "127.0.0.1:%d:%d" % (p, p)]
    srv = docker_create("srv", flags + ["-v", "%s/conf:/run/kloda:ro" % W], IMG, ["/run/kloda/entry.sh"])
    run(["docker", "start", srv["id"]], CALL)
    # host kontrolü: gerçek CA + hostname doğrulamalı explicit AUTH TLS (byte+SHA probu reuse: ftps-host-representative/probe.py)
    wait_ready(pki("ca.pem"), L("host-tls.log"), min(time.monotonic() + 30, END))

    # 4) klon + mevcut seçici + aynı CA ile test .so
    clone = os.path.join(W, "clone")
    run(["cp", "-cR", R, clone], 900)
    apply_selector(os.path.join(clone, KT))
    applied = []
    for f in ("AndroidFtpsFilesChecks.kt", "AndroidFilesQueueRecoveryInstrumentation.kt"):
        d = run(["diff", "-u", os.path.join(R, KT, f), os.path.join(clone, KT, f)], 60, check=False)
        if d.rc not in (0, 1):
            raise Fail("diff failed rc=%d" % d.rc)
        applied += [ln for ln in d.out.splitlines() if re.match(r"^[+-][^+-]", ln)]
    recorded = [ln for ln in open(SELECTOR_DIFF).read().splitlines() if re.match(r"^[+-][^+-]", ln)]
    if applied != recorded:
        raise Fail("applied selector differs from recorded selector.diff")
    der = os.path.join(W, "android-so/test-ca.der")
    run(["openssl", "x509", "-in", pki("ca.pem"), "-outform", "DER", "-out", der], 60)
    env = dict(os.environ)
    env.update(RUSTC=run(["rustup", "which", "--toolchain", TC, "rustc"], 60).out.strip(),
               RUSTDOC=run(["rustup", "which", "--toolchain", TC, "rustdoc"], 60).out.strip(),
               KLODA_FTPS_FIXTURE_CA_DER=der,
               CC_aarch64_linux_android=os.path.join(BIN, "aarch64-linux-android24-clang"),
               AR_aarch64_linux_android=os.path.join(BIN, "llvm-ar"),
               CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER=os.path.join(BIN, "aarch64-linux-android24-clang"))
    run(["rustup", "run", TC, "cargo", "build", "--locked", "--offline", "--lib", "--release", "--manifest-path",
         os.path.join(clone, "packages/ftps-native/Cargo.toml"), "--features", "android-jni,owned-fixture",
         "--target", "aarch64-linux-android", "--target-dir", os.path.join(W, "android-so/target")], 1500, out=L("build-so.log"), env=env)
    so = os.path.join(W, "android-so/target/aarch64-linux-android/release/libkloda_ftps_native.so")
    need(nm_syms(so, L("nm-test-so.txt")), JNI_SYMS + (MARKER,), "test .so")  # tüm export'lar + fixture marker
    asset = os.path.join(clone, ASSET)
    so_sha = sha256(so)
    shutil.copy(so, os.path.join(asset, "libkloda_ftps_native.so"))
    open(os.path.join(asset, "sha256.txt"), "w").write(so_sha)
    open(os.path.join(asset, "hostname.txt"), "w").write("localhost")

    # 5) androidTest APK (yalnız klonda)
    run(["./gradlew", ":my-module:assembleDebugAndroidTest", "-PklodaSmbNative=true", "-PklodaSftpNative=true", "-PklodaFtpsNative=true",
         "-PklodaS3Native=true", "-PreactNativeArchitectures=arm64-v8a", "--console=plain", "--offline"],
        2400, out=L("build-androidtest.log"), cwd=os.path.join(clone, "apps/mobile/android"))
    apk = os.path.join(clone, APK_REL)
    want_entries = ("assets/kloda-ftps16/libkloda_ftps_native.so", "assets/kloda-ftps16/sha256.txt",
                    "assets/kloda-ftps16/hostname.txt", "lib/arm64-v8a/libkloda_ftps_native.so")
    xdir = os.path.join(W, "apkx")
    with zipfile.ZipFile(apk) as z:  # liste/çıkarma hatası = istisna = Fail yolu
        names = set(z.namelist())
        open(L("apk-list.txt"), "w").write("\n".join(sorted(names)) + "\n")
        for e in want_entries:
            if e not in names:
                raise Fail("APK entry missing: " + e)
            z.extract(e, xdir)
    a = os.path.join(xdir, "assets/kloda-ftps16")
    if sha256(os.path.join(a, "libkloda_ftps_native.so")) != so_sha:
        raise Fail("APK asset .so != built test .so")
    if open(os.path.join(a, "sha256.txt")).read() != so_sha:
        raise Fail("APK sha256.txt receipt != built test .so")
    if open(os.path.join(a, "sha256.txt"), "rb").read() != open(os.path.join(asset, "sha256.txt"), "rb").read():
        raise Fail("APK receipt != clone receipt")
    if open(os.path.join(a, "hostname.txt"), "rb").read() != b"localhost":
        raise Fail("APK hostname.txt != localhost")
    d = open(der, "rb").read()
    if len(d) <= 100 or d not in open(os.path.join(a, "libkloda_ftps_native.so"), "rb").read():
        raise Fail("test CA not embedded in APK asset .so")
    need(nm_syms(os.path.join(a, "libkloda_ftps_native.so"), L("nm-apk-asset.txt")), JNI_SYMS + (MARKER,), "APK asset .so")
    prod = nm_syms(os.path.join(xdir, "lib/arm64-v8a/libkloda_ftps_native.so"), L("nm-apk-prod.txt"))
    need(prod, JNI_SYMS, "APK production lib")
    if MARKER in prod:
        raise Fail("production lib carries fixture marker")
    print("APK_SHA256=" + sha256(apk))

    # 6) kayıtlı sahipli read-only AVD: tek monotonik boot son tarihi; emülatör ayrı süreç grubunda
    start_emulator(L("emulator.log"))
    wait_boot(min(time.monotonic() + BOOT, END))
    if run(["adb", "-s", SERIAL, "shell", "getprop", "ro.product.cpu.abi"], QUERY + 10).out.strip() != "arm64-v8a":
        raise Fail("AVD is not arm64-v8a")
    LEDGER["adb"].append({"kind": "install"})  # niyet işlemden ÖNCE
    save_ledger()
    run(["adb", "-s", SERIAL, "install", "-r", "-t", apk], 300)
    run(["adb", "-s", SERIAL, "shell", "pm", "clear", TESTPKG], CALL)
    for p in PORTS:
        LEDGER["adb"].append({"kind": "reverse", "port": p})  # niyet işlemden ÖNCE
        save_ledger()
        run(["adb", "-s", SERIAL, "reverse", "tcp:%d" % p, "tcp:%d" % p], CALL)
    run(["adb", "-s", SERIAL, "shell", "am", "instrument", "-w", "-r", "-e", "scope", "ftps-files-positive",
         TESTPKG + "/com.kloda.sync.AndroidFilesQueueRecoveryInstrumentation"], 600, out=L("run-ftps-files-positive.log"))
    log = open(L("run-ftps-files-positive.log"), errors="replace").read()
    if "PASS ftps-owned-positive" not in log or "INSTRUMENTATION_CODE: -1" not in log:
        raise Fail("instrumentation did not report PASS / code -1")

    # 7) alıcı ölçütü: tek dosya, 1048576 B, beklenen sentetik SHA-256 (fiş testin içinde: completed && step==3)
    exp = hashlib.sha256(bytes(i % 251 for i in range(1048576))).hexdigest()
    r = run(["docker", "exec", srv["id"], "sh", "-c",
             'cd /srv/ftp/upload; [ "$(ls android-owned-*-complete.bin | wc -l)" -eq 1 ] && '
             'for f in android-owned-*-complete.bin; do stat -c "%s %n" "$f"; sha256sum "$f"; done'], CALL * 2)
    open(L("receiver-readback.txt"), "w").write(r.out)
    lines = r.out.strip().splitlines()
    if len(lines) != 2 or not re.fullmatch(r"1048576 android-owned-\S+-complete\.bin", lines[0]) or lines[1].split()[0] != exp:
        raise Fail("receiver size/SHA mismatch")


ARMED = False


def main():
    global W, RUN, ARMED
    if len(sys.argv) != 2:
        sys.exit(2)
    R = sys.argv[1]
    preflight(R)
    W = tempfile.mkdtemp(prefix="kloda-p3-06-ftps-run.", dir=TMPBASE)
    os.chmod(W, 0o700)
    os.umask(0o077)
    RUN = re.sub(r"[^a-z0-9]", "", W.rsplit(".", 1)[-1].lower())
    for d in ("pki", "conf", "debs", "logs", "android-so"):
        os.makedirs(os.path.join(W, d))

    def on_signal(sig, _frame):
        global ARMED
        if ARMED:           # tek seferlik: pipeline'ı keser; sonrası yalnız kayıt (temizlik ASLA kesilmez)
            ARMED = False
            raise Interrupted(sig)
        SIGSEEN.append(sig)
    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)
    rc, reason, left = 0, None, []
    t_pipe = time.monotonic()
    try:
        ARMED = True
        try:
            pipeline(R)
        except Interrupted as e:
            rc, reason = 128 + e.sig, "interrupted by signal %d" % e.sig
        except Fail as e:
            rc, reason = e.code, "%s: %s" % (type(e).__name__, e)
        except Exception as e:  # noqa: BLE001
            rc, reason = 1, "%s: %s" % (type(e).__name__, e)
        finally:
            ARMED = False
    except Interrupted as e:  # pencere: pipeline bitti ama iç except/finally gövdesinde kesildi
        rc, reason = rc or 128 + e.sig, reason or "interrupted by signal %d" % e.sig
    finally:
        ARMED = False
        t_clean = time.monotonic()
        left = cleanup()
        print("PIPELINE_ELAPSED=%.1fs (budget %.0fs) CLEANUP_ELAPSED=%.1fs (budget %.0fs)"
              % (t_clean - t_pipe, TOTAL, time.monotonic() - t_clean, CLEAN))
    if SIGSEEN:  # temizlik sırasında sinyal: kaydedildi, temizlik sürdü; PASS ASLA
        reason = reason or "signal %d received during cleanup (cleanup was not interrupted)" % SIGSEEN[0]
        rc = rc or 128 + SIGSEEN[0]
    if reason:
        print("FAILED: " + reason, file=sys.stderr)
    if left:
        print("CLEANUP_INCOMPLETE remaining=%s root=%s" % (json.dumps(left), W), file=sys.stderr)
        sys.exit(4)
    print("CLEANUP_DONE root=%s (loglar/public CA/klon/ownership.json duruyor; imaj %s; silme: docker rmi %s; rm -rf '%s')"
          % (W, LEDGER["image"], LEDGER["image"], W))
    if rc == 0:
        print("FTPS_POSITIVE_RECIPE_PASS root=%s" % W)
    sys.exit(rc)


main()
PYEOF
