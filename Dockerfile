FROM node:20-alpine

WORKDIR /nextapp

COPY package*.json ./

RUN npm install --legacy-peer-deps

# Copy the rest of the project files into the container
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "run", "dev"]
