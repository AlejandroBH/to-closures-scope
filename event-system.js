// Sistema de Event Bus usando closures y module pattern
const EventBus = (function () {
  // Almacenamiento privado de listeners
  const listeners = new Map();

  // Función privada para validar tipos
  function validarTipo(evento, callback) {
    if (typeof evento !== "string" || evento.trim().length === 0) {
      throw new Error("El nombre del evento debe ser un string no vacío");
    }
    if (typeof callback !== "function") {
      throw new Error("El callback debe ser una función");
    }
  }

  // API pública
  return {
    // Suscribir listener a un evento
    on: function (evento, callback) {
      validarTipo(evento, callback);

      if (!listeners.has(evento)) {
        listeners.set(evento, new Set());
      }

      listeners.get(evento).add(callback);

      // Retornar función para remover listener (closure)
      return function () {
        listeners.get(evento).delete(callback);
      };
    },

    // Remover listener específico
    off: function (evento, callback) {
      if (listeners.has(evento)) {
        listeners.get(evento).delete(callback);
      }
    },

    // Emitir evento con datos
    emit: function (evento, ...datos) {
      if (typeof evento !== "string") {
        throw new Error("El nombre del evento debe ser un string");
      }

      if (listeners.has(evento)) {
        const callbacks = listeners.get(evento);
        callbacks.forEach((callback) => {
          try {
            callback(...datos);
          } catch (error) {
            console.error(`Error en callback para evento '${evento}':`, error);
          }
        });
      }
    },

    // Emitir evento una sola vez
    once: function (evento, callback) {
      validarTipo(evento, callback);

      const remover = this.on(evento, function (...datos) {
        callback(...datos);
        remover(); // Se remueve automáticamente después de la primera ejecución
      });
    },

    // Obtener información de debugging
    debug: function () {
      const info = {};
      for (const [evento, callbacks] of listeners) {
        info[evento] = callbacks.size;
      }
      return info;
    },

    // Limpiar todos los listeners
    clear: function () {
      listeners.clear();
    },
  };
})();

// Sistema de autenticación usando el EventBus
const AuthManager = (function (eventBus) {
  let usuarioActual = null;
  let token = null;

  return {
    login: function (username, password) {
      // Simulación de login asíncrono
      setTimeout(() => {
        if (username === "admin" && password === "123") {
          usuarioActual = { id: 1, username, role: "admin" };
          token = "token_simulado_" + Date.now();
          eventBus.emit("auth:login", usuarioActual);
        } else {
          eventBus.emit("auth:error", "Credenciales inválidas");
        }
      }, 1000);
    },

    logout: function () {
      usuarioActual = null;
      token = null;
      eventBus.emit("auth:logout");
    },

    getUsuarioActual: function () {
      return usuarioActual ? { ...usuarioActual } : null;
    },

    isAuthenticated: function () {
      return !!usuarioActual;
    },
  };
})(EventBus);

