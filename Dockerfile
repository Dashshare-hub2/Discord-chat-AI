FROM node:20-slim
WORKDIR /app
COPY package.json ./
RUN npm install --production
COPY index.js ./
EXPOSE 10000
CMD ["npm", "start"]
