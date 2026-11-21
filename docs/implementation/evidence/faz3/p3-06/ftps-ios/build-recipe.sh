#!/bin/sh
# P3-06 iOS Simulator tek evidence tarifi (fixture-only; üretim/ürün kaynağı, canlı ağaç ve Android tarifi değişmez).
#   build-recipe.sh <repo-root> compile            IOS-FTPS-1: yeni test PKI + ayrılmış klon + test .a + fixture app COMPILE/LINK (offline)
#   build-recipe.sh <repo-root> relink  <kök>      aynı kök/app/nonce: yalnız fixture app yeniden derleme+bağlama (Rust/PKI/.a tekrarı yok)
#   build-recipe.sh <repo-root> run     <kök>      IOS-FTPS-2/3: sahipli ProFTPD + sahipli Simulator + 2 gerçek picker + reopen + cleanup modu
# `compile`/`relink` Simulator/servis/Docker/ağ BAŞLATMAZ. `run` yalnız açık onayla çalıştırılır.
# Fixture app yaması yalnız KLONDA uygulanır: mevcut Files fixture app'ine `cleanup` modu (Keychain: tam generic-password kimliği
# `<bundle>.ftps.native.v1`/`profile`/synchronizable=false; SecItemDelete, değersiz yokluk kontrolü, errSecItemNotFound zorunlu).
# Seed/reopen/picker kodu ve canlı Swift/vault dosyaları değişmez. Özel anahtarlar yalnız <kök>/pki içinde 0600; hata/sinyalde ve
# `run` sonunda silinir; repoya/loga girmez. Tek parola sabiti `unused` testin kamuya açık fixture değeridir.
set -eu
[ "$#" -ge 1 ] || { echo "usage: $0 <repo-root> [compile|relink <root>|run <root>]" >&2; exit 2; }
R="$1"; PHASE="${2:-compile}"; ROOTARG="${3:-}"
HERE="$(cd "$(dirname "$0")" && pwd)"
export KLODA_RECIPE_HERE="$HERE"
TC=1.99.0-aarch64-apple-darwin
MOD=apps/mobile/modules/my-module/ios
XCF="$MOD/NativeFtps/KlodaFtpsNative.xcframework"
PAIR="$MOD/NativePairing/KlodaPairingNative.xcframework/ios-arm64-simulator/libkloda_pairing_native.a"
TEST="packages/ftps-native/apple/tests"
APPSRC="$TEST/IosFtpsLoopbackFilesApp.swift"
DEPLOY=16.4
die() { echo "ABORT: $*" >&2; exit 1; }

if [ "$PHASE" = run ]; then
  [ -n "$ROOTARG" ] || die "run needs <root>"
  exec python3 -I - "$R" "$ROOTARG" <<'PYEOF'
import hashlib, base64, json, os, plistlib, re, secrets, shutil, signal, stat, subprocess, sys, tempfile, time, urllib.parse

R, W = sys.argv[1], sys.argv[2]
HERE = os.environ["KLODA_RECIPE_HERE"]
EV = os.path.join(HERE, "..")
CONF_FINAL = os.path.join(EV, "ftps-host-representative/proftpd/proftpd.conf.final")
UDID = "61A45399-D0F9-43C0-B356-E1EF6712E960"
IMG = "kloda-p3-06-ftps-pro:2dc9d74b"
IMG_ID = "sha256:8e6060ae84838fffd36be6bbe0f3cb3f7bfafe84f57b09a49045ee489c18a27b"   # kayıtlı ProFTPD imajı (reuse; ağ/edinim yok)
PORTS = (27449, 27450, 27451)
LABEL_KEY, ROLE_KEY = "kloda.p3-06.ftps", "kloda.p3-06.role"
PAYLOAD = bytes(i % 251 for i in range(4097))
EXP_SHA_HEX = hashlib.sha256(PAYLOAD).hexdigest()
EXP_SHA_B64 = base64.urlsafe_b64encode(hashlib.sha256(PAYLOAD).digest()).rstrip(b"=").decode()
ERR_ITEM_NOT_FOUND = -25300
PROBE_INSTALL = os.environ.get("KLODA_IOS_PROBE_INSTALL_ONLY") == "1"   # tek install+sorgu probu: servis/PKI/staging/seed/Keychain/launch YOK
PROBE = os.environ.get("KLODA_IOS_PROBE_CLEANUP") == "1" or PROBE_INSTALL   # PKI/servis/picker yok, anahtarlara dokunulmaz


def cap(name, default):  # test düğmeleri süreleri yalnız KISALTABİLİR
    try:
        return min(default, float(os.environ[name])) if os.environ.get(name) else default
    except ValueError:
        return default


TOTAL = cap("KLODA_RECIPE_TOTAL_S", 1800)
CALL = cap("KLODA_RECIPE_CALL_S", 30)
PICKER = cap("KLODA_RECIPE_PICKER_S", 900)
CLEAN = cap("KLODA_RECIPE_CLEANUP_S", 240)
END = time.monotonic() + TOTAL


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
    rest = until - time.monotonic()
    if rest > 0:
        time.sleep(min(sec, rest))


def run(cmd, cap=None, check=True, out=None, inp=None, cleanup=False, until=None):
    """Mutlak son tarih TEK monotonik örnekten: min(END [cleanup değilse], until, now+cap); kalan süre her bekleme öncesi yeniden okunur."""
    now = time.monotonic()
    d = float("inf") if cap is None else now + cap
    if until is not None:
        d = min(d, until)
    if not cleanup:
        d = min(d, END)
    if d - now <= 0:
        raise Timeout("no time budget before %s (no command started)" % cmd[0])
    fh = open(out, "wb") if out else None
    if d - time.monotonic() <= 0:
        if fh:
            fh.close()
        raise Timeout("deadline reached while preparing %s (no command started)" % cmd[0])
    try:
        p = subprocess.Popen(cmd, stdin=subprocess.PIPE if inp is not None else subprocess.DEVNULL,
                             stdout=fh if fh else subprocess.PIPE, stderr=subprocess.STDOUT if fh else subprocess.PIPE,
                             start_new_session=True)
    except OSError as e:
        if fh:
            fh.close()
        raise Fail("cannot exec %s: %s" % (cmd[0], e))

    def reap():
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
        first = d - time.monotonic()
        if first <= 0:
            reap()
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
        raise Fail("%s rc=%d %s" % (cmd[0], r.rc, (r.err or r.out)[-300:].strip()))
    return r


# ------------------------------------------------------------------ aidiyet kaydı (niyet işlemden ÖNCE; sır içermez)
RUN = re.sub(r"[^a-z0-9]", "", os.path.basename(W).rsplit(".", 1)[-1].lower())
LEDGER = {"docker": [], "sim": {"udid": UDID, "initial_state": None, "booted_by_us": False, "app_absent_verified": False, "install_attempted": False, "staging_intent": False, "pinned": None, "seed_launched": False,
                                 "password_placed": False, "bundle": None}, "keys": []}
SIGSEEN = []


def save_ledger():
    with open(os.path.join(W, "ownership-run.json"), "w") as f:
        json.dump(LEDGER, f, indent=1)


def docker_create(role, flags, image, cmd):
    name = "kloda-p3-06-ftps-ios-%s-%s" % (role, RUN)
    rec = {"name": name, "role": role, "id": None}
    LEDGER["docker"].append(rec)
    save_ledger()
    r = run(["docker", "create", "--name", name, "--label", "%s=%s" % (LABEL_KEY, RUN), "--label", "%s=ios-%s" % (ROLE_KEY, role),
             "--pull", "never"] + flags + [image] + cmd, cap=CALL)
    cid = r.out.strip().split("\n")[-1].strip()
    if not re.fullmatch(r"[0-9a-f]{64}", cid):
        raise Fail("docker create returned no full id for %s" % name)
    rec["id"] = cid
    save_ledger()
    return rec


def docker_resolve(ref, name, role, want_id, until):
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
    if nm == "/" + name and lab == RUN and rl == "ios-" + role and (want_id is None or want_id == cid):
        return "own", cid
    return "foreign", cid


# ------------------------------------------------------------------ simctl yardımcıları
def sim(args, cap_s=CALL, check=True, **kw):
    return run(["xcrun", "simctl"] + args, cap=cap_s, check=check, **kw)


