# Static UI + nginx reverse-proxy to GROM backend (same origin → no CORS).
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY public /usr/share/nginx/html
EXPOSE 80
