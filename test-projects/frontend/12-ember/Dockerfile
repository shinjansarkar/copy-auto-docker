FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html 2>/dev/null || true
COPY --from=builder /app/build /usr/share/nginx/html 2>/dev/null || true
COPY --from=builder /app/out /usr/share/nginx/html 2>/dev/null || true
COPY --from=builder /app/.next /usr/share/nginx/html/.next 2>/dev/null || true

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