def sim_state(until=None, cleanup=False):
    r = run(["xcrun", "simctl", "list", "-j", "devices"], cap=CALL, until=until, cleanup=cleanup)
    for devs in json.loads(r.out)["devices"].values():
        for d in devs:
            if d["udid"] == UDID:
                return d["state"]
    return None


def check_identity():
    """Compile/relink kökünün exact bundle/nonce/UDID kimliği: root-identity.json + uygulama Info.plist + aday çalıştırılabilir hash'i + RUN soneki.
    Hiçbir kaynak yaratmadan; uyuşmazlık = Fail (kurulum/servis/Simulator işlemi yok)."""
    app = os.path.join(W, "out/KlodaFtpsFixtureFiles.app")
    try:
        meta = json.load(open(os.path.join(W, "root-identity.json")))
        pl = plistlib.load(open(os.path.join(app, "Info.plist"), "rb"))
    except (OSError, ValueError, plistlib.InvalidFileException) as e:
        raise Fail("compile-root identity unreadable (%s); run compile/relink first" % type(e).__name__)
    bundle, nonce, exe = pl.get("CFBundleIdentifier"), pl.get("FixtureNonce"), pl.get("CFBundleExecutable")
    expected = "com.kloda.fixture.ftps16c.files.r" + RUN
    if bundle != expected or meta.get("bundle") != expected:
        raise Fail("bundle id mismatch (plist=%r meta=%r expected=%r)" % (bundle, meta.get("bundle"), expected))
    if not isinstance(nonce, str) or not re.fullmatch(r"[0-9A-Fa-f-]{36}", nonce) or meta.get("nonce") != nonce:
        raise Fail("FixtureNonce mismatch between plist and compile-root metadata")
    if meta.get("udid") != UDID or meta.get("run") != RUN:
        raise Fail("metadata UDID/run mismatch")
    if exe != "KlodaFtpsFixtureFiles":
        raise Fail("unexpected CFBundleExecutable")
    try:
        data = open(os.path.join(app, exe), "rb").read()
    except OSError:
        raise Fail("candidate executable unreadable")
    sha = hashlib.sha256(data).hexdigest()
    if sha != meta.get("app_exec_sha256"):
        raise Fail("candidate executable hash differs from compile-root metadata")
    if UDID.encode() not in data:
        raise Fail("candidate executable is not bound to the fixed target UDID")
    return bundle, nonce, sha


def data_field(info):
    """`listapps` yapılandırılmış kaydındaki bundle'a özgü DataContainer alanı (file URL) -> kanonik yol; yoksa/ayrıştırılamazsa None."""
    v = (info or {}).get("DataContainer")
    if not isinstance(v, str) or not v:
        return None
    u = urllib.parse.urlparse(v)
    if u.scheme not in ("file", ""):
        return None
    return os.path.realpath(urllib.parse.unquote(u.path))


def dir_ident(path):
    """Güvenli dizin kimliği: sembolik bağ değil, gerçek dizin; (st_dev, st_ino). Aksi halde None."""
    try:
        st = os.lstat(path)
    except OSError:
        return None
    return [st.st_dev, st.st_ino] if stat.S_ISDIR(st.st_mode) else None


def own_check(bundle, until=None, cleanup=False):
    """Bu bundle'ın bu koşuya AİT olduğunun bağımsız kanıtı (yol öneki/UDID/receipt tek başına yetmez): yapılandırılmış listapps kaydı +
    kurulu plist nonce'u + kurulu executable hash'i + DataContainer alanı == get_app_container kanonik dizini. -> (durum, data_dir)."""
    st, info = apps_state(bundle, until=until, cleanup=cleanup)
    if st != "present":
        return st, None
    app = (info or {}).get("Path", "")
    try:
        pl = plistlib.load(open(os.path.join(app, "Info.plist"), "rb"))
        exe_sha = hashlib.sha256(open(os.path.join(app, "KlodaFtpsFixtureFiles"), "rb").read()).hexdigest()
    except (OSError, ValueError, plistlib.InvalidFileException):
        return "foreign-or-incomplete", None
    if pl.get("CFBundleIdentifier") != bundle or pl.get("FixtureNonce") != EXPECT_NONCE or exe_sha != EXPECT_EXEC_SHA:
        return "foreign-or-incomplete", None
    field = data_field(info)
    if field is None:
        return "data-field-missing", None
    try:
        r = run(["xcrun", "simctl", "get_app_container", UDID, bundle, "data"], cap=CALL, until=until, check=False, cleanup=cleanup)
    except Fail:
        return "unknown", None
    if r.rc != 0:
        return "unknown", None
    if os.path.realpath(r.out.strip()) != field:
        return "data-binding-mismatch", None
    if PIN is not None and (field != PIN["path"] or dir_ident(field) != PIN["ident"]):
        # İki lookup birlikte A→B (ya da aynı yolda yeni dizin) olsa bile staging'de sabitlenen dizin dışında aidiyet YOK
        return "pin-mismatch", None
    return "own", field


def apps_state(bundle, until=None, cleanup=False):
    """Yapılandırılmış `simctl listapps` (plist→JSON). -> ('absent'|'present'|'unknown', info). Komut/erişim/ayrıştırma hatası = unknown
    (YOKLUK SAYILMAZ); listede en az bir sistem uygulaması olmayan çıktı güvenilir sayılmaz."""
    try:
        r = run(["xcrun", "simctl", "listapps", UDID], cap=CALL, until=until, check=False, cleanup=cleanup)
        if r.rc != 0 or not r.out.strip():
            return "unknown", None
        j = run(["plutil", "-convert", "json", "-o", "-", "-"], cap=10, until=until, inp=r.out, check=False, cleanup=cleanup)
        if j.rc != 0:
            return "unknown", None
        d = json.loads(j.out)
        if not isinstance(d, dict) or not any(k.startswith("com.apple.") for k in d):
            return "unknown", None
    except (Fail, ValueError):
        return "unknown", None
    return ("present", d[bundle]) if bundle in d else ("absent", None)


def container(bundle, until=None, cleanup=False):
    """Yalnız kanıtlanmış kendi Data container'ı: DataContainer alanı + get_app_container birebir; yoksa fail closed (UDID/yol öneki yetmez)."""
    g, data = own_check(bundle, until=until, cleanup=cleanup)
    if g != "own":
        raise Fail("data container of %s not independently verified (%s)" % (bundle, g))
    return data


def safe_stage_password(data, text, pin_ident):
    """Yazma sınırı: kanonik data dizininden dir-fd ile, her bileşen O_NOFOLLOW|O_DIRECTORY; dosya O_EXCL|O_NOFOLLOW. Symlink/hedef değişimi = yazma yok."""
    flags = os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_NOFOLLOW", 0)
    fd = None
    try:
        fd = os.open(data, flags)
        # Ayrı açılan stage root FD'sinin kimliği pinned kimlikle eşleşmeli: HİÇBİR mkdir/open-yazma işleminden önce. Aynı FD boyunca
        # dir-fd/nofollow sürer; yeniden yol açma yok. fstat hatası (OSError) aşağıda Fail'e çevrilir = fail closed.
        st = os.fstat(fd)
        if not stat.S_ISDIR(st.st_mode) or [st.st_dev, st.st_ino] != list(pin_ident):
            raise Fail("staging refused: opened stage root identity (dev=%s,ino=%s) != pinned %s or not a directory; no file mutation" % (
                st.st_dev, st.st_ino, list(pin_ident)))
        for name in ("Library", "Caches"):
            try:
                nfd = os.open(name, flags, dir_fd=fd)
            except FileNotFoundError:
                os.mkdir(name, 0o700, dir_fd=fd)
                nfd = os.open(name, flags, dir_fd=fd)
            os.close(fd)
            fd = nfd
        pf = os.open("fixture-password", os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, "O_NOFOLLOW", 0), 0o600, dir_fd=fd)
        with os.fdopen(pf, "w") as f:
            f.write(text)
    except OSError as e:
        raise Fail("staging write refused (%s); no further file operation" % type(e).__name__)
    finally:
        if fd is not None:
            try:
                os.close(fd)
            except OSError:
                pass


