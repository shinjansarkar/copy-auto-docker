# Multi-stage build for Ruby on Rails backend
FROM ruby:3.2-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    build-base \
    postgresql-dev \
    nodejs \
    yarn

# Copy Gemfile
COPY Gemfile Gemfile.lock ./

# Install gems
RUN bundle config set --local deployment 'true' && \
    bundle config set --local without 'development test' && \
    bundle install

# Production stage
FROM ruby:3.2-alpine

WORKDIR /app

# Install runtime dependencies
RUN apk add --no-cache \
    postgresql-client \
    nodejs \
    tzdata

# Copy installed gems from builder
COPY --from=builder /usr/local/bundle /usr/local/bundle

# Copy application code
COPY . .

# Precompile assets (Rails)
RUN if [ -f "bin/rails" ]; then \
        RAILS_ENV=production bundle exec rails assets:precompile || true; \
    fi

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/ || exit 1

# Start Rails with Puma
CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0"]
