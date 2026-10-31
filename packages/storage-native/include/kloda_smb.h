#ifndef KLODA_SMB_H
#define KLODA_SMB_H
#include <stdint.h>
#include <stddef.h>
/* Call on a native worker; consumes transferred snapshot_fd on every return.
 * Callback event 0: fresh native admission; 1: create ACK; 2: all writes+flush ACK
 * (bytes is confirmed size); 3: close ACK; 4: no-replace rename ACK; 5: byte/hash verified.
 * Persist ACKs before returning; never discard an ACK because admission changed.
 * Callback returns 0 on success; cannot unwind. No pointer is retained after return.
 * Return 0 is wire evidence only. Native owner atomically authorizes Completed.
 * Errors: 1 invalid, 2 local snapshot/socket I/O, 3 SMB/unknown outcome, 4 admission,
 * 5 receipt I/O, 6 snapshot changed, 7 byte verification, 8 internal failure.
 */
typedef int32_t (*kloda_smb_receipt)(void *context, int32_t event, uint64_t bytes);
int32_t kloda_smb_publish(const uint8_t *json, size_t length, int32_t snapshot_fd,
    kloda_smb_receipt callback, void *context);
/* Native route-bound path. Consumes both FDs on every return; no new connection,
 * DNS or fallback. Socket must be connected to the exact request peer, exclusively
 * transferred after native OS route admission; callbacks/Completed still recheck it.
 * The legacy entry remains for the isolated wire fixture, not route admission proof. */
int32_t kloda_smb_publish_bound(const uint8_t *json, size_t length,
    int32_t snapshot_fd, int32_t socket_fd, kloda_smb_receipt callback, void *context);
#endif
