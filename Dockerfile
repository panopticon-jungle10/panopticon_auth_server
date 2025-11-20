# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN apk add --no-cache python3 make g++ || true
RUN npm ci --production --ignore-scripts
COPY --from=builder /app/dist ./dist
EXPOSE 8080
CMD [ "node", "dist/main.js" ]
