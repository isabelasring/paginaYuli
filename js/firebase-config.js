/**
 * Configuración Firebase (guardar productos e imágenes en la nube).
 *
 * Cómo completarla (una sola vez):
 * 1. Entra a https://console.firebase.google.com con el Gmail tuyo o de Yuly
 * 2. Crear proyecto → "Skin Beauty" (o el nombre que quieras)
 * 3. Añadir app Web (ícono </>) → copiar el objeto firebaseConfig
 * 4. Activar Authentication → Email/contraseña
 * 5. Crear un usuario (ej. yuly@skinbeauty.com + contraseña segura) — es el login del admin
 * 6. Crear Firestore (modo producción) y pegar reglas de firestore.rules
 * 7. Activar Storage y pegar reglas de storage.rules
 * 8. Pega aquí abajo los valores del objeto config
 */
window.FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

window.isFirebaseConfigured = function isFirebaseConfigured() {
  const c = window.FIREBASE_CONFIG || {};
  return Boolean(c.apiKey && c.projectId && c.appId);
};
