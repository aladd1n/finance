# Use official Node.js runtime
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy entire project
COPY . .

# Expose port
EXPOSE 3000

# Set production environment
ENV NODE_ENV=production

# Start server
CMD ["node", "server/index.js"]
