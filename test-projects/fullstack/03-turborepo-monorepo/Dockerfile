FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci || yarn install || pnpm install || true

COPY . .
RUN npm run build || yarn build || pnpm build || true

FROM node:18-alpine

WORKDIR /app

COPY --from=builder /app ./

EXPOSE 3000

CMD ["npm", "start"]