def wait_result(bundle, mode, until, banner=None, fresh_after=None):
    """<mode>-result.json; phase=finished (PASS) ya da status=FAIL. Her uyku/okuma `until` mutlak tarihini aşmaz."""
    shown = set()
    while True:
        if until - time.monotonic() <= 0:
            raise Timeout("no finished %s result before deadline (picker/UI step not completed)" % mode)
        try:
            path = os.path.join(container(bundle, until=until), "Documents", mode + "-result.json")
            if os.path.exists(path) and (fresh_after is None or os.path.getmtime(path) >= fresh_after):
                v = json.load(open(path))
                if banner and v.get("phase") in banner and v["phase"] not in shown:
                    shown.add(v["phase"])
                    print(banner[v["phase"]], flush=True)
                if v.get("status") == "FAIL":
                    raise Fail("%s reported FAIL code=%s" % (mode, v.get("code")))
                if v.get("phase") == "finished":
                    return v
        except (ValueError, OSError):
            pass
        nap(1.0, until)


# ------------------------------------------------------------------ cleanup (tek t0; başarı/hata/INT/TERM)
def cleanup():
    left = []
    t0 = time.monotonic()
    D = t0 + CLEAN
    KC = t0 + CLEAN * 0.30         # Keychain cleanup modu (sessiz kalırsa sonraki adımları aç bırakamaz)
    S = t0 + CLEAN * 0.55          # parola dosyası + uninstall
    SD = t0 + CLEAN * 0.80         # Simulator shutdown; Docker D'yi kullanır

    def step(label, fn):
        try:
            fn()
        except BaseException as e:  # noqa: BLE001 — bağımsız adımlar
            left.append("%s:%s" % (label, type(e).__name__))

    def keys():
        for rel in ("pki/ca.key", "pki/server.key", "pki/server.csr", "pki/ca.srl", "conf/server.key"):
            pth = os.path.join(W, rel)
            try:
                os.unlink(pth)
            except FileNotFoundError:
                pass
            if os.path.exists(pth):
                left.append("file:" + pth)
    if not PROBE:
        step("keys", keys)

    s = LEDGER["sim"]
    bundle = s["bundle"]

    reported = set()
    ctx = {"receipt_ok": False, "data": None}
    needs_fixture_cleanup = bool(s["staging_intent"] or s["seed_launched"])

    def report_app(reason):
        if reason not in reported:
            reported.add(reason)
            left.append("app:%s:ownership-unverified(%s; no bundle mutation performed)" % (bundle, reason))

    def gate(until):
        """Bu bundle'a yönelen HER cleanup adımından hemen önce yeniden çağrılır (sahiplik zamanla değişebilir). -> (durum, data_dir)."""
        if not (s["install_attempted"] and bundle):
            return "none", None
        try:
            if sim_state(until=until, cleanup=True) != "Booted":
                return "simulator-not-booted", None
            return own_check(bundle, until=until, cleanup=True)
        except Fail:
            return "unknown", None                            # süre/komut hatası: aidiyet BİLİNMİYOR (yokluk/sahiplik sayılmaz)

    service = (bundle or "") + ".ftps.native.v1"

    def retained(data):
        pinned = LEDGER["sim"].get("pinned")
        left.append("app:%s:retained(udid=%s,container=%s,pinned=%s; not uninstalled, targeted re-verification pending)" % (
            bundle, UDID, data or "unverified", ("%s ident=%s" % (pinned["path"], pinned["ident"])) if pinned else "none"))

    def fixture_cleanup():
        # HOST container'da dosya silmez/yazmaz. Fixture kendi sandbox'ında parola dosyasını ve exact Keychain girdisini temizler.
        if not needs_fixture_cleanup:
            return
        g, data = gate(KC)
        if g != "own":
            left.append("keychain:service=%s,account=profile:absence-unverifiable(app %s)" % (service, g))
            if g != "absent":
                report_app(g)
            retained(None)
            return
        try:
            sim(["terminate", UDID, bundle], cap_s=10, check=False, until=KC, cleanup=True)
        except Fail:
            pass
        g2, data2 = gate(KC)                                  # launch'tan hemen önce yeniden doğrula
        if g2 != "own" or data2 != data:
            left.append("keychain:service=%s,account=profile:absence-unverifiable(app %s before launch)" % (service, g2))
            report_app(g2)
            retained(data)
            return
        challenge = secrets.token_hex(16)                     # tek kullanımlık, sırsız, dosya adı güvenli (32 küçük hex)
        receipt = os.path.join(data, "Documents", "cleanup-" + challenge + ".json")
        launch_wall = time.time()
        sim(["launch", UDID, bundle, "cleanup", challenge], cap_s=20, until=KC, cleanup=True)
        while not os.path.lexists(receipt) and KC - time.monotonic() > 0:
            nap(0.5, KC)
        if not os.path.lexists(receipt):                      # beklenen tek dosya yok: makbuz eksik (yanlış dizindeki dosya sayılmaz)
            left.append("keychain:service=%s,account=profile:absence-unverified(receipt-missing for challenge)" % service)
            retained(data)
            return
        g3, data3 = gate(S)                                   # makbuz okunmadan önce aidiyet/dizin bağı yeniden
        v, why = None, "receipt-missing"
        if g3 != "own" or data3 != data:
            why = "ownership changed before reading receipt (%s)" % g3
        elif os.path.lexists(receipt):
            try:
                fd = os.open(receipt, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
                try:
                    stt = os.fstat(fd)
                    if not stat.S_ISREG(stt.st_mode):
                        why = "receipt-not-regular-file"
                    elif stt.st_mtime < launch_wall - 2:
                        why = "receipt-stale"
                    else:
                        v = json.loads(os.read(fd, 65536).decode())
                        why = None
                finally:
                    os.close(fd)
            except (OSError, ValueError):
                why = "receipt-unreadable"
        ok = False
        if v is not None:
            pw_gone = not os.path.lexists(os.path.join(data, "Library/Caches/fixture-password"))   # salt-okunur bağımsız doğrulama
            ok = (v.get("mode") == "cleanup" and v.get("phase") == "finished" and v.get("status") == "PASS"
                  and v.get("bundle") == bundle and v.get("nonce") == EXPECT_NONCE and v.get("udid") == UDID and v.get("challenge") == challenge
                  and v.get("service") == service and v.get("account") == "profile" and v.get("absentStatus") == ERR_ITEM_NOT_FOUND
                  and v.get("deleteStatus") in (0, ERR_ITEM_NOT_FOUND) and v.get("passwordAbsent") is True and pw_gone)
            try:
                json.dump({"receipt": v, "host_independent_password_absent": pw_gone, "valid": ok}, open(os.path.join(W, "logs", "cleanup-receipt.json"), "w"), indent=1, sort_keys=True)
            except OSError:
                pass
            if not ok:
                why = "receipt-invalid(mode=%s,phase=%s,status=%s,bundle_match=%s,nonce_match=%s,udid_match=%s,challenge_match=%s,service_match=%s,delete=%s,absent=%s,passwordAbsent=%s,host_pw_gone=%s)" % (
                    v.get("mode"), v.get("phase"), v.get("status"), v.get("bundle") == bundle, v.get("nonce") == EXPECT_NONCE, v.get("udid") == UDID,
                    v.get("challenge") == challenge, v.get("service") == service, v.get("deleteStatus"), v.get("absentStatus"), v.get("passwordAbsent"), pw_gone)
        if ok:
            ctx["receipt_ok"], ctx["data"] = True, data
        else:
            left.append("keychain:service=%s,account=profile:absence-unverified(%s)" % (service, why))
            retained(data)
    step("fixture-cleanup", fixture_cleanup)

    def uninstall():
        # Yalnız kanıtlı exact yokluk PASS; komut/erişim hatası yokluk sayılmaz; kimliği doğrulanamayan kurulum KALDIRILMAZ.
        g, _ = gate(S)
        if g in ("none", "absent"):
            return
        if g != "own":
            report_app(g)
            return
        if needs_fixture_cleanup and not ctx["receipt_ok"]:
            return                                            # staging/seed niyeti var, geçerli makbuz yok: bundle RETAINED (yukarıda raporlandı)
        run(["xcrun", "simctl", "uninstall", UDID, bundle], cap=30, until=S, check=False, cleanup=True)
        st2, _ = apps_state(bundle, until=S, cleanup=True)
        if st2 != "absent":
            left.append("app:%s:%s" % (bundle, "uninstall-unverified(listapps failed)" if st2 == "unknown" else "still-present"))
    step("uninstall", uninstall)

    def shutdown():
        if s["booted_by_us"]:
            run(["xcrun", "simctl", "shutdown", UDID], cap=60, until=SD, check=False, cleanup=True)
            st = sim_state(until=SD, cleanup=True)
            if st != "Shutdown":
                left.append("simulator:%s:state=%s" % (UDID, st))
    step("shutdown", shutdown)

    for rec in reversed(list(LEDGER["docker"])):
        def one(rec=rec):
            nm, rl, known = rec["name"], rec["role"], rec["id"]
            if D - time.monotonic() <= 0:
                left.append("docker:%s:budget-exhausted(%s)" % (nm, known or "id-unknown"))
                return
            st, cid = docker_resolve(known or nm, nm, rl, known, D)
            if st == "absent":
                if known:
                    return
                left.append("docker:%s:create-outcome-unknown(not-found,may-appear-late)" % nm)
                return
            if st == "unknown":
                left.append("docker:%s:unverified" % nm)
                return
            if st == "foreign":
                left.append("docker:%s:foreign:%s(not removed)" % (nm, cid))
                return
            if D - time.monotonic() <= 0:
                left.append("docker:%s:%s:budget-exhausted(verified-not-removed)" % (nm, cid))
                return
            try:
                run(["docker", "rm", "-f", cid], cap=20, until=D, check=False, cleanup=True)
            except Fail:
                pass
            if D - time.monotonic() <= 0:
                left.append("docker:%s:%s:rm-unverified(deadline)" % (nm, cid))
                return
            st2, _ = docker_resolve(cid, nm, rl, cid, D)
            if st2 != "absent":
                left.append("docker:%s:%s:%s" % (nm, cid, "rm-unverified" if st2 == "unknown" else "still-present"))
        step("docker:" + rec["name"], one)
    return left


# ------------------------------------------------------------------ ana akış
def pipeline():
    L = lambda n: os.path.join(W, "logs", n)  # noqa: E731
    os.makedirs(os.path.join(W, "logs"), exist_ok=True)
    os.makedirs(os.path.join(W, "conf"), exist_ok=True)
    app = os.path.join(W, "out/KlodaFtpsFixtureFiles.app")
    plist = os.path.join(app, "Info.plist")
    if not (os.path.isdir(app) and os.path.isfile(plist)):
        raise Fail("fixture app missing (run compile/relink first)")
    global EXPECT_EXEC_SHA, EXPECT_NONCE
    bundle, nonce, EXPECT_EXEC_SHA = check_identity()
    EXPECT_NONCE = nonce        # kaynak yaratmadan: köke ait exact bundle/nonce/UDID/aday bağı
    # önkoşul (kaynak yaratmadan)
    if not PROBE:
        for k in ("pki/ca.pem", "pki/server.pem", "pki/server.key"):
            if not os.path.exists(os.path.join(W, k)):
                raise Fail("missing %s (keys already removed? start a new compile root)" % k)
        for p in PORTS:
            if run(["lsof", "-nP", "-iTCP:%d" % p, "-sTCP:LISTEN"], cap=CALL, check=False).out.strip():
                raise Fail("port %d busy (not ours)" % p)
        if run(["docker", "image", "inspect", IMG, "--format", "{{.Id}}"], cap=CALL).out.strip() != IMG_ID:
            raise Fail("recorded ProFTPD image missing or different (no acquisition attempted)")
    st = sim_state()
    if st is None:
        raise Fail("owned simulator %s not found" % UDID)
    LEDGER["sim"]["initial_state"], LEDGER["sim"]["bundle"] = st, bundle
    save_ledger()
    if st not in ("Shutdown", "Booted"):
        raise Fail("simulator in unexpected state %s" % st)
    if PROBE_INSTALL and st != "Shutdown":
        raise Fail("install probe requires the owned simulator to start Shutdown (state=%s); nothing touched" % st)

    if not PROBE:
        # 1) sahipli ProFTPD (create/start ayrı; loopback; kayıtlı imaj ve konfig)
        shutil.copy(CONF_FINAL, os.path.join(W, "conf/proftpd.conf"))
        for n in ("server.pem", "server.key"):
            shutil.copy(os.path.join(W, "pki", n), os.path.join(W, "conf", n))
        open(os.path.join(W, "conf/entry.sh"), "w").write(
            "#!/bin/sh\nset -e\nmkdir -p /srv/ftp/upload /var/log/proftpd /var/run/proftpd\n"
            "id kloda_probe >/dev/null 2>&1 || useradd -d /srv/ftp/upload -s /bin/sh kloda_probe\n"
            "id probe >/dev/null 2>&1 || useradd -d /srv/ftp/upload -s /bin/sh probe\n"
            "echo \"probe:unused\" | chpasswd\nchown probe /srv/ftp/upload\nexec proftpd -n -c /run/kloda/proftpd.conf\n")
        os.chmod(os.path.join(W, "conf/entry.sh"), 0o755)
        for n in ("server.key", "proftpd.conf"):
            os.chmod(os.path.join(W, "conf", n), 0o600)
        flags = []
        for p in PORTS:
            flags += ["-p", "127.0.0.1:%d:%d" % (p, p)]
        srv = docker_create("srv", flags + ["-v", "%s/conf:/run/kloda:ro" % W], IMG, ["/run/kloda/entry.sh"])
        run(["docker", "start", srv["id"]], cap=CALL)
        ready_end = min(time.monotonic() + 30, END)
        while True:
            try:
                r = run(["openssl", "s_client", "-connect", "localhost:27449", "-starttls", "ftp", "-CAfile", os.path.join(W, "pki/ca.pem"),
                         "-verify_hostname", "localhost", "-verify_return_error"], cap=10, until=ready_end, check=False, inp="QUIT\n")
                open(L("host-tls.log"), "w").write(r.out + r.err)
                if r.rc == 0 and re.search(r"Verification: OK|Verify return code: 0", r.out + r.err):
                    break
            except Timeout:
                pass
            if ready_end - time.monotonic() <= 0:
                raise Fail("service not reachable with verified TLS on 27449")
            nap(1, ready_end)

    # 2) Simulator: yalnız sahipli UDID; boot niyeti önce kayda girer
    if st == "Shutdown":
        LEDGER["sim"]["booted_by_us"] = True
        save_ledger()
        sim(["boot", UDID])
        sim(["bootstatus", UDID], cap_s=180)
    # kurulumdan hemen önce yalnız güvenilir exact yokluk; var ya da belirsizse install/uninstall YOK (sahiplik iddiası yok)
    st_app, _ = apps_state(bundle)
    if st_app == "unknown" and PROBE_INSTALL:
        r = run(["xcrun", "simctl", "listapps", UDID], cap=CALL, check=False)
        j = run(["plutil", "-convert", "json", "-o", "-", "-"], cap=10, inp=r.out, check=False) if r.out.strip() else None
        diag = {"listapps_rc": r.rc, "listapps_len": len(r.out), "listapps_head": r.out[:24], "stderr_head": (r.err or "")[:120],
                "plutil_rc": None if j is None else j.rc, "plutil_err_head": None if j is None else (j.err or "")[:120]}
        json.dump(diag, open(os.path.join(W, "logs", "install-probe-diag.json"), "w"), indent=1)
        raise Fail("install probe: structured listapps could not be parsed (see logs/install-probe-diag.json); no install attempted")
    if st_app != "absent":
        raise Fail("fixture bundle %s is %s on %s; refusing to install (no install/uninstall attempted)" % (bundle, st_app, UDID))
    LEDGER["sim"]["app_absent_verified"] = True
    LEDGER["sim"]["install_attempted"] = True    # mutasyon niyeti ANCAK doğrulanmış ilk yokluktan sonra
    save_ledger()
    sim(["install", UDID, app], cap_s=120)
    if PROBE_INSTALL:
        # Gerçek listapps plist + get_app_container ... data: tarifin own_check/DataContainer ayrıştırması ve kanonik dizin/dev/ino eşleşmesi.
        # Uygulama AÇILMAZ; staging/parola/Keychain yok. Çıktı yalnız bu bundle'a ait alan adları/boolean'lar.
        st_i, info = apps_state(bundle)
        rec = {"bundle": bundle, "listapps_state": st_i, "record_keys": sorted((info or {}).keys()),
               "has_Path": bool((info or {}).get("Path")), "has_DataContainer": "DataContainer" in (info or {})}
        field = data_field(info)
        rec["field_canonical"] = field
        rec["field_exists"] = bool(field and os.path.exists(field))
        rec["field_ident"] = dir_ident(field) if field else None
        gac = run(["xcrun", "simctl", "get_app_container", UDID, bundle, "data"], cap=CALL, check=False)
        rec["get_app_container_rc"] = gac.rc
        rec["get_app_container_canonical"] = os.path.realpath(gac.out.strip()) if gac.rc == 0 and gac.out.strip() else None
        rec["canonical_equal"] = bool(field and rec["get_app_container_canonical"] == field)
        rec["ident_get_app_container"] = dir_ident(rec["get_app_container_canonical"]) if rec["get_app_container_canonical"] else None
        rec["ident_equal"] = rec["field_ident"] is not None and rec["field_ident"] == rec["ident_get_app_container"]
        appdir = (info or {}).get("Path", "")
        try:
            rec["installed_plist_bundle_ok"] = plistlib.load(open(os.path.join(appdir, "Info.plist"), "rb")).get("CFBundleIdentifier") == bundle
            rec["installed_plist_nonce_ok"] = plistlib.load(open(os.path.join(appdir, "Info.plist"), "rb")).get("FixtureNonce") == EXPECT_NONCE
            rec["installed_exec_hash_ok"] = hashlib.sha256(open(os.path.join(appdir, "KlodaFtpsFixtureFiles"), "rb").read()).hexdigest() == EXPECT_EXEC_SHA
        except OSError:
            rec["installed_plist_bundle_ok"] = rec["installed_plist_nonce_ok"] = rec["installed_exec_hash_ok"] = False
        g_i, data_i = own_check(bundle)
        rec["own_check"] = g_i
        rec["own_check_data_equals_field"] = data_i == field and data_i is not None
        json.dump(rec, open(os.path.join(W, "logs", "install-probe.json"), "w"), indent=1, sort_keys=True)
        bad = [k for k in ("has_DataContainer", "field_exists", "canonical_equal", "ident_equal", "installed_plist_bundle_ok",
                           "installed_plist_nonce_ok", "installed_exec_hash_ok") if not rec.get(k)]
        if g_i != "own" or bad:
            raise Fail("install probe mismatch: own_check=%s failing_fields=%s (see logs/install-probe.json)" % (g_i, bad))
        print("INSTALL_PROBE_OK own_check=own canonical+dev/ino match; app NOT launched", flush=True)
        return
    # STAGING (Caches/fixture-password): yazmadan önce exact kurulu aday (plist nonce + executable hash) ve bağımsız DataContainer alanı ==
    # get_app_container kanonik dizini. Alan yok/yol başka ise DUR (mkdir/yazma/seed yok); UDID/yol öneki aidiyet kanıtı değildir.
    g0, data0 = own_check(bundle)
    if g0 != "own":
        raise Fail("staging refused: installed candidate/data container not independently verified (%s); no mkdir/write/seed" % g0)
    ident0 = dir_ident(data0)
    if ident0 is None:
        raise Fail("staging refused: verified data container is not a plain directory; no mkdir/write/seed")
    global PIN
    PIN = {"path": data0, "ident": ident0}       # koşu niyetine sabitle: bundan sonra TÜM doğrulamalar bu dizinle eşleşmeli
    LEDGER["sim"]["pinned"] = PIN
    LEDGER["sim"]["staging_intent"] = True      # niyet ilk yazma işleminden ÖNCE (seed hiç başlamasa da fixture cleanup gerekir)
    save_ledger()
    g1, data1 = own_check(bundle)                # niyetten sonra, yazmadan hemen önce yeniden doğrula
    if g1 != "own" or data1 != data0:
        raise Fail("staging refused: data container binding changed (%s); no write" % g1)
    safe_stage_password(data1, "unused", PIN["ident"])
    LEDGER["sim"]["password_placed"] = True
    save_ledger()
    g2, data2 = own_check(bundle)
    if g2 != "own" or data2 != data0:
        raise Fail("data container binding changed after staging (%s); seed not started" % g2)
    base = data2
    if os.environ.get("KLODA_IOS_PROBE_CLEANUP") == "1":
        # Staged sentetik dosyanın varlığı: HOST salt-okunur (O_NOFOLLOW, dir-fd), pinned FD zinciriyle; yazma/silme yok
        rec = {"pinned": PIN, "exists": False}
        try:
            dfd = os.open(data2, os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_NOFOLLOW", 0))
            try:
                fl = os.O_RDONLY | os.O_DIRECTORY | getattr(os, "O_NOFOLLOW", 0)
                for nm in ("Library", "Caches"):
                    nfd = os.open(nm, fl, dir_fd=dfd); os.close(dfd); dfd = nfd
                pfd = os.open("fixture-password", os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0), dir_fd=dfd)
                try:
                    stp = os.fstat(pfd)
                    rec.update(exists=True, regular=stat.S_ISREG(stp.st_mode), size=stp.st_size, mode=oct(stp.st_mode & 0o777),
                               content_is_synthetic=os.read(pfd, 64) == b"unused")
                finally:
                    os.close(pfd)
            finally:
                os.close(dfd)
        except OSError as e:
            rec["error"] = type(e).__name__
        json.dump(rec, open(os.path.join(W, "logs", "cleanup-probe-staging.json"), "w"), indent=1, sort_keys=True)
        if not (rec.get("exists") and rec.get("regular") and rec.get("size") == 6 and rec.get("mode") == "0o600" and rec.get("content_is_synthetic")):
            raise Fail("staged synthetic password file not verified (see logs/cleanup-probe-staging.json)")
        LEDGER["sim"]["seed_launched"] = True    # yalnız temizlik modu tanısı: cleanup() cleanup modunu çalıştırır, seed/picker yok
        save_ledger()
        print("PROBE_ONLY: cleanup modu tanısı (seed/picker yok)", flush=True)
        return
    # 3) seed: iki gerçek picker (kullanıcı). UI uygulaması Xcode 27'de DeviceHub.app (Simulator.app yok); yoksa HUMAN_ACTION sunulamaz -> dur
    if os.environ.get("KLODA_IOS_OPEN_SIMULATOR") == "1":
        dev = os.path.join(os.path.dirname(run(["xcode-select", "-p"], cap=10).out.strip()), "Applications/DeviceHub.app")
        if not os.path.isdir(dev):
            raise Fail("no simulator UI app found at %s; picker HUMAN_ACTION cannot be presented" % dev)
        run(["open", dev], cap=CALL)
    LEDGER["sim"]["seed_launched"] = True    # Keychain niyeti seed launch'ından hemen ÖNCE
    save_ledger()
    sim(["launch", UDID, bundle, "seed"], cap_s=30)
    until_seed = min(time.monotonic() + PICKER, END)
    wall = time.time() + (until_seed - time.monotonic())
    dl = time.strftime("%H:%M:%SZ", time.gmtime(wall)) + " UTC (" + time.strftime("%H:%M:%S", time.localtime(wall)) + " yerel)"
    where = "DeviceHub'da 'Kloda-Ftps16c-Disposable' (%s) cihazının ekranı" % UDID
    banner = {"select-source": "HUMAN_ACTION 1/2: %s; klasör seçicide 'Source' klasörü açık, 'Open/Seç' dokun. SON TARİH %s" % (where, dl),
              "select-restore": "HUMAN_ACTION 2/2: aynı cihazda ikinci klasör seçici ('Restore' açık), 'Open/Seç' dokun. SON TARİH %s" % dl}
    seed = wait_result(bundle, "seed", until_seed, banner)
    json.dump(seed, open(L("seed-result.json"), "w"), indent=1, sort_keys=True)
    for k, v in (("bytes", 4097), ("catalogCount", 1), ("unchangedReuse", True), ("restoreRepeatSameInode", True), ("sourcePicker", True), ("restorePicker", True)):
        if seed.get(k) != v:
            raise Fail("seed result %s=%r expected %r" % (k, seed.get(k), v))
    if seed.get("hash") != EXP_SHA_B64:
        raise Fail("seed hash != synthetic payload hash")
    rel = seed.get("relativePath", "")
    if not re.fullmatch(r"[A-Za-z0-9_./=-]+", rel) or ".." in rel:
        raise Fail("unexpected relativePath")
    # 4) alıcı ölçütü (sunucu): tek dosya, 4097 B, beklenen SHA-256
    r = run(["docker", "exec", srv["id"], "sh", "-c", 'cd /srv/ftp/upload && stat -c "%s" "$1" && sha256sum "$1"', "_", rel], cap=CALL * 2)
    open(L("receiver-readback.txt"), "w").write(r.out)
    lines = r.out.strip().splitlines()
    if len(lines) != 2 or lines[0] != "4097" or lines[1].split()[0] != EXP_SHA_HEX:
        raise Fail("receiver size/SHA mismatch")
    n = run(["docker", "exec", srv["id"], "sh", "-c", 'cd /srv/ftp/upload && find . -type f | wc -l'], cap=CALL).out.strip()
    if n != "1":
        raise Fail("receiver has %s files, expected exactly 1" % n)
    # 5) ayrı süreçte reopen
    sim(["terminate", UDID, bundle], check=False, cap_s=15)
    reopen_wall = time.time()                       # host container'dan dosya SİLMEZ: eski sonuç mtime ile elenir
    sim(["launch", UDID, bundle, "reopen"], cap_s=30)
    reopen = wait_result(bundle, "reopen", min(time.monotonic() + 120, END), fresh_after=reopen_wall - 2)
    json.dump(reopen, open(L("reopen-result.json"), "w"), indent=1, sort_keys=True)
    if reopen.get("job") != seed.get("job") or reopen.get("hash") != EXP_SHA_B64 or reopen.get("bytes") != 4097:
        raise Fail("reopen result does not match seed job/hash/bytes")


def main():
    def on_signal(sig, _f):
        global ARMED
        if ARMED:
            ARMED = False
            raise Interrupted(sig)
        SIGSEEN.append(sig)
    signal.signal(signal.SIGINT, on_signal)
    signal.signal(signal.SIGTERM, on_signal)
    os.umask(0o077)
    rc, reason = 0, None
    global ARMED
    try:
        ARMED = True
        try:
            pipeline()
        except Interrupted as e:
            rc, reason = 128 + e.sig, "interrupted by signal %d" % e.sig
        except Fail as e:
            rc, reason = e.code, "%s: %s" % (type(e).__name__, e)
        except Exception as e:  # noqa: BLE001
            rc, reason = 1, "%s: %s" % (type(e).__name__, e)
        finally:
            ARMED = False
    except Interrupted as e:
        rc, reason = rc or 128 + e.sig, reason or "interrupted by signal %d" % e.sig
    finally:
        ARMED = False
        t = time.monotonic()
        left = cleanup()
        print("CLEANUP_ELAPSED=%.1fs (budget %.0fs)" % (time.monotonic() - t, CLEAN))
    if SIGSEEN:
        reason = reason or "signal %d received during cleanup (cleanup was not interrupted)" % SIGSEEN[0]
        rc = rc or 128 + SIGSEEN[0]
    if reason:
        print("FAILED: " + reason, file=sys.stderr)
    if left:
        print("CLEANUP_INCOMPLETE remaining=%s root=%s" % (json.dumps(left), W), file=sys.stderr)
        sys.exit(4)
    print("CLEANUP_DONE root=%s (keys removed; Keychain absence verified if seed was launched; app uninstalled if installed; imaj %s korunur)" % (W, IMG))
    if rc == 0 and os.environ.get("KLODA_IOS_PROBE_CLEANUP") == "1":
        print("IOS_FTPS_CLEANUP_PROBE_DONE root=%s (kabul PASS'i değil)" % W)
    elif rc == 0 and PROBE_INSTALL:
        print("IOS_FTPS_INSTALL_PROBE_DONE root=%s (kabul PASS'i değil)" % W)
    elif rc == 0:
        print("IOS_FTPS_RUN_PASS root=%s" % W)
    sys.exit(rc)


ARMED = False
EXPECT_EXEC_SHA = None
EXPECT_NONCE = None
PIN = None
if os.environ.get("KLODA_IOS_CHECK_IDENTITY_ONLY") == "1":   # salt-okunur: yalnız kök/aday kimlik tutarlılığı; ledger/cleanup/anahtar adımı YOK
    b, n, h = check_identity()
    print("IDENTITY_OK root=%s bundle=%s nonce=%s exec_sha256=%s run=%s" % (W, b, n, h, RUN))
    sys.exit(0)
main()
PYEOF
fi

# ====================================================================== compile / relink (shell)
umask 077
prod_hashes() {
  ( cd "$R" && find "$XCF" -type f | sort | while read -r f; do shasum -a 256 "$f"; done
    shasum -a 256 "$MOD/NativeFtps/kloda_ftps.h" "$PAIR" ) ; }

# Fixture app yaması: yalnız klondaki kopyaya `cleanup` modu (assert'li, idempotent değil: her çağrıdan önce canlıdan taze kopya)
patch_app() {  # $1 = klon app dosyası
  python3 -I - "$1" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
def rep(a, b):
    global s
    assert s.count(a) == 1, a[:60]
    s = s.replace(a, b, 1)
rep("import CryptoKit\n", "import CryptoKit\nimport Security\n")
rep('      try require(mode == "seed" || mode == "reopen")\n',
    '      try require(mode == "seed" || mode == "reopen" || mode == "cleanup")\n'
    '      if mode == "cleanup" { DispatchQueue.global().async { self.cleanup() }; return true }\n')
rep('  var mode: String { CommandLine.arguments.last ?? "invalid" }\n',
    '  var mode: String { let a = CommandLine.arguments; return a.count >= 3 && a[a.count - 2] == "cleanup" ? "cleanup" : (a.last ?? "invalid") }\n'
    '  var challenge: String { CommandLine.arguments.last ?? "" }\n')
rep("  func require(_ condition:",
'''  // Fixture-only cleanup: HOST container'a yazmaz/silmez. Kendi sandbox'ında sentetik parola dosyasını siler, exact Keychain kimliğini siler/yokluğunu
  // doğrular (değer OKUNMAZ) ve challenge'a özel atomik makbuz yazar. Challenge: tek kullanımlık 32 küçük hex (dosya adı güvenli).
  func cleanup() {
    let hex = Array("0123456789abcdef")
    guard challenge.count == 32, challenge.allSatisfy({ hex.contains($0) }) else { return }   // güvensiz ad: makbuz yazılmaz
    var d: [String: Any] = ["mode": "cleanup", "phase": "finished", "challenge": challenge, "account": "profile",
      "udid": ProcessInfo.processInfo.environment["SIMULATOR_UDID"] ?? "", "bundle": Bundle.main.bundleIdentifier ?? "", "nonce": nonce]
    var ok = false
    if let bundle = Bundle.main.bundleIdentifier, !bundle.isEmpty {
      let secret = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("fixture-password")
      try? FileManager.default.removeItem(at: secret)
      d["passwordAbsent"] = !FileManager.default.fileExists(atPath: secret.path)
      let identity: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: bundle + ".ftps.native.v1", kSecAttrAccount as String: "profile", kSecAttrSynchronizable as String: false]
      let deleted = SecItemDelete(identity as CFDictionary)
      var probe = identity; probe[kSecReturnAttributes as String] = true; probe[kSecMatchLimit as String] = kSecMatchLimitOne
      var item: CFTypeRef?
      let absent = SecItemCopyMatching(probe as CFDictionary, &item)
      d["service"] = bundle + ".ftps.native.v1"; d["deleteStatus"] = Int(deleted); d["absentStatus"] = Int(absent)
      ok = (deleted == errSecSuccess || deleted == errSecItemNotFound) && absent == errSecItemNotFound && (d["passwordAbsent"] as? Bool) == true
    }
    d["status"] = ok ? "PASS" : "FAIL"
    if let data = try? JSONSerialization.data(withJSONObject: d, options: .sortedKeys) {
      try? data.write(to: root.appendingPathComponent("cleanup-" + challenge + ".json"), options: .atomic)
    }
  }
  func require(_ condition:''')
open(p, "w").write(s)
PY
}

reissue_identity() {  # $1=APP: kök dizin RUN'ı plist bundle'ından farklıysa (kopyalanmış kök) bu köke özgü bundle/nonce yeniden üretilir
  python3 -I - "$W" "$1" <<'PY'
import os, plistlib, re, sys, uuid
W, app = sys.argv[1:3]
run = re.sub(r"[^a-z0-9]", "", os.path.basename(W).rsplit(".", 1)[-1].lower())
path = os.path.join(app, "Info.plist")
pl = plistlib.load(open(path, "rb"))
want = "com.kloda.fixture.ftps16c.files.r" + run
if pl.get("CFBundleIdentifier") != want:
    old = pl.get("CFBundleIdentifier")
    pl["CFBundleIdentifier"] = want
    pl["FixtureNonce"] = str(uuid.uuid4())
    plistlib.dump(pl, open(path, "wb"), fmt=plistlib.FMT_XML)
    print("IDENTITY_REISSUED bundle %s -> %s (new nonce)" % (old, want))
else:
    print("IDENTITY_KEPT bundle %s" % want)
PY
}

gen_inputs() {  # $1=K → $W/out/swift-inputs.txt (Expo-dışı üst düzey modül Swift'leri + NativePairing + app)
  python3 -I - "$1/$MOD" "$1/$TEST" > "$W/out/swift-inputs.txt" <<'PY'
import os, sys
mod, test = sys.argv[1:3]
out = []
for n in sorted(os.listdir(mod)):
    p = os.path.join(mod, n)
    if n.endswith(".swift") and "import ExpoModulesCore" not in open(p).read():
        out.append(p)
for n in sorted(os.listdir(os.path.join(mod, "NativePairing"))):
    if n.endswith(".swift"):
        out.append(os.path.join(mod, "NativePairing", n))
out.append(os.path.join(test, "IosFtpsLoopbackFilesApp.swift"))
print("\n".join(out))
PY
  [ "$(wc -l < "$W/out/swift-inputs.txt" | tr -d ' ')" -ge 150 ] || die "unexpected swift input count"
  grep -c "IosFtpsLoopbackFilesApp" "$W/out/swift-inputs.txt" | grep -qx 1 || die "app source not exactly once"
  ( cd "$1" && xargs shasum -a 256 < "$W/out/swift-inputs.txt" ) > "$W/logs/swift-inputs.sha256"
}

link_app() {  # $1=K $2=A(.a) $3=APP(.app dizini; Info.plist zaten var)
  TGT=arm64-apple-ios$DEPLOY-simulator
  # Simulator Keychain: ad-hoc imzalı uygulamada `application-identifier` __TEXT,__entitlements bölümünden gelir (xcodebuild Simulator ürünündeki
  # yöntem; ölçüldü: ürün uygulaması `<TeamID>.<bundle>` taşır). Fixture için kullanıcı/ekibe ait olmayan sabit sahte önek kullanılır.
  FBID="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$3/Info.plist")"
  printf '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>application-identifier</key><string>KLODAFIX00.%s</string></dict></plist>\n' "$FBID" > "$W/out/fixture-entitlements.plist"
  plutil -lint "$W/out/fixture-entitlements.plist" > "$W/logs/entitlements-lint.log" || die "entitlements plist invalid"
  xcrun --sdk iphonesimulator clang -target "$TGT" -isysroot "$SDK" -c "$1/$TEST/OwnedLoopbackRoute.c" -o "$W/out/OwnedLoopbackRoute.o" > "$W/logs/clang-route.log" 2>&1 || die "clang route failed"
  set +e
  xargs xcrun --sdk iphonesimulator swiftc -target "$TGT" -sdk "$SDK" -swift-version 5 -Onone -parse-as-library -module-name KlodaFtpsFixtureFiles \
    -DKLODA_FTPS_NATIVE -DKLODA_FTPS_OWNED_FIXTURE -import-objc-header "$1/$MOD/NativePairing/KlodaPairingNative.h" \
    -Xlinker -sectcreate -Xlinker __TEXT -Xlinker __entitlements -Xlinker "$W/out/fixture-entitlements.plist" \
    -o "$3/KlodaFtpsFixtureFiles" "$W/out/OwnedLoopbackRoute.o" "$2" "$1/$PAIR" \
    -lsqlite3 -framework Security -framework Network -framework SystemConfiguration -framework LocalAuthentication \
    -framework UIKit -framework Photos -framework UniformTypeIdentifiers -framework BackgroundTasks -framework ActivityKit \
    -framework UserNotifications -framework CryptoKit < "$W/out/swift-inputs.txt" > "$W/logs/swiftc-link.log" 2>&1
  SRC=$?
  set -e
  [ "$SRC" -eq 0 ] || { grep -E "error:" "$W/logs/swiftc-link.log" | head -12 >&2; die "swiftc compile/link failed rc=$SRC (see $W/logs/swiftc-link.log)"; }
  plutil -lint "$3/Info.plist" > "$W/logs/plist-lint.log"
  codesign --force --sign - "$3" > "$W/logs/codesign.log" 2>&1 || die "ad-hoc codesign failed"
  lipo -archs "$3/KlodaFtpsFixtureFiles" | grep -qx arm64 || die "executable not arm64"
  xcrun vtool -show-build "$3/KlodaFtpsFixtureFiles" > "$W/logs/vtool.txt" 2>&1 || die "vtool failed"
  grep -q 'IOSSIMULATOR' "$W/logs/vtool.txt" || die "executable is not an iOS Simulator build"
  # cleanup modu gerçekten bağlandı: yalnız KENDİ fixture dizgeleri (Swift string sabitleri) ve Security çağrıları
  otool -X -s __TEXT __entitlements "$3/KlodaFtpsFixtureFiles" | grep -q . || die "__TEXT,__entitlements section absent"
  strings -a "$3/KlodaFtpsFixtureFiles" | grep -q 'cleanup' || die "cleanup mode string absent"
  strings -a "$3/KlodaFtpsFixtureFiles" | grep -q 'absentStatus' || die "cleanup result key absent"
  for k in 'cleanup-' passwordAbsent deleteStatus challenge; do strings -a "$3/KlodaFtpsFixtureFiles" | grep -q -- "$k" || die "sandbox-receipt cleanup code absent: $k"; done
  xcrun nm --no-llvm-bc "$3/KlodaFtpsFixtureFiles" 2>/dev/null | grep -q 'SecItemCopyMatching' || die "SecItemCopyMatching not linked"
  xcrun nm --no-llvm-bc "$3/KlodaFtpsFixtureFiles" 2>/dev/null | grep -q 'SecItemDelete' || die "SecItemDelete not linked"
}

