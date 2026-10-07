// Equivalent of .env (dev):
//   VITE_API_URL=/api          -> apiUrl below
//   VITE_BASE=/                -> angular.json build.options.baseHref
//   DEV_API_TARGET=...         -> proxy.conf.json (dev-server only, not read by app code)
export const environment = {
  production: false,
  apiUrl: 'http://localhost:5000/api',
};
