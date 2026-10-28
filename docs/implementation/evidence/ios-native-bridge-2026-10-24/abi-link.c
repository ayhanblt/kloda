#include "KlodaPairingNative.h"
/* Link-time references only. No function is executed and no owner is opened. */
char *(*const kloda_check_open)(const uint8_t *, size_t) = kloda_ios_open;
char *(*const kloda_check_request)(uint64_t, const uint8_t *, size_t) = kloda_ios_request;
char *(*const kloda_check_suspend)(uint64_t) = kloda_ios_suspend;
char *(*const kloda_check_transfer)(uint64_t, const uint8_t *, size_t, const uint8_t *, size_t, int32_t) = kloda_ios_transfer;
void (*const kloda_check_free)(char *) = kloda_ios_reply_free;
