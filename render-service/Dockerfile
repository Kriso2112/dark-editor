FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg espeak-ng fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]
ENV DARK_VIDEO_JOBS_DIR=/data/render-jobs
COPY package.json ./
COPY server.mjs ./
COPY test ./test
ENV NODE_ENV=production PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server.mjs"]