// Sistema de Cache con TTL y estadisticas Hit/Miss
const CacheManager = (function (eventBus) {
  const cache = new Map();

  const stats = {
    hits: 0,
    misses: 0,
  };

  // Elimina una entrada de la caché y limpia su timeout
  function limpiarEntrada(clave) {
    if (cache.has(clave)) {
      const entrada = cache.get(clave);

      if (entrada.timeoutId) {
        clearTimeout(entrada.timeoutId);
      }
      cache.delete(clave);
    }
  }

  return {
    // Almacena un valor en caché con un tiempo de vida (TTL)
    set: function (clave, valor, ttl) {
      if (typeof clave !== "string" || clave.trim().length === 0) {
        throw new Error("La clave debe ser un string no vacío");
      }
      if (typeof ttl !== "number" || ttl < 0) {
        ttl = 0;
      }

      limpiarEntrada(clave);

      let timeoutId = null;
      let expiracion = 0;

      if (ttl > 0) {
        expiracion = Date.now() + ttl;

        // Establecer el timeout de expiración automática
        timeoutId = setTimeout(() => {
          console.log(`[Cache] Clave '${clave}' expirada automáticamente.`);
          cache.delete(clave);
        }, ttl);
      }

      // Almacenar la nueva entrada
      cache.set(clave, {
        valor: valor,
        expiracion: expiracion,
        timeoutId: timeoutId,
      });

      console.log(
        `[Cache] Clave '${clave}' establecida (TTL: ${
          ttl > 0 ? ttl + "ms" : "N/A"
        }).`
      );
    },

    get: function (clave) {
      if (!cache.has(clave)) {
        stats.misses++;
        eventBus.emit("cache:miss", clave);
        return null;
      }

      const entrada = cache.get(clave);
      const ahora = Date.now();

      if (entrada.expiracion > 0 && entrada.expiracion < ahora) {
        console.log(`[Cache] Clave '${clave}' encontrada pero expirada.`);
        limpiarEntrada(clave);

        stats.misses++;
        eventBus.emit("cache:miss", clave);
        return null;
      }

      stats.hits++;
      eventBus.emit("cache:hit", clave, entrada.valor);
      return entrada.valor;
    },

    del: function (clave) {
      if (cache.has(clave)) {
        console.log(`[Cache] Clave '${clave}' eliminada manualmente.`);
        limpiarEntrada(clave);
        return true;
      }
      return false;
    },

    debug: function () {
      return {
        size: cache.size,
        stats: { ...stats },
        keys: Array.from(cache.keys()),
      };
    },

    clear: function () {
      Array.from(cache.keys()).forEach((key) => limpiarEntrada(key));
      cache.clear();
      stats.hits = 0;
      stats.misses = 0;
      console.log(
        "[Cache] Cache completamente limpiada y estadísticas reiniciadas."
      );
    },
  };
})(EventBus);

// Componente UI simulado
const UIController = (function (eventBus, authManager) {
  let loginAttempts = 0;

  // Configurar listeners de eventos
  const removerLoginListener = eventBus.on("auth:login", function (usuario) {
    console.log(`✅ Bienvenido, ${usuario.username}!`);
    mostrarDashboard();
  });

  const removerErrorListener = eventBus.on("auth:error", function (mensaje) {
    console.log(`❌ Error de autenticación: ${mensaje}`);
    loginAttempts++;
    if (loginAttempts >= 3) {
      console.log("🚫 Demasiados intentos fallidos. Intente más tarde.");
    }
  });

  const removerLogoutListener = eventBus.on("auth:logout", function () {
    console.log("👋 Sesión cerrada");
    mostrarLogin();
  });

  function mostrarLogin() {
    console.log("\n🔐 FORMULARIO DE LOGIN");
    console.log('Ejecutando: authManager.login("admin", "123")');
    authManager.login("admin", "123");
  }

  function mostrarDashboard() {
    console.log("\n📊 DASHBOARD");
    console.log("Usuario:", authManager.getUsuarioActual());
    console.log("Autenticado:", authManager.isAuthenticated());

    // Simular logout después de 3 segundos
    setTimeout(() => {
      console.log("Ejecutando logout automático...");
      authManager.logout();
    }, 3000);
  }

  return {
    iniciar: function () {
      console.log("🚀 Iniciando aplicación con EventBus y AuthManager");
      mostrarLogin();
    },

    // Cleanup (usando closures para remover listeners)
    destruir: function () {
      removerLoginListener();
      removerErrorListener();
      removerLogoutListener();
      eventBus.clear();
    },
  };
})(EventBus, AuthManager);

// Demostración del sistema completo
console.log("🎯 DEMOSTRACIÓN: SISTEMA DE EVENTOS CON CLOSURES\n");

// Mostrar estado inicial del EventBus
console.log("📋 Estado inicial del EventBus:", EventBus.debug());

// Iniciar aplicación
UIController.iniciar();

// Simular eventos adicionales
setTimeout(() => {
  console.log("\n🔍 Estado del EventBus después del login:", EventBus.debug());

  // Crear listener temporal que se auto-remueve
  EventBus.once("evento-temporal", function (dato) {
    console.log("📣 Evento temporal recibido:", dato);
  });

  EventBus.emit("evento-temporal", "Hola desde closure!");
}, 2000);

// Limpiar después de la demostración
setTimeout(() => {
  console.log("\n🧹 Limpiando sistema...");
  UIController.destruir();
  console.log("Estado final del EventBus:", EventBus.debug());
}, 6000);

