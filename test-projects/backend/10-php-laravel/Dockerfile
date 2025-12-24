FROM php:8.2-fpm-alpine

RUN apk add --no-cache zip unzip git

COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock* ./
RUN composer install --no-dev --no-scripts || true

COPY . .

RUN php artisan config:cache || true

EXPOSE 8000

CMD ["php", "artisan", "serve", "--host=0.0.0.0"]
