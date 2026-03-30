FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
    bash git curl wget jq vim nano file coreutils procps && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN useradd -m -s /bin/bash zo && \
    mkdir -p /home/zo && chown zo:zo /home/zo

USER zo

CMD ["bash", "--version"]