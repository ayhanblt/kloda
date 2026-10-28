#include "ownership-stub.h"
#include <stdlib.h>
#include <string.h>
static int frees;
char *kloda_test_reply(int mode) {
  if (mode == 2) { char *p=malloc(262166); memset(p,'x',262165); p[262165]=0; return p; }
  if (mode == 3) { char *p=malloc(2); p[0]=(char)255; p[1]=0; return p; }
  return strdup(mode == 0 ? "{\"ok\":true,\"value\":null}" : "{");
}
void kloda_ios_reply_free(char *p) { frees++; free(p); }
int kloda_test_free_count(void) { return frees; }
