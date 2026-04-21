# Despliegue en Dokploy

Este proyecto esta preparado para desplegar tres servicios con una base de datos externa gestionada:

- `kovia-api`
- `kovia-form`
- `kovia-admin`

La base de datos no vive en `docker-compose.yml` para produccion.

## 1. Variables de entorno en Dokploy

Configura estas variables en el panel de Dokploy (Project/Service Environment):

- `NODE_ENV=production`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_DIALECT=postgres`
- `JWT_SECRET`
- `AUTH_COOKIE_NAME=kovia_admin_token`
- `AUTH_TOKEN_TTL_HOURS=12`
- `CORS_ORIGIN=https://form.tu-dominio.com,https://admin.tu-dominio.com`
- `PUBLIC_API_URL=https://api.tu-dominio.com`
- `VITE_ADMIN_API_URL=https://api.tu-dominio.com`
- `VITE_FORM_URL_BASE=https://form.tu-dominio.com`

Usa valores reales en produccion y no subas secretos al repositorio.

## 2. Dominio recomendado

Configura subdominios separados en Dokploy:

- `api.tu-dominio.com` -> `kovia-api` (puerto interno 3001)
- `form.tu-dominio.com` -> `kovia-form` (puerto interno 4321)
- `admin.tu-dominio.com` -> `kovia-admin` (puerto interno 80)

## 2.1 Traefik y nginx.conf en Admin

Si usas Traefik en Dokploy, `kovia-admin/nginx.conf` sigue siendo recomendable.

- Traefik se encarga del enrutamiento, TLS y entrypoints.
- Nginx dentro de `kovia-admin` sirve los archivos estaticos de React.
- El fallback SPA (`try_files ... /index.html`) evita 404 al recargar rutas internas del admin.
- El endpoint `/health` se usa para healthcheck del contenedor.

Solo puedes eliminar `nginx.conf` si cambias el runtime de `kovia-admin` por otro servidor que cubra estos mismos puntos.

## 3. Build-time vs runtime

Estas variables se embeben durante el build de frontend:

- `PUBLIC_API_URL`
- `VITE_ADMIN_API_URL`
- `VITE_FORM_URL_BASE`

Si cambias alguna de esas URLs, debes reconstruir imagenes de frontend.

## 4. Salud y arranque

Health endpoints esperados:

- API: `GET /health`
- Form: `GET /`
- Admin: `GET /health`

`kovia-form` y `kovia-admin` esperan a que `kovia-api` este healthy antes de arrancar.

## 5. Verificacion minima post-deploy

1. Abrir `https://api.tu-dominio.com/health`.
2. Abrir `https://form.tu-dominio.com/`.
3. Abrir `https://admin.tu-dominio.com/health`.
4. Probar login en admin.
5. Probar submit de formulario publico y revisar persistencia en API/DB.
