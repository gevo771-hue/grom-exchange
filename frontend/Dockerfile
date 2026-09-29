# Static UI + nginx reverse-proxy to GROM backend (same origin → no CORS).
# HTML/JS is NEVER baked from public/ — always docker-cp frontend/dist after build.
# (Baking public/ caused old admin / unhashed drift whenever compose rebuilt.)
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN mkdir -p /usr/share/nginx/html \
 && printf '%s\n' '<!doctype html><title>GROM</title><p>Deploy dist via docker cp</p>' \
    > /usr/share/nginx/html/index.html
EXPOSE 80