console.log("\n🎯 DEMOSTRACIÓN: SISTEMA DE CACHE CON TTL Y EVENTBUS\n");

// 1. Configurar listeners de EventBus para el Cache
const removerHitListener = EventBus.on("cache:hit", function (clave, valor) {
  console.log(
    `[EventBus] 🟢 HIT en caché para clave: ${clave} (Valor: ${valor.substring(
      0,
      10
    )}...)`
  );
});

const removerMissListener = EventBus.on("cache:miss", function (clave) {
  console.log(`[EventBus] 🔴 MISS en caché para clave: ${clave}`);
});

console.log("📋 Estado inicial del Cache:", CacheManager.debug());
// Salida: Estado inicial del Cache: { size: 0, stats: { hits: 0, misses: 0 }, keys: [] }

// 2. Establecer datos
// TTL de 4 segundos
CacheManager.set("datos-perfil-1", "Datos detallados del usuario 1", 4000);
// Sin TTL (no expira)
CacheManager.set("configuracion-global", { tema: "dark", idioma: "es" }, 0);
// TTL muy corto (expirará antes de la última comprobación)
CacheManager.set("token-corto", "abc12345", 1000);

console.log("\n📋 Estado del Cache después de SET:", CacheManager.debug());
// Salida: Estado del Cache después de SET: { size: 3, stats: { hits: 0, misses: 0 }, keys: [ 'datos-perfil-1', 'configuracion-global', 'token-corto' ] }

// 3. Prueba de Cache Hit (Inmediato)
setTimeout(() => {
  console.log("\n--- Prueba de HIT ---");
  let perfil = CacheManager.get("datos-perfil-1");
  console.log(
    "Resultado de GET (datos-perfil-1):",
    perfil ? perfil.substring(0, 10) + "..." : "null"
  );
  // Se emitirá 'cache:hit'
  console.log("Estadísticas de Cache:", CacheManager.debug().stats);
  // Salida: Estadísticas de Cache: { hits: 1, misses: 0 }
}, 500);

// 4. Prueba de Cache Miss y Auto-expiración
setTimeout(() => {
  console.log("\n--- Prueba de MISS (Expiración) ---");
  let token = CacheManager.get("token-corto"); // Debe haber expirado (TTL de 1000ms)
  console.log("Resultado de GET (token-corto):", token);
  // Se emitirá 'cache:miss'
  console.log("Estadísticas de Cache:", CacheManager.debug().stats);
  // Salida: Estadísticas de Cache: { hits: 1, misses: 1 }

  let inexistente = CacheManager.get("clave-inexistente");
  console.log("Resultado de GET (clave-inexistente):", inexistente);
  // Se emitirá 'cache:miss'
  console.log("Estadísticas de Cache:", CacheManager.debug().stats);
  // Salida: Estadísticas de Cache: { hits: 1, misses: 2 }
}, 1500);

// 5. Prueba de Limpieza Manual
setTimeout(() => {
  console.log("\n--- Prueba de Limpieza Manual ---");
  CacheManager.del("configuracion-global");
  console.log("Estado del Cache después de DEL:", CacheManager.debug().keys);
  // Salida: Estado del Cache después de DEL: [ 'datos-perfil-1' ]
}, 3000);

// 6. Prueba de Expiración Automática y Limpieza Final
setTimeout(() => {
  console.log("\n--- Prueba de Expiración Automática y Limpieza Final ---");
  // 'datos-perfil-1' ya debió expirar (TTL de 4000ms)

  let perfilFinal = CacheManager.get("datos-perfil-1");
  console.log("Resultado de GET (datos-perfil-1) final:", perfilFinal);
  // Salida: Resultado de GET (datos-perfil-1) final: null (Si no se activó la limpieza del TTL, el GET lo limpiará aquí y contará MISS)

  console.log("Estado final de la Cache:", CacheManager.debug());

  // Limpiar listeners y caché
  removerHitListener();
  removerMissListener();
  CacheManager.clear();
  console.log("Estado del EventBus después de la limpieza:", EventBus.debug());
}, 5000);