UDID_FIXED=61A45399-D0F9-43C0-B356-E1EF6712E960
write_identity() {  # $1=APP $2=A: köke ait exact bundle/nonce/UDID/aday hash'i (run fazı bununla denetler)
  python3 -I - "$W" "$1" "$2" "$UDID_FIXED" <<'PY'
import hashlib, json, os, plistlib, re, sys
W, app, a, udid = sys.argv[1:5]
pl = plistlib.load(open(app + "/Info.plist", "rb"))
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
run = re.sub(r"[^a-z0-9]", "", os.path.basename(W).rsplit(".", 1)[-1].lower())
path = os.path.join(W, "root-identity.json")
json.dump({"bundle": pl["CFBundleIdentifier"], "nonce": pl["FixtureNonce"], "udid": udid, "run": run,
           "app_exec_sha256": sha(app + "/KlodaFtpsFixtureFiles"), "test_a_sha256": sha(a)}, open(path, "w"), indent=1)
os.chmod(path, 0o600)
PY
}

SDK="$(xcrun --sdk iphonesimulator --show-sdk-path)" || die "no iphonesimulator SDK"
[ -z "$(pgrep -f 'xcodebuild|simctl' || true)" ] || die "xcodebuild/simctl running (not ours)"

if [ "$PHASE" = relink ]; then
  [ -n "$ROOTARG" ] && [ -d "$ROOTARG/clone" ] || die "relink needs an existing compile root"
  W="$ROOTARG"; K="$W/clone"
  A="$(ls "$W"/so/target/aarch64-apple-ios-sim/release/libkloda_ftps_native.a)" || die "test .a missing"
  APP="$W/out/KlodaFtpsFixtureFiles.app"; [ -f "$APP/Info.plist" ] || die "app Info.plist missing"
  mkdir -p "$W/logs/relink"; LOGS="$W/logs"
  prod_hashes > "$W/logs/production-before-relink.sha256"
  cp "$R/$APPSRC" "$K/$APPSRC"; patch_app "$K/$APPSRC"
  diff -u "$R/$APPSRC" "$K/$APPSRC" > "$W/logs/cleanup-mode.diff" || true
  [ -s "$W/logs/cleanup-mode.diff" ] || die "cleanup patch produced no diff"
  gen_inputs "$K"
  reissue_identity "$APP"                       # link_app imza/entitlements bundle'ı plist'ten okur: önce
  link_app "$K" "$A" "$APP"
  write_identity "$APP" "$A"
  KLODA_IOS_CHECK_IDENTITY_ONLY=1 sh "$0" "$R" run "$W" || die "check_identity failed on the relinked candidate"   # gerçek relink adayı üzerinde
  prod_hashes > "$W/logs/production-after-relink.sha256"
  cmp "$W/logs/production-before-relink.sha256" "$W/logs/production-after-relink.sha256" || die "production artifact hashes changed"
  echo "BUNDLE=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist") NONCE=$(/usr/libexec/PlistBuddy -c 'Print :FixtureNonce' "$APP/Info.plist")"
  echo "APP_EXEC_SHA256=$(shasum -a 256 "$APP/KlodaFtpsFixtureFiles" | cut -d' ' -f1) TEST_A_SHA256=$(shasum -a 256 "$A" | cut -d' ' -f1)"
  echo "IOS_FTPS_RELINK_PASS root=$W (Simulator/servis/kurulum yok; anahtarlar korundu)"
  exit 0
