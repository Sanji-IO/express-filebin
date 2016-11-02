FROM node:4.5.0-wheezy

MAINTAINER Zack YL Shih <zackyl.shih@moxa.com>

ENV NODE_ENV production
ENV HOST 0.0.0.0
ENV PORT 8888

ADD . /app

WORKDIR /app

RUN npm install --production

EXPOSE 8888

CMD node server.js
