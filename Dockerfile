FROM node:10.15.3-alpine

RUN adduser popcorn -s /bin/sh -D /home/popcorn \
    && apk add --no-cache su-exec

COPY bin /opt/popcorn/bin
COPY js /opt/popcorn/js

RUN su-exec popcorn /opt/popcorn/bin/initialize

EXPOSE 8000
EXPOSE 8001

CMD [ "su-exec", "popcorn", "/opt/popcorn/bin/launch" ]