fi

[ "$PHASE" = compile ] || die "unknown phase $PHASE"
# --- önkoşul ---
rustup target list --installed --toolchain "$TC" | grep -qx aarch64-apple-ios-sim || die "rust target aarch64-apple-ios-sim missing (no install attempted)"
for f in "$R/$MOD/NativeFtps/kloda_ftps.h" "$R/$APPSRC" "$R/$TEST/OwnedLoopbackRoute.c" "$R/$PAIR"; do [ -f "$f" ] || die "missing $f"; done
W="$(mktemp -d /private/tmp/kloda-p3-06-ftps-ios.XXXXXXXX)"; chmod 700 "$W"
RUN="$(basename "$W" | sed 's/.*\.//' | tr 'A-Z' 'a-z')"
mkdir -p "$W/pki" "$W/logs" "$W/out" "$W/so"
echo "ROOT=$W RUN=$RUN"
PASSED=""
cleanup() { if [ -z "$PASSED" ]; then rm -f "$W/pki/ca.key" "$W/pki/server.key" "$W/pki/server.csr" "$W/pki/ca.srl"; echo "FAILED: private keys removed from $W/pki" >&2; fi; }
trap cleanup EXIT
trap 'exit 130' INT; trap 'exit 143' TERM
prod_hashes > "$W/logs/production-before.sha256"
git -C "$R" rev-parse HEAD > "$W/logs/start-head.txt"

