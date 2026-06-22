# Stage 1: Build the Astro app
FROM node:24-alpine AS build

WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm install

# copy source code
COPY . .

# build Astro - creates /dist (static output)
RUN npm run build

# Stage 2: Serve static files with Nginx
FROM nginx:alpine

# Copy built static files to nginx html directory
COPY --from=build /app/dist /usr/share/nginx/html

# Use default nginx config (will be overridden by docker-compose volume mount)
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]