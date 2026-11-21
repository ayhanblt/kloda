#!/bin/sh
set -e
mkdir -p /srv/ftp/upload /var/log/proftpd /var/run/proftpd
id kloda_probe >/dev/null 2>&1 || useradd -d /srv/ftp/upload -s /bin/sh kloda_probe
printf 'kloda_probe:%s\n' "$(cat /run/kloda/pw)" | chpasswd
chown kloda_probe /srv/ftp/upload
exec proftpd -n -c /run/kloda/proftpd.conf
