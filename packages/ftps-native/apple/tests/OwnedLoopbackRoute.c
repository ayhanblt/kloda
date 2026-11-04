/* Owned disposable fixture only: no OS LAN admission claim, never linked into product. */
#include <arpa/inet.h>
#include <stdint.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <unistd.h>
typedef struct { uint64_t magic; int active; } lease;
typedef int32_t (*worker)(void *,int32_t,const void *);
static int open_port(uint16_t port) {
 if (!port) return -1;
 int fd=socket(AF_INET,SOCK_STREAM,0); if(fd<0) return -1;
 struct timeval timeout={5,0};
 if(setsockopt(fd,SOL_SOCKET,SO_RCVTIMEO,&timeout,sizeof(timeout))||setsockopt(fd,SOL_SOCKET,SO_SNDTIMEO,&timeout,sizeof(timeout))){close(fd);return -1;}
 struct sockaddr_in address={0}; address.sin_len=sizeof(address);address.sin_family=AF_INET;address.sin_port=htons(port);address.sin_addr.s_addr=htonl(INADDR_LOOPBACK);
 if(connect(fd,(struct sockaddr*)&address,sizeof(address))){close(fd);return -1;}
 return fd;
}
int32_t kloda_owned_ftps_lan_current(const void *raw){if(!raw)return 1;const lease *l=raw;return l->magic==0x4b4c4f4441465450ULL&&l->active?0:1;}
int32_t kloda_owned_ftps_lan_connect(const void *raw,uint16_t port){return kloda_owned_ftps_lan_current(raw)?-1:open_port(port);}
int32_t kloda_owned_ftps_lan_with_socket(const uint8_t *ip,size_t length,uint16_t port,worker action,void *context){
 if(!ip||length!=9||memcmp(ip,"127.0.0.1",9)||!action)return 1;
 int fd=open_port(port);if(fd<0)return 1;
 lease l={0x4b4c4f4441465450ULL,1};int result=action(context,fd,&l);l.active=0;close(fd);return result;
}
int32_t kloda_owned_ftps_route_fixture_marker(void){return 16;}
