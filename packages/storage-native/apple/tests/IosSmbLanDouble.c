/* Test-only ABI double: no real LAN, SMB authentication or remote writes. */
#include <stdint.h>
#include <stddef.h>
#include <unistd.h>
#include <sys/socket.h>
#include <fcntl.h>
#include <assert.h>
static int mode, checks, auth, valid, original = -1, consumed = -1, lease;
void fixture_reset(int value) { mode=value; checks=auth=0; valid=1; original=consumed=-1; }
int fixture_auth(void) { return auth; }
int fixture_closed(void) {
  return (original < 0 || fcntl(original,F_GETFD) == -1) &&
    (consumed < 0 || fcntl(consumed,F_GETFD) == -1);
}
int32_t kloda_ios_lan_current(const void *raw) {
  assert(raw == &lease);
  checks++;
  return !valid || (mode == 2 && checks >= 2);
}
int32_t kloda_ios_lan_with_socket(const uint8_t *address, size_t length, uint16_t port,
  int32_t (*worker)(void *, int32_t, const void *), void *context) {
  assert(address && length && port == 445 && worker);
  if (mode == 1) return 1;
  int pair[2]; assert(socketpair(AF_UNIX,SOCK_STREAM,0,pair)==0);
  original=pair[0];
  int32_t result=worker(context,pair[0],&lease);
  close(pair[0]); close(pair[1]);
  return result;
}
int32_t kloda_smb_publish_bound(const uint8_t *json, size_t length, int32_t snapshot,
  int32_t socket, int32_t (*callback)(void *, int32_t, uint64_t), void *context) {
  assert(json && length && callback);
  consumed=socket;
  int32_t result=callback(context,0,0);
  if (!result) {
    auth++;
    for (int event=1; event<=5 && !result; event++) result=callback(context,event,0);
    if (mode == 3) valid=0;
  }
  close(snapshot); close(socket);
  return result;
}
int32_t kloda_smb_publish(const uint8_t *json, size_t length, int32_t snapshot,
  int32_t (*callback)(void *, int32_t, uint64_t), void *context) {
  (void)json; (void)length; (void)snapshot; (void)callback; (void)context;
  assert(0 && "bound publication must never fall back"); return 1;
}
