FROM node:20-alpine AS bot
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "main.js"]

FROM node:20-alpine AS dashboard
WORKDIR /app
COPY dashboard/package*.json ./
RUN npm install
COPY dashboard/ .
RUN npx tailwindcss -i ./public/css/input.css -o ./public/css/style.css --minify
CMD ["node", "server.js"]
