# ADR0018 — Desktop background receiver lifecycle

- Date: 2026-10-16.
- Owner: Ayhan.
- Status: approved product/security behavior for Windows, macOS and Linux; implementation and platform acceptance tracked separately.

## Decision

Closing the window hides Kloda while the existing single application owner continues receiving files from currently authorized peers. Blur, minimize, hide and internal navigation must not close the native receiver. Windows notification area, macOS menu bar and supported Linux tray/AppIndicator provide reopen, actual receiver/backup status, error details and explicit Quit controls. Sleep, shutdown, OS suspension or unavailable networking are not continuous-transfer guarantees.

Background receipt is not new trust. Creating a QR invitation, approving a device and granting a backup scope still require an explicit action in a visible, focused, trusted main frame. Leaving that foreground context invalidates preconsume invitation/approval work and stale callbacks, while committed trust/ACK recovery, current ACLs, authorized file work and journals remain. No automatic grant, broadened ACL, software identity fallback or central LAN login/JWT/KMS prerequisite is introduced.

Every normal app-menu, tray-menu or keyboard Quit request must use one default-Cancel confirmation: “Kloda’dan çıkarsanız bu bilgisayara yedekleme yapılamaz. Yedeklemelerin devam etmesi için Kloda’yı yeniden açmanız gerekir.” Active file work gets an additional interruption warning. Cancel keeps the owner/scheduler running. Confirmed Quit stops admission/owner and sender safely without marking pending work Completed or deleting recovery state. OS forced termination cannot promise a confirmation or completion.

At the first suitable setup surface, ask whether Kloda should start at login. Only explicit opt-in enables it. Settings must allow changing it and display the observed OS state, including disabled/blocked/unsupported behavior. Login launch should be tray-first when a usable tray control exists. Development executables must not silently register the shared Electron binary as an installed Kloda application.

A real receiver/backup error requiring intervention adds an exclamation mark to the tray icon. Details remain accessible from the menu; the indicator clears when the observed error resolves. No previous backup, a merely idle receiver or lack of selected sources is not itself an error.

Linux desktop environments differ in StatusNotifierItem/AppIndicator/legacy tray and XDG autostart support. A Tray object alone is not proof of a visible/reachable control. Where control is unsupported or unverified, keep a visible window with status/settings/Quit controls and explain the limitation; never silently hide an inaccessible application. Actual supported environments require separate desktop-session acceptance. This decision does not select a Linux native identity/storage provider or any software key fallback.

## Boundaries

ADR0013 frozen QR bytes, ADR0014 native secret/session ownership, ADR0015 development/production separation and ADR0016 PC-local ACL/current-scope/revoke/publication fences remain. Windows authority-state/continuity remains decision-blocked, macOS signing/provisioning open, Linux provider unselected. No existing key/pin/cert/epoch/authority migration, reset or cleanup. Physical acceptance remains paused; automated fixtures and isolated lifecycle smoke are not Windows/macOS/Linux hardware or OS session acceptance.

## Implemented scope and Linux support limit

The existing owner is kept across UI teardown; `suspendPairing` invalidates preconsume work using a synchronous native foreground generation and durable-authorization fence. `receiverStatus` exposes listener state, a conservative count of live FILE channels, and observed errors, never QR/keys/pins/paths. Normal app/tray/keyboard Quit waits for native close after explicit confirmation; sender shutdown preserves acknowledged journal phases and projects interrupted runs as failed. The shared shell has visible status, login-start controls and Quit even without tray support.

Packaged Windows/macOS use Electron login-item APIs and observed OS state; unpackaged builds never register the shared Electron executable. Linux uses an owned profile-specific XDG autostart entry for a stable installed executable and an identified desktop session, respecting disabled/desktop restrictions without replacing another entry. AppImage transient-mount launchers are unsupported until a stable launcher is selected. Global desktop policy can still suppress an otherwise configured XDG entry; configuration is not proof that login launch ran.

Electron does not expose Linux tray visibility/registration success. Consequently Linux starts with a visible window, including login launch, until this session's actual tray activation/menu reopen proves a reachable control. Then close-to-tray is enabled; absent/failed/unverified tray keeps visible controls. No distro/desktop environment is declared runtime-accepted by mocked Linux tests. GNOME environments may require an AppIndicator extension; neither presence nor installation is assumed or performed. Windows/macOS opt-in login launch can start hidden when tray construction succeeds. Real OS-session/login/tray/theme/accessibility acceptance remains open on all three platforms.

Sources checked through Context7: [Electron Tray](https://github.com/electron/electron/blob/main/docs/api/tray.md), [Electron app/login-item and before-quit](https://github.com/electron/electron/blob/main/docs/api/app.md), [XDG autostart](https://specifications.freedesktop.org/autostart/latest/), [Desktop Entry Exec](https://specifications.freedesktop.org/desktop-entry/latest/exec-variables.html). [Implementation and evidence](../implementation/implementation-session-handoff.md#desktop-background-lifecycle--2026-10-16).
