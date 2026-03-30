FROM ruby:3.3-alpine
WORKDIR /app
RUN apk add --no-cache git curl wget jq bash vim nano build-base
RUN gem install openai anthropic google-cloud-storage
EXPOSE 8888
CMD ["ruby", "-e", "puts 'Zo Orchestration OS - Ruby runtime ready'"]
