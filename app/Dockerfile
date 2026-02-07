FROM node:20-alpine

WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm install

# copy source code
COPY . .

# build Astro - creates /dist
RUN npm run build

# Expose the port defined in astro.config.mjs (TODO hardcoded?)
EXPOSE 3000

# start
CMD ["node", "./dist/server/entry.mjs"]