FROM node:6.11.3-alpine

CMD mkdir -p /srv/narwhal/bin /srv/narwhal/components /srv/narwhal/public /srv/narwhal/skills
WORKDIR /srv/narwhal

COPY bin bin/
COPY package.json yarn.lock ./
COPY node_modules node_modules/
RUN ["/usr/local/bin/node", "./bin/yarn.js", "install", "--local", "--frozen-lockfile"]

COPY components components/
COPY public public/
COPY skills skills/
COPY bot.js ./
COPY .env ./

EXPOSE 80

CMD node /srv/narwhal/bot.js

