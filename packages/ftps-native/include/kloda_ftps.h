#pragma once
#include <stdint.h>
#include <stddef.h>
typedef int32_t (*kloda_ftps_receipt)(void *, int32_t, uint64_t);
/* Return a fresh owned duplicate bound to the caller's same OS route lease, or -1. */
typedef int32_t (*kloda_ftps_connect)(void *, const uint8_t *, size_t, uint16_t);
/* Both FDs consumed on every return. Callbacks borrowed only until return. */
int32_t kloda_ftps_publish_bound(const uint8_t *,size_t,int32_t,int32_t,kloda_ftps_receipt,kloda_ftps_connect,void *);
int32_t kloda_ftps_read_bound(const uint8_t *,size_t,int32_t,int32_t,kloda_ftps_receipt,kloda_ftps_connect,void *);
