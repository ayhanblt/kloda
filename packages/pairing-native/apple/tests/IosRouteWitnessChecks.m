// Simulator-only native metadata/fence smoke; no connection, identity or user file I/O.
#import "../IosRouteWitness.m"
#include <TargetConditionals.h>
#include <ifaddrs.h>
#include <net/if.h>
#include <stdio.h>
#include <assert.h>
int main(void) {
#if !TARGET_OS_SIMULATOR
#error This fixture must only run in a disposable simulator.
#endif
 @autoreleasepool {
  assert(kloda_ios_route_valid(NULL) == 0);
  assert(kloda_ios_route_interface_class(NULL, "x", 1) == 0);
  assert(kloda_ios_route_select(NULL, "x", 1) == 0);
  kloda_ios_route_close(NULL);
  void *raw = kloda_ios_route_open();
  if (!raw) { puts("INCONCLUSIVE initial native metadata unavailable"); return 2; }
  assert(kloda_ios_route_valid(raw) == 0);
  assert(kloda_ios_route_interface_class(raw, NULL, 1) == 0);
  assert(kloda_ios_route_select(raw, "missing", 0) == 0);
  struct ifaddrs *addresses = NULL; assert(getifaddrs(&addresses) == 0);
  char selected[16] = {0}; unsigned index = 0;
  for (struct ifaddrs *a = addresses; a; a = a->ifa_next) {
   if (!a->ifa_name || strlen(a->ifa_name) >= sizeof(selected)) continue;
   unsigned candidate = if_nametoindex(a->ifa_name);
   if (kloda_ios_route_interface_class(raw, a->ifa_name, candidate)) {
    strcpy(selected, a->ifa_name); index = candidate; break;
   }
  }
  freeifaddrs(addresses);
  if (!index) { kloda_ios_route_close(raw); puts("INCONCLUSIVE no classified simulator interface; null/selection refusals verified"); return 2; }
  assert(kloda_ios_route_select(raw, selected, index) == 1);
  assert(kloda_ios_route_valid(raw) == 1);
  assert(kloda_ios_route_select(raw, selected, index) == 0);
  KlodaRouteWitness *w = (__bridge KlodaRouteWitness *)raw;
  KlodaRouteObservation *other = w.selected == w.wifi ? w.wired : w.wifi;
  @synchronized(other) { other.invalid = YES; }
  assert(kloda_ios_route_valid(raw) == 1);
  @synchronized(w.selected) { w.selected.invalid = YES; [w.selected observe:w.selected.path]; }
  assert(kloda_ios_route_valid(raw) == 0);
  assert(kloda_ios_route_select(raw, selected, index) == 0);
  kloda_ios_route_close(raw);
  puts("PASS native typed-interface metadata and one-time selection");
  puts("PASS unselected change isolation and selected sticky refusal");
  puts("NOT_ACCEPTANCE no socket connection, direct-route, VPN, instant-change or physical LAN proof");
 }
 return 0;
}
