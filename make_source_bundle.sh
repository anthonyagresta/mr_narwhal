#!/bin/sh

rm -f source_bundle.zip
zip -r source_bundle.zip Dockerfile Dockerrun.aws.json .env bin bot.js components package.json public skills yarn.lock node_modules

