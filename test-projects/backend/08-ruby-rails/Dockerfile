FROM ruby:3.2-alpine

RUN apk add --no-cache build-base sqlite-dev nodejs yarn

WORKDIR /app

COPY Gemfile Gemfile.lock* ./
RUN bundle install

COPY . .

RUN rails db:migrate || true

EXPOSE 3000

CMD ["rails", "server", "-b", "0.0.0.0"]
