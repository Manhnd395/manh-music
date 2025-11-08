# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Chạy Vite dev server (hot reload)
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "8080"]