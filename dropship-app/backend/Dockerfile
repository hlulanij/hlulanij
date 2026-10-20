FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/data.sqlite
VOLUME /data
EXPOSE 3000
CMD ["node", "--no-warnings", "src/server.js"]
