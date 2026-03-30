FROM bash:latest
WORKDIR /app
RUN apt-get update && apt-get install -y curl wget git jq file coreutils vim nano && rm -rf /var/lib/apt/lists/*
EXPOSE 8888
CMD ["bash", "-c", "echo 'Zo Orchestration OS - Bash runtime ready'"]