openssl req -x509 -newkey rsa:3072 -nodes -keyout "$W/pki/ca.key" -out "$W/pki/ca.pem" -days 3 -subj "/CN=kloda-p3-06-ios-test-ca" \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:0" -addext "keyUsage=critical,keyCertSign,cRLSign" -addext "subjectKeyIdentifier=hash" >/dev/null 2>&1
openssl req -newkey rsa:2048 -nodes -keyout "$W/pki/server.key" -out "$W/pki/server.csr" -subj "/CN=localhost" >/dev/null 2>&1
printf 'subjectAltName=DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always\n' > "$W/pki/ext.cnf"
openssl x509 -req -in "$W/pki/server.csr" -CA "$W/pki/ca.pem" -CAkey "$W/pki/ca.key" -CAcreateserial -out "$W/pki/server.pem" -days 2 -extfile "$W/pki/ext.cnf" >/dev/null 2>&1
openssl verify -x509_strict -CAfile "$W/pki/ca.pem" -verify_hostname localhost "$W/pki/server.pem"
openssl x509 -in "$W/pki/ca.pem" -outform DER -out "$W/so/test-ca.der"
echo "CA_FILE_SHA256=$(shasum -a 256 "$W/pki/ca.pem" | cut -d' ' -f1)"

K="$W/clone"; cp -cR "$R" "$K"
export RUSTC="$(rustup which --toolchain "$TC" rustc)" RUSTDOC="$(rustup which --toolchain "$TC" rustdoc)"
export SDKROOT="$SDK" IPHONEOS_DEPLOYMENT_TARGET="$DEPLOY" KLODA_FTPS_FIXTURE_CA_DER="$W/so/test-ca.der"
rustup run "$TC" cargo build --locked --offline --lib --release --manifest-path "$K/packages/ftps-native/Cargo.toml" \
  --features owned-fixture --target aarch64-apple-ios-sim --target-dir "$W/so/target" > "$W/logs/build-a.log" 2>&1 || { tail -25 "$W/logs/build-a.log" >&2; die "cargo build failed (see $W/logs/build-a.log)"; }
