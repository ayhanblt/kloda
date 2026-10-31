FROM ubuntu@sha256:fe81560990fae86dc4743202b2cb4d3df98d0bcf949173cecef15ce1127ef852
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends samba && useradd -u 27816 -M owned && mkdir -p /srv/owned /run/samba && chown owned:owned /srv/owned && printf 'owned-disposable-fixture\nowned-disposable-fixture\n' | smbpasswd -s -a owned
COPY *.conf /etc/samba/
CMD ["smbd", "--foreground", "--no-process-group", "--configfile=/etc/samba/strict.conf", "--debug-stdout"]
