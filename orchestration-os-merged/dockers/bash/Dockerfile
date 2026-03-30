FROM bash:latest

WORKDIR /app

# Install common tools
RUN apt-get update && apt-get install -y \
    curl wget git jq file coreutils \
    && rm -rf /var/lib/apt/lists/*

COPY . .

CMD ["bash"]
