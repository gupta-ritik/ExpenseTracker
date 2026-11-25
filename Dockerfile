FROM node:22-alpine
WORKDIR /nextapp
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]
