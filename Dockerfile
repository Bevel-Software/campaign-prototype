# Stage 1: Build the frontend
FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:22-alpine

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install tsx
COPY --from=build /app/dist ./dist
COPY server ./server
COPY public ./public

EXPOSE 3001
ENV PORT=3001

CMD ["npx", "tsx", "server/index.ts"]
