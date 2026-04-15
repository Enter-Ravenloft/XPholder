FROM node:20-alpine AS bot
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "main.js"]

FROM node:20-alpine AS dashboard
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN cd dashboard && npx tailwindcss -i ./public/css/input.css -o ./public/css/style.css --minify
CMD ["node", "dashboard/server.js"]
