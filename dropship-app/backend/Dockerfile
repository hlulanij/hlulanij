FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY public ./public
ENV NODE_ENV=production PORT=3000 DB_PATH=/tmp/data.sqlite
# Railway/Fly: mount a volume at /data and set DB_PATH=/data/data.sqlite for persistence
EXPOSE 3000
CMD ["node", "--no-warnings", "src/server.js"]
