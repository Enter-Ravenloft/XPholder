FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .
RUN npx tailwindcss -i ./public/css/input.css -o ./public/css/style.css --minify

CMD ["node", "server.js"]
