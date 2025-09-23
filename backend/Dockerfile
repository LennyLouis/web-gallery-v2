# Use the official Node.js runtime as the base image
FROM node:24-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json with correct ownership
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code with correct ownership
COPY . .

# Start the application
CMD ["npm", "start"]
