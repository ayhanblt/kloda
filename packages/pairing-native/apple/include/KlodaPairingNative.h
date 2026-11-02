#ifndef KLODA_PAIRING_NATIVE_H
#define KLODA_PAIRING_NATIVE_H
#include <stddef.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
/* Native Swift only. Never expose a directory, owner ID or these functions to JS.
 * Inputs remain caller-owned, UTF-8 and readable for the entire synchronous call.
 * JSON replies are native-owned; free exactly once, never with C free().
 * Replies may contain transient pairing state: never log or persist them.
 * Rust retains existing platform gates. An ABI success is not LAN/custody proof. */
char *kloda_ios_open(const uint8_t *directory, size_t length);
/* Foreground commands retain the epoch returned by activation, never recapture it. */
char *kloda_ios_request(uint64_t owner, const uint8_t *json, size_t length, uint64_t expected_epoch);
/* Synchronous lifecycle fence; does not wait for native actor network I/O. */
char *kloda_ios_suspend(uint64_t owner);
/* Native lifecycle only; actual visible UI determines active. Accepts only 0/1. */
char *kloda_ios_set_foreground(uint64_t owner, uint8_t active);
/* Only a native queue may pass its verified FD; caller retains ownership. */
char *kloda_ios_transfer(uint64_t owner, const uint8_t *record, size_t record_length,
                        const uint8_t *json, size_t json_length, int32_t descriptor, uint64_t expected_epoch);
/* Native BGTask callback only: a cancellable, exact-record Files-upload lease.
 * Never expose these functions or lease IDs to JS; they do not activate UI/trust.
 * End invalidates synchronously; current remote results still require reconciliation. */
char *kloda_ios_background_begin(uint64_t owner, const uint8_t *record, size_t record_length);
char *kloda_ios_background_end(uint64_t owner, const uint8_t *lease, size_t lease_length);
char *kloda_ios_background_transfer(uint64_t owner, const uint8_t *record, size_t record_length,
                                   const uint8_t *json, size_t json_length, int32_t descriptor,
                                   const uint8_t *lease, size_t lease_length);
/* Native synchronous SMB worker only; never expose to JS.
 * Buffer, context, borrowed socket and borrowed lease remain valid only during
 * the call. The worker must dup before handing a socket to a consuming ABI.
 * Callback must not unwind or retain the lease. Return 0 for success.
 * Open retains actual OS route observation until worker returns; no DNS,
 * fallback or pairing/PC authority. Nonzero current blocks auth/Completed. */
typedef int32_t (*KlodaIosLanWorker)(void *context, int32_t borrowed_socket, const void *borrowed_lease);
int32_t kloda_ios_lan_with_socket(const uint8_t *address, size_t length, uint16_t port,
                                KlodaIosLanWorker worker, void *context);
int32_t kloda_ios_lan_current(const void *borrowed_lease);
void kloda_ios_reply_free(char *reply);
#ifdef __cplusplus
}
#endif
#endif
