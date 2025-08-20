# Use Node.js 18 LTS
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy root package.json and package-lock.json (for workspace config)
COPY package*.json ./

# Copy bot package.json
COPY apps/bot/package*.json ./apps/bot/

# Install dependencies using workspace
RUN npm ci

# Copy all source code
COPY . .

# Build the bot
WORKDIR /app/apps/bot
RUN npm run build

# Generate Prisma client
RUN npm run prisma:generate

# Expose port for health checks
EXPOSE 3001

# Start the bot
CMD ["npm", "start"]
