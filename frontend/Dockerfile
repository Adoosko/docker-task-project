# Build Stage
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Production Stage (Lightweight NGINX container to serve static files)
FROM nginx:stable-alpine

COPY --from=builder /usr/src/app/dist /usr/share/nginx/html

# If the user uses client-side routing, NGINX needs to redirect all fallback routes to index.html
# We can include a basic nginx config if needed, but for this simple app, default configuration works.
# Let's copy a custom minimal NGINX configuration to avoid issues with SPAs
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
