# Desktop renderer visual review

Frozen reference: docs/ui/lovable-reference/cb1143d16f73/source and screenshots/desktop-receiver.png.

Observed current renderer screenshots: welcome-tr-wide.png, home-tr-wide.png, catalogue-tr-wide.png, home-de-narrow.png. Automated captures cover TR/EN/DE, 1440x1000 and 640x900, seven surfaces each (42 captures).

The reference's warm OKLCH surfaces, 256px sidebar, 64px toolbar, open-ring logo, Lucide navigation, dark selected navigation, rounded cards and responsive flat navigation are mapped to real Desktop components. Welcome keeps the two-column illustration/action-card structure. Narrow German navigation wraps without horizontal overflow, and real status descriptions remain readable. Final welcome capture waits for the entrance animation to finish; reduced-motion has a global CSS override.

Intentional functional substitutions: prototype demo badges, fictional ready/devices/counts and global folder grants are absent. Native receiver status is always read from the existing bridge and cannot assert phone reachability or access permission. Folder access routes to the existing per-peer native grant flow. Autostart and quit retain existing native controls in settings/status; the prototype switch is not a second state source. Existing management surfaces retain their real contents and are styled through shared tokens/cards. Provider parameter pages explicitly show unavailable and disable input until adapters are implemented; WebDAV links to its existing real workflow.

This is a visual mapping review with disposable synthetic IPC, not pixel-diff acceptance or native/platform/physical acceptance. No new adapter, trust, permission, device or user archive was accessed. Initial sandbox Electron launch aborted with SIGABRT; the isolated authorized rerun completed. Expected fixture status-read error was injected to verify removal of stale success.

Final typography followup: local official Inter Regular/Medium/SemiBold/Bold with OFL are emitted in the production renderer. All 42 screenshots were regenerated after document.fonts.ready and assert Inter font availability plus an actual loaded Inter FontFace (not merely a fallback font-family string). Every capture records the loaded face weights/status. Final build and renderer smoke each exited 0. No test suite was rerun in this font-only followup.

Final font metadata correction rerun: distinct internal PostScript names for each weight were regenerated without outline changes. Production build and the existing 42-capture renderer smoke both exited0; all captures again confirm actual Inter loading, no horizontal overflow and no new inline styles. Source and font-asset SHA256 values are refreshed in checks.json. The previous322-test full suite and13-test targeted suite remain earlier results.
