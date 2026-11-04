#include <curl/curl.h>
#include <stdio.h>
#include <string.h>

#define SET(option, value) do { \
  CURLcode code = curl_easy_setopt(curl, option, value); \
  if(code != CURLE_OK) { curl_easy_cleanup(curl); return (int)code; } \
} while(0)

int main(int argc, char **argv) {
  if(argc != 3) return 2;
  if(curl_global_init(CURL_GLOBAL_DEFAULT) != CURLE_OK) return 2;
  CURL *curl = curl_easy_init();
  if(!curl) { curl_global_cleanup(); return 2; }
  SET(CURLOPT_URL, argv[2]);
  SET(CURLOPT_NOPROXY, "*");
  SET(CURLOPT_USERNAME, "probe");
  SET(CURLOPT_PASSWORD, "unused");
  SET(CURLOPT_TIMEOUT, 5L);
  if(!strcmp(argv[1], "tls")) {
    SET(CURLOPT_USE_SSL, (long)CURLUSESSL_ALL);
    SET(CURLOPT_FTPSSLAUTH, (long)CURLFTPAUTH_TLS);
    SET(CURLOPT_SSL_VERIFYPEER, 1L);
    SET(CURLOPT_SSL_VERIFYHOST, 2L);
  } else {
    SET(CURLOPT_UPLOAD, 1L);
    SET(CURLOPT_INFILESIZE_LARGE, (curl_off_t)0);
    SET(CURLOPT_CUSTOMREQUEST, "STOU");
  }
  CURLcode result = curl_easy_perform(curl);
  fprintf(stderr, "%s\n", curl_easy_strerror(result));
  curl_easy_cleanup(curl);
  curl_global_cleanup();
  return (int)result;
}
