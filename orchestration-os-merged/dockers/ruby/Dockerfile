FROM ruby:3.3-alpine

# Install system tools
RUN apk add --no-cache \
    git curl wget bash vim nano jq \
    build-base

# Install Bundler and Rails ecosystem
RUN gem install bundler rake rspec && \
    gem install rails --no-document

# Install AI/CLI gems
RUN gem install ruby-openai anthropic gemini-pro google-generativeai && \
    gem install httparty faraday

# Install dev tools
RUN gem install pry byebug rubocop rufus-scheduler

WORKDIR /app

# Copy agent script
COPY agent.rb /app/agent.rb

EXPOSE 8888

CMD ["ruby", "/app/agent.rb"]
