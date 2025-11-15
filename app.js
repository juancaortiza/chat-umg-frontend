// ======================
//  CONFIGURACIÓN DE API
// ======================

// API del ingeniero (login y envío de mensajes)
const LOGIN_URL = "https://backcvbgtmdesa.azurewebsites.net/api/login/authenticate";
const MENSAJES_URL = "https://backcvbgtmdesa.azurewebsites.net/api/Mensajes";

// API propia en Node.js que lee la tabla [dbo].[Chat_Mensaje] en SQL Server
// Cuando la publiques (Render, Azure, etc.), cambia esta URL.
const MENSAJES_DB_URL = "http://localhost:3000/api/chat-mensajes";

// ======================
//  OBTENER ELEMENTOS DOM
// ======================

const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const messageSection = document.getElementById("message-section");
const loginSection = document.getElementById("login-section");
const currentUserSpan = document.getElementById("current-user");
const messageForm = document.getElementById("message-form");
const messageStatus = document.getElementById("message-status");
const logoutBtn = document.getElementById("logout-btn");

const loadMessagesBtn = document.getElementById("load-messages-btn");
const messagesContainer = document.getElementById("messages-container");

// ==========================
//  CARGA INICIAL DE LA PÁGINA
// ==========================

document.addEventListener("DOMContentLoaded", () => {
  const savedToken = localStorage.getItem("token");
  const savedUser = localStorage.getItem("username");

  if (savedToken && savedUser) {
    mostrarSeccionMensajes(savedUser);
  }
});

// ==========================
//  FUNCIONES AUXILIARES
// ==========================

function guardarSesion(token, username) {
  localStorage.setItem("token", token);
  localStorage.setItem("username", username);
}

function limpiarSesion() {
  localStorage.removeItem("token");
  localStorage.removeItem("username");
}

function mostrarSeccionMensajes(username) {
  loginSection.classList.add("hidden");
  messageSection.classList.remove("hidden");
  currentUserSpan.textContent = username;
}

function mostrarSeccionLogin() {
  loginSection.classList.remove("hidden");
  messageSection.classList.add("hidden");
  currentUserSpan.textContent = "";
}

// ==========================
//  SERIE I: LOGIN / AUTENTICACIÓN
// ==========================

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginStatus.textContent = "";
  loginStatus.className = "status";

  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;

  if (!username || !password) {
    loginStatus.textContent = "Debe ingresar usuario y contraseña.";
    loginStatus.classList.add("error");
    return;
  }

  // JSON EXACTO como el ejemplo del enunciado:
  // {
  //   "Username": "aranam3",
  //   "Password": "123456a"
  // }
  const body = {
    Username: username,
    Password: password,
  };

  console.log("Enviando al login:", body);

  try {
    const response = await fetch(LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
    });

    const status = response.status;
    let rawText = await response.text();

    console.log("Status login:", status);
    console.log("Respuesta cruda del servidor:", rawText);

    if (!response.ok) {
      // Intentamos mostrar el mensaje que devuelve el backend
      let mensaje = `Error al autenticar (${status}).`;

      if (rawText && rawText.length < 200 && !rawText.trim().startsWith("<")) {
        mensaje += " " + rawText;
      }

      loginStatus.textContent = mensaje;
      loginStatus.classList.add("error");
      return;
    }

    // Intentar convertir a JSON
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      data = rawText; // si no es JSON, lo dejamos como texto
    }

    console.log("Objeto parseado:", data);

    // Buscar token en varias propiedades típicas
    let token = null;

    if (typeof data === "string") {
      token = data;
    } else if (data.token) {
      token = data.token;
    } else if (data.accessToken) {
      token = data.accessToken;
    } else if (data.Authorization) {
      token = data.Authorization;
    } else if (data.result && data.result.token) {
      token = data.result.token;
    }

    if (!token) {
      loginStatus.textContent =
        "Autenticación respondió, pero no se encontró un token. Revisa la consola (F12).";
      loginStatus.classList.add("error");
      return;
    }

    guardarSesion(token, username);
    loginStatus.textContent = "Autenticación exitosa ✅";
    loginStatus.classList.add("success");

    mostrarSeccionMensajes(username);
  } catch (error) {
    console.error("Error de red en login:", error);
    loginStatus.textContent = "Error de conexión con el servidor.";
    loginStatus.classList.add("error");
  }
});

