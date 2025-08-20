# Use Node.js 24 LTS to satisfy dependency requirements
FROM node:24-alpine

# Set working directory
WORKDIR /app

# Copy root package.json and package-lock.json (for workspace config)
COPY package*.json ./

# Copy bot package.json
COPY apps/bot/package*.json ./apps/bot/

# Install dependencies. Using 'npm install' to resolve lockfile mismatches.
# For best practice, run 'npm install' locally and commit the updated package-lock.json
RUN npm install

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