A="$W/so/target/aarch64-apple-ios-sim/release/libkloda_ftps_native.a"
[ "$(lipo -archs "$A")" = arm64 ] || die ".a is not arm64-only"
xcrun nm --no-llvm-bc -gU "$A" > "$W/logs/nm-test-a.txt" 2>"$W/logs/nm-test-a.err" || die "nm failed"
[ -s "$W/logs/nm-test-a.txt" ] || die "nm empty"
for s in _kloda_ftps_owned_fixture_marker _kloda_ftps_publish_bound _kloda_ftps_read_bound; do
  awk -v s="$s" '$NF==s {f=1} END {exit !f}' "$W/logs/nm-test-a.txt" || die "missing symbol $s in test .a"; done
python3 -I -c 'import sys; d=open(sys.argv[1],"rb").read(); a=open(sys.argv[2],"rb").read(); sys.exit(0 if len(d)>100 and d in a else 1)' "$W/so/test-ca.der" "$A" || die "test CA DER not embedded in test .a"
PA="$(ls "$R/$XCF"/ios-arm64-simulator/*.a)"
xcrun nm --no-llvm-bc -gU "$PA" > "$W/logs/nm-prod-a.txt" || die "nm prod failed"
[ -s "$W/logs/nm-prod-a.txt" ] || die "nm prod empty"
! awk '$NF=="_kloda_ftps_owned_fixture_marker" {f=1} END {exit !f}' "$W/logs/nm-prod-a.txt" || die "production slice carries fixture marker"
python3 -I -c 'import sys; d=open(sys.argv[1],"rb").read(); a=open(sys.argv[2],"rb").read(); sys.exit(1 if d in a else 0)' "$W/so/test-ca.der" "$PA" || die "test CA found in production slice"
echo "TEST_A_SHA256=$(shasum -a 256 "$A" | cut -d' ' -f1)"

