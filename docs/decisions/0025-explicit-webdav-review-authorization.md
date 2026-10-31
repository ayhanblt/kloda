# ADR0025 — explicit WebDAV review authorization

Date: 2026-10-30. Status: approved by user (option A).

An old WebDAV intent may be reviewed under a new context only through a distinct
explicit action in the visible app. The same target identity and still-selected
source identity/current bytes (and Photos metadata where applicable) must be
validated. Record a separate immutable authorization for this request and new
context; never rewrite the original header, binding or ACK history. Do not load
or resume this authority after cancellation, departure, crash or another request.

Only known PUT ACK / verified temporary bytes may proceed to no-overwrite MOVE;
a received MOVE ACK plus full GET verification may settle. Unknown replies or
equal hashes cannot create authority. Skip remains terminal and not Completed.
No automatic rebinding, target/source transfer, PC authority or cloud adoption.

The user separately approved test-only new synthetic PNG/owned album/favorite
mutation solely in Kloda-WebDAV15-Disposable Simulator / fixture.webdav15;
see the scoped fixture approval document. Product gallery remains read-only.
