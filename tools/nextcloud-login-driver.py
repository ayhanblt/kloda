#!/usr/bin/env python3
"""Plays the user's browser part of Nextcloud Login Flow v2 against the owned fixture only."""
from pathlib import Path
from urllib.parse import urljoin, urlsplit
import argparse
import html
import http.cookiejar
import re
import ssl
import urllib.parse
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("login_url")
parser.add_argument("--deny", action="store_true", help="Open the flow but never grant access")
args = parser.parse_args()
origin = urlsplit(args.login_url)
if origin.scheme != "https" or origin.hostname not in ("127.0.0.1", "10.0.2.2") or origin.port != 18443:
    raise SystemExit("Only the owned loopback Nextcloud fixture is allowed")
base = "https://127.0.0.1:18443"
# The device's browser would address the server by the login URL's host (10.0.2.2 on the emulator). The driver
# connects over loopback but sends that Host/Origin, so Nextcloud binds the grant to the same server the app entered.
browser = "https://" + origin.netloc
password = (Path("/tmp/kloda-step18/nextcloud") / "admin-password").read_text()
context = ssl.create_default_context(cafile="/tmp/kloda-step15/https-fixture/ca.crt")
context.verify_flags &= ~ssl.VERIFY_X509_STRICT
jar = http.cookiejar.CookieJar()

def local(url):
    parts = urlsplit(url)
    return base + parts.path + ("?" + parts.query if parts.query else "")

class Redirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return urllib.request.Request(local(urljoin(req.full_url, newurl)), headers={"Host": origin.netloc})

opener = urllib.request.build_opener(urllib.request.HTTPSHandler(context=context), urllib.request.HTTPCookieProcessor(jar), Redirect)
opener.addheaders = [("User-Agent", "Mozilla/5.0 Kloda fixture driver"), ("Accept", "text/html")]

def get(url):
    with opener.open(urllib.request.Request(local(url), headers={"Host": origin.netloc}), timeout=30) as reply:
        return reply.geturl(), reply.read().decode()

def post(url, fields):
    data = urllib.parse.urlencode(fields).encode()
    # Nextcloud rejects a login POST without a same-origin browser Origin header ("invalidOrigin").
    request = urllib.request.Request(local(url), data=data, method="POST", headers={"Origin": browser, "Host": origin.netloc})
    with opener.open(request, timeout=30) as reply:
        return reply.geturl(), reply.read().decode()

def token(page):
    match = re.search(r'data-requesttoken="([^"]+)"', page)
    if not match:
        raise SystemExit("request token missing")
    return html.unescape(match.group(1))

url, page = get(args.login_url)
grant = re.search(r'id="login-form" action="([^"]+)"', page)
if not grant:
    raise SystemExit("flow page without grant form")
if args.deny:
    print("flow opened, access not granted")
    raise SystemExit(0)
url, page = get(html.unescape(grant.group(1)))
if "/login?" in url or 'name="password"' in page or "/login" == urlsplit(url).path:
    redirect = urllib.parse.parse_qs(urlsplit(url).query).get("redirect_url", [""])[0]
    url, page = post(base + "/login", {"user": "owned", "password": password, "timezone": "UTC",
        "timezone_offset": "0", "requesttoken": token(page), "redirect_url": redirect})
form = re.search(r'<form[^>]*method="post"[^>]*action="([^"]*login/v2/grant)"', page, re.IGNORECASE)
state = re.search(r'name="stateToken" value="([^"]+)"', page)
if not form or not state:
    Path("/tmp/kloda-step18/probe/after-login.html").write_text(url + "\n" + page)
    raise SystemExit("grant form missing after login")
url, page = post(urljoin(url, html.unescape(form.group(1))), {"stateToken": html.unescape(state.group(1)), "requesttoken": token(page)})
print("granted" if urlsplit(url).path.endswith("/login/v2/grant") or "connected" in page.lower() else "grant result unclear: " + urlsplit(url).path)
