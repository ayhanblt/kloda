# Windows SMB LAN readiness /01.11.2026

The user created the dedicated empty Windows share and test account. User-reported share encryption is True; server signing and reject-unencrypted were already True. Host TCP445 succeeded. No password was collected, SMB negotiation/authentication attempted or share file created.

The unchanged iOS route rejected the real peer three times. The unchanged native witness identified Wi-Fi en1/192.168.1.91/24 correctly. Temporary source-copy instrumentation isolated the failure: AF_INET address length16, netmask length7. Production code used the full sockaddr_in length requirement for both, dropping the valid prefix.

The fix adds a separate IPv4 netmask reader: family/length checked, only declared bytes copied, omitted trailing bytes zero-filled. Ordinary IP parsing, contiguous-mask validation, peer/self/subnet restrictions, ambiguity and native route-current witnesses remain intact. No new dependency/export/SDK patch/schema/signing/network change. A same-agent separate review checked byte bounds and caller null guards; Claude final review remains pending.

Four actual-source host tests pass; the temporary old-reader negative control fails the short-mask regression. Current-route metadata admission for192.168.1.54 passes on the owned Simulator; loopback/Docker gateway remain rejected. Device+Simulator native package/export checks, actual production iOS library Clippy -D warnings and SMB-enabled full Simulator app build/link pass. Earlier failed host harness/Clippy invocations are retained in referenced raw logs, not counted PASS. Metadata admission is not bound socket/authentication or transfer acceptance.

Reproduce metadata: `python3 tools/check-ios-smb-lan-readiness.py 497AAA0F-967E-4781-9468-3F05CA2D3D5A --owned-peer 192.168.1.54`. Only the explicitly supplied endpoint is added; this tool never connects. The owned Simulator was shut down, Docker state unchanged; Windows fixture remains for the next test. No credential is recorded here. The old review packet must be refreshed before the final Claude review.
