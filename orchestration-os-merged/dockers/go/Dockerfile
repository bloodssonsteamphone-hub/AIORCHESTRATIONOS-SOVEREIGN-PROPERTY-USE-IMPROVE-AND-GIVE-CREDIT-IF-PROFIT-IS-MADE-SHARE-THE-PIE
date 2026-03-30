FROM golang:1.23-alpine

ENV DEBIAN_FRONTEND=noninteractive
RUN apk add --no-cache bash git curl wget jq vim nano file coreutils

WORKDIR /app

RUN useradd -m -s /bin/bash zo

USER zo

CMD ["go", "version"]
