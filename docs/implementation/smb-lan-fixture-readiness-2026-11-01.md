# SMB16a — measured LAN blocker and next fixture /01.11.2026

Status: **WINDOWS_TCP_AND_IOS_ROUTE_READY**,16a transfer not yet accepted.01.11 user-created Windows encrypted empty fixture192.168.1.54/KlodaTest16a; [fresh netmask fix/readiness evidence](evidence/smb-windows-lan-2026-11-01/manifest.json). Production iOS admission now passes; no SMB authentication or share write performed. Earlier Docker-only findings below remain historical, not a current missing-server claim. [Single readiness manifest](evidence/smb-lan-readiness-2026-11-01/manifest.json).

## What was actually checked

The new `tools/check-ios-smb-lan-readiness.py` compiles the actual unchanged production Rust route modules and Objective-C Network witness for the existing owned Simulator. The standalone diagnostic calls Route::open/check only; it never calls connect/publish/read or releases a password. Source hashes, exact dependencies and raw logs are retained. Actual production prefix control vectors pass.

Measured result: localhost127.0.0.1 is outside the supported address policy. Both the current Docker VM gateway metadata target and the actual private IP of the temporarily-running owned strict Samba container were supported address shapes but failed native route admission. No TCP/SMB socket was opened, no peer scanned/contacted. The gateway is not claimed to be an SMB endpoint. This result covers the measured topology at this time, not every possible future Docker/VM layout.

The container's existing publication remained127.0.0.1:27445; no host mount/network/alias/firewall/DNS/VPN/route changes. That exact owned container and the Simulator were stopped afterward. No Files/Photos mutation or credential access. The initial diagnostic fixture visibility compile failure is retained, not counted as production failure or a passing probe.

## Concrete missing fixture

A separate owned endpoint on the actual selected Wi-Fi/wired prefix is needed. It may be another test machine or a legitimately bridged disposable guest with its own LAN IP; it need not be a personal NAS or cloud service. It must pass the unchanged native source/interface/current-route proof. A localhost publication, the Mac's own source IP, fabricated witness/interface class, or an IP alias used to manufacture a pass is not an accepted replacement.

The ready-to-run existing server source is `tools/smb-fixture/Dockerfile` plus `strict.conf`: SMB3+, mandatory signing/encryption, no guest. It is currently a loopback fixture with public fictional credentials. **Do not simply republish that known-password image to a LAN interface.** For a separately approved LAN fixture, prepare a fresh test account/password and empty owned share/root, explicit server bind/source restriction and creation/cleanup ledger. No personal share/account/root may be substituted.

The next actual acceptance starts with one newly generated small Files source and native selected bookmark/provider, then current-route SMB publication, own Completed catalog, fresh read/hash and no-overwrite local restore/repeat/restart/context fences. No fake upload receipt or inferred no-create after lost ACK. The separately completed PhotoKit importer component remains narrower; a new full Photos network/source fixture requires its exact bounded scope before media writes.

## Same-Mac VM option — investigated, not created

No installed CLI was found among prlctl/tart/limactl/qemu-system-aarch64/vfkit in this environment. This is not a statement that no virtualization application could exist elsewhere.

Apple's [VZBridgedNetworkDeviceAttachment documentation](https://developer.apple.com/documentation/virtualization/vzbridgednetworkdeviceattachment) requires `com.apple.vm.networking` and a physical host interface; its [NAT attachment](https://developer.apple.com/documentation/virtualization/vznatnetworkdeviceattachment) provides indirect translated connectivity. NAT alone is not proof that this iOS route policy admits the guest. No claim is made about obtaining the bridged entitlement automatically. No new hypervisor, VM image, bridge, entitlement, privilege escalation or broad LAN listener was installed/created/enabled.

A VM would require a concrete new isolated fixture setup and verified network/signing/resource conditions. That work must not silently alter the user's existing host/Docker networks or reuse a personal VM. Existing Docker alone did not provide a measured admitted endpoint.

## Reproducible diagnostic

`python3 tools/check-ios-smb-lan-readiness.py 497AAA0F-967E-4781-9468-3F05CA2D3D5A`

The diagnostic preserves the container's running state and never starts it. It reports a private-container-IP case only when an IP is present in Docker inspect. This work group temporarily started/stopped only the ledger-owned strict container outside the diagnostic to obtain that case. The default command still performs no network connection, auth or media test. Results ending routeOpened=false are rejection evidence, not successful LAN transfer acceptance.

Independent review and12/20/21 signing/device/native visual/a11y/performance acceptance remain open.16b remains held under the user's order.
