# Sử dụng Node 18
FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Cài vite cục bộ (để đảm bảo có trong node_modules)
RUN npm install vite --save-dev

EXPOSE 8080

# Sử dụng 0.0.0.0 để mở cổng thật ra ngoài
CMD ["npx", "vite", "serve", "--host", "0.0.0.0", "--port", "8080"]
