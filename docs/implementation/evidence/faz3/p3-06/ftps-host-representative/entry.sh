#!/bin/sh
set -e
mkdir -p /srv/ftp/upload /var/run/vsftpd/empty
id kloda_probe >/dev/null 2>&1 || useradd -d /srv/ftp -s /bin/sh kloda_probe
printf 'kloda_probe:%s\n' "$(cat /run/kloda/pw)" | chpasswd
chown kloda_probe /srv/ftp/upload
exec vsftpd /run/kloda/vsftpd.conf
