FROM node:16-alpine

RUN mkdir -p /usr/src
WORKDIR /usr/src/
RUN apk update
RUN apk add --no-cache python3 py3-pip linux-headers gcc make g++

COPY ./src/ /usr/src/

RUN npm install