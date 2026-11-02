#ifndef KLODA_SFTP_H
#define KLODA_SFTP_H
#include <stddef.h>
#include <stdint.h>
// Worker-only. Both descriptors consumed on every return. Callback/lease never escapes.
// Event0 must check native route/source/profile/pin generations. ACKs1..5 are wire evidence,
// never native Completed authority. No retry/adoption/remote cleanup is performed.
typedef int32_t (*kloda_sftp_receipt)(void *, int32_t, uint64_t);
int32_t kloda_sftp_publish_bound(const uint8_t *,size_t,int32_t,int32_t,kloda_sftp_receipt,void *);
int32_t kloda_sftp_read_bound(const uint8_t *,size_t,int32_t,int32_t,kloda_sftp_receipt,void *);
#endif
