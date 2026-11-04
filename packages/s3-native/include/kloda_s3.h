#ifndef KLODA_S3_H
#define KLODA_S3_H
#include <stddef.h>
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif
/* Native-only, no I/O. kind0=prepare,1=create ACK,2=complete ACK.
 * Input<=1MiB, output<=4MiB. Caller owns nonoverlapping buffers and erases
 * credentials/signed URLs after use. No handles, retained pointers or free ABI.
 * Returns0=success,1=invalid,2=output too small (written=required bytes).
 * Null output with capacity0 permits sizing; a second call signs afresh.
 * ACK output is never Completed or permission to resume/adopt another job. */
int32_t kloda_s3_json_v1(uint32_t kind,const uint8_t *input,size_t input_length,
    uint8_t *output,size_t output_capacity,size_t *written);
#ifdef __cplusplus
}
#endif
#endif