// ==========================
//  SERIE II: ENVÍO DE MENSAJES
// ==========================

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  messageStatus.textContent = "";
  messageStatus.className = "status";

  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  if (!token || !username) {
    messageStatus.textContent = "No hay sesión activa. Inicie sesión de nuevo.";
    messageStatus.classList.add("error");
    mostrarSeccionLogin();
    return;
  }

  const codSala = Number(document.getElementById("codSala").value);
  const contenido = document.getElementById("contenido").value.trim();

  if (!contenido) {
    messageStatus.textContent = "El mensaje no puede estar vacío.";
    messageStatus.classList.add("error");
    return;
  }

  const body = {
    Cod_Sala: codSala,
    Login_Emisor: username,
    Contenido: contenido,
  };

  console.log("Enviando mensaje:", body);

  try {
    const response = await fetch(MENSAJES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,  // Token Bearer obligatorio
      },
      body: JSON.stringify(body),
    });

    const status = response.status;
    const rawText = await response.text();

    console.log("Status envío mensaje:", status);
    console.log("Respuesta cruda envío mensaje:", rawText);

    if (!response.ok) {
      messageStatus.textContent = "No se pudo enviar el mensaje (revisa token/credenciales).";
      messageStatus.classList.add("error");
      return;
    }

    messageStatus.textContent = "Mensaje enviado correctamente ✅";
    messageStatus.classList.add("success");
    messageForm.reset();
    document.getElementById("codSala").value = 0;
  } catch (error) {
    console.error("Error de red al enviar mensaje:", error);
    messageStatus.textContent = "Error de conexión con el servidor.";
    messageStatus.classList.add("error");
  }
});

// ==========================
//  SERIE III: VISUALIZACIÓN DE MENSAJES
// ==========================

if (loadMessagesBtn) {
  loadMessagesBtn.addEventListener("click", cargarMensajes);
}

async function cargarMensajes() {
  messagesContainer.innerHTML = "Cargando mensajes...";

  try {
    const response = await fetch(MENSAJES_DB_URL);

    if (!response.ok) {
      const txt = await response.text();
      console.error("Error al obtener mensajes:", response.status, txt);
      messagesContainer.innerHTML = "Error al cargar los mensajes.";
      return;
    }

    const mensajes = await response.json();
    console.log("Mensajes recibidos:", mensajes);

    if (!Array.isArray(mensajes) || mensajes.length === 0) {
      messagesContainer.innerHTML = "No hay mensajes para mostrar.";
      return;
    }

    // Ya vienen ordenados por Fecha_Envio DESC desde SQL
    const html = mensajes
      .map((m) => {
        const id = m.ID_Mensaje;
        const emisor = m.Login_Emisor;
        const contenido = m.Contenido;
        const estado = m.Estado;
        const sala = m.Cod_Sala;

        // Formatear la fecha de forma legible
        let fechaTexto = m.Fecha_Envio;
        try {
          const fecha = new Date(m.Fecha_Envio);
          if (!isNaN(fecha)) {
            fechaTexto = fecha.toLocaleString();
          }
        } catch (e) {
          // si falla, dejamos el valor crudo
        }

        return `
          <div class="message-item">
            <div class="message-meta">
              <strong>${emisor}</strong>
              <span> | Sala: ${sala}</span>
              <span> | ${fechaTexto}</span>
              <span> | Estado: ${estado}</span>
              <span> | Id: ${id}</span>
            </div>
            <div class="message-content">${contenido}</div>
          </div>
        `;
      })
      .join("");

    messagesContainer.innerHTML = html;
  } catch (error) {
    console.error("Error de red al obtener mensajes:", error);
    messagesContainer.innerHTML = "Error de conexión con el servidor de mensajes.";
  }
}

// ==========================
//  CERRAR SESIÓN
// ==========================

logoutBtn.addEventListener("click", () => {
  limpiarSesion();
  messageStatus.textContent = "";
  loginStatus.textContent = "Sesión cerrada.";
  loginStatus.className = "status success";
  mostrarSeccionLogin();
});
