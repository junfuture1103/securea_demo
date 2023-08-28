FROM base:0.1

WORKDIR /usr/src/

COPY init.sh /usr/src/init.sh

RUN apk add openvpn
# RUN chmod 666 /dev/net/tun
RUN chmod +x ./init.sh

CMD ["sh", "./init.sh"]