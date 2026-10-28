/* Host-only ownership/lifecycle fixture. Never linked into the application. No key, file or network I/O. */
#include "IosPairingSessionFixture.h"
#include <stdatomic.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <stdio.h>
static pthread_mutex_t gate = PTHREAD_MUTEX_INITIALIZER;
static pthread_cond_t ready = PTHREAD_COND_INITIALIZER;
static int blocked, blocked_request, close_failure;
static atomic_int entered_requests, active_state;
static atomic_uint_fast64_t native_epoch;
static atomic_int opens, closes, activations, requests;
static char *reply(const char *text) { return strdup(text); }
void kloda_test_reset(int block_open, int fail_close) {
  blocked = block_open; blocked_request = 0; close_failure = fail_close;
  atomic_store(&entered_requests, 0); atomic_store(&active_state, 0); atomic_store(&native_epoch, 0);
  atomic_store(&opens, 0); atomic_store(&closes, 0);
  atomic_store(&activations, 0); atomic_store(&requests, 0);
}
void kloda_test_release_open(void) { pthread_mutex_lock(&gate); blocked = 0; pthread_cond_broadcast(&ready); pthread_mutex_unlock(&gate); }
void kloda_test_block_request(void) { pthread_mutex_lock(&gate); blocked_request = 1; pthread_mutex_unlock(&gate); }
void kloda_test_release_request(void) { pthread_mutex_lock(&gate); blocked_request = 0; pthread_cond_broadcast(&ready); pthread_mutex_unlock(&gate); }
int kloda_test_entered_requests(void) { return atomic_load(&entered_requests); }
int kloda_test_opens(void) { return atomic_load(&opens); }
int kloda_test_closes(void) { return atomic_load(&closes); }
int kloda_test_activations(void) { return atomic_load(&activations); }
int kloda_test_requests(void) { return atomic_load(&requests); }
char *kloda_ios_open(const uint8_t *path, size_t length) {
  (void)path; (void)length; atomic_fetch_add(&opens, 1);
  pthread_mutex_lock(&gate); while (blocked) pthread_cond_wait(&ready, &gate); pthread_mutex_unlock(&gate);
  return reply("{\"ok\":true,\"value\":{\"owner\":\"1\"}}");
}
char *kloda_ios_request(uint64_t owner, const uint8_t *data, size_t length, uint64_t expected_epoch) {
  (void)owner; char *text = calloc(length + 1, 1); memcpy(text, data, length);
  int close = strstr(text, "\"kind\":\"close\"") != NULL;
  int foreground = strstr(text, "\"kind\":\"scan\"") || strstr(text, "\"kind\":\"approve\"") ||
    strstr(text, "\"kind\":\"resume\"") || strstr(text, "\"kind\":\"removePairing\"");
  free(text);
  if (close) {
    atomic_fetch_add(&closes, 1);
    return reply(close_failure ? "{\"ok\":false,\"errorCode\":\"outcome_unknown\"}" : "{\"ok\":true,\"value\":null}");
  }
  if (foreground) {
    atomic_fetch_add(&entered_requests, 1);
    pthread_mutex_lock(&gate); while (blocked_request) pthread_cond_wait(&ready, &gate); pthread_mutex_unlock(&gate);
    if (!atomic_load(&active_state) || expected_epoch != atomic_load(&native_epoch))
      return reply("{\"ok\":false,\"errorCode\":\"candidate_stale\"}");
  }
  atomic_fetch_add(&requests, 1);
  return reply("{\"ok\":true,\"value\":{\"phase\":\"idle\",\"repairRequired\":false,\"hardwareClass\":\"secure_enclave\"}}");
}
char *kloda_ios_suspend(uint64_t owner) { return kloda_ios_set_foreground(owner, 0); }
char *kloda_ios_set_foreground(uint64_t owner, uint8_t active) {
  (void)owner;
  if (!active || active != atomic_load(&active_state)) atomic_fetch_add(&native_epoch, 1);
  atomic_store(&active_state, active);
  if (active) {
    atomic_fetch_add(&activations, 1);
    char result[128];
    snprintf(result, sizeof(result), "{\"ok\":true,\"value\":{\"epoch\":\"%llu\"}}", (unsigned long long)atomic_load(&native_epoch));
    return reply(result);
  }
  return reply("{\"ok\":true,\"value\":null}");
}
void kloda_ios_reply_free(char *text) { if (text) { memset(text, 0, strlen(text)); free(text); } }

char *kloda_ios_transfer(uint64_t owner, const uint8_t *record, size_t record_length,
  const uint8_t *json, size_t json_length, int32_t descriptor, uint64_t expected_epoch) {
  (void)owner; (void)record; (void)record_length; (void)json; (void)json_length;
  (void)descriptor; (void)expected_epoch;
  return strdup("{\"ok\":false,\"errorCode\":\"native_unsupported\"}");
}