cp "$R/$APPSRC" "$K/$APPSRC"; patch_app "$K/$APPSRC"
diff -u "$R/$APPSRC" "$K/$APPSRC" > "$W/logs/cleanup-mode.diff" || true
[ -s "$W/logs/cleanup-mode.diff" ] || die "cleanup patch produced no diff"
gen_inputs "$K"
APP="$W/out/KlodaFtpsFixtureFiles.app"; mkdir -p "$APP"
BID="com.kloda.fixture.ftps16c.files.r$RUN"
NONCE="$(python3 -I -c 'import uuid;print(uuid.uuid4())')"
cat > "$APP/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>$BID</string>
<key>CFBundleExecutable</key><string>KlodaFtpsFixtureFiles</string>
<key>CFBundleName</key><string>KlodaFtpsFixtureFiles</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>MinimumOSVersion</key><string>$DEPLOY</string>
<key>UIDeviceFamily</key><array><integer>1</integer></array>
<key>FixtureNonce</key><string>$NONCE</string>
<key>LSSupportsOpeningDocumentsInPlace</key><true/>
<key>UIFileSharingEnabled</key><true/>
</dict></plist>
EOF
link_app "$K" "$A" "$APP"
write_identity "$APP" "$A"
KLODA_IOS_CHECK_IDENTITY_ONLY=1 sh "$0" "$R" run "$W" || die "check_identity failed on the compiled candidate"
echo "APP_EXEC_SHA256=$(shasum -a 256 "$APP/KlodaFtpsFixtureFiles" | cut -d' ' -f1) BUNDLE=$BID NONCE=$NONCE"
prod_hashes > "$W/logs/production-after.sha256"
cmp "$W/logs/production-before.sha256" "$W/logs/production-after.sha256" || die "production artifact hashes changed"
[ "$(git -C "$R" rev-parse HEAD)" = "$(cat "$W/logs/start-head.txt")" ] || die "HEAD moved"
PASSED=1
echo "IOS_FTPS_1_COMPILE_LINK_PASS root=$W (Simulator/servis/kurulum yok; özel anahtarlar $W/pki içinde 0600; run fazı veya hata siler)"
