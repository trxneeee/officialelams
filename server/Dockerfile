# Use Node base image
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy package files first (for caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy all server files
COPY . .

# Expose port
EXPOSE 5000

# Run server
CMD ["node", "server.js"]