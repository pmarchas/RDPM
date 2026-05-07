# Remote Manager

Aplicación de escritorio para gestionar conexiones **RDP**, **VNC** y **SSH**.
Compatible con **Windows y macOS**. Soporta fichero de configuración compartido en red.

---

## Requisitos previos

- **Node.js** 18 o superior → https://nodejs.org
- **npm** 9+ (incluido con Node.js)

---

## Instalación y primera ejecución

```bash
# 1. Accede a la carpeta del proyecto
cd remote-manager

# 2. Instala las dependencias (solo la primera vez)
npm install

# 3. Lanza en modo desarrollo
npm run dev
```

La primera vez aparece el **asistente de configuración** (4 pasos):
1. Bienvenida
2. Selección del fichero de configuración (local o en red)
3. Contraseña maestra de cifrado (opcional)
4. Confirmación

---

## Compilar instaladores

```bash
npm run build:win    # Windows → .exe (instalador NSIS)
npm run build:mac    # macOS  → .dmg
npm run build:all    # Ambas plataformas
```

Los instaladores se generan en `dist-app/`.

> En macOS necesitas Xcode Command Line Tools: `xcode-select --install`

---

## Fichero de configuración compartido en red

El fichero `remote-manager-config.json` almacena todos los servidores y grupos.
Colócalo en una **carpeta de red** para que varios usuarios lo compartan:

| Sistema  | Ejemplo de ruta                                           |
|----------|-----------------------------------------------------------|
| Windows  | `\\SERVIDOR\Compartido\remote-manager-config.json`        |
| macOS    | `/Volumes/NAS/Compartido/remote-manager-config.json`      |

Cada usuario debe:
1. Instalar la aplicación en su equipo
2. Configurar la **misma ruta de red** en Ajustes → Fichero de configuración
3. Usar la **misma contraseña maestra** de cifrado

---

## Seguridad

- Las contraseñas se cifran con **AES-256-CBC** + clave derivada con scrypt
- La contraseña maestra se guarda **solo localmente** en `~/.remote-manager/settings.json`
- El fichero compartido nunca contiene contraseñas en texto plano (si usas contraseña maestra)

---

## Tipos de conexión

| Tipo    | Puerto por defecto | Cómo se lanza                                                       |
|---------|--------------------|---------------------------------------------------------------------|
| **RDP** | 3389               | `mstsc.exe` (Windows) / Protocolo `rdp://` (macOS)                 |
| **VNC** | 5900               | TightVNC / RealVNC / TigerVNC (Windows), Compartir pantalla (macOS) |
| **SSH** | 22                 | Windows Terminal / PowerShell / CMD · Terminal / iTerm2 (macOS)    |

---

## Uso rápido

| Acción               | Resultado                                       |
|----------------------|-------------------------------------------------|
| Doble clic           | Lanza la conexión                               |
| Clic derecho         | Menú contextual (conectar, editar, copiar, etc.)|
| Botón «Nuevo servidor» | Abre formulario de alta                       |
| Panel lateral        | Filtra por grupo                                |
| Botón Ajustes        | Cambia ruta del fichero o contraseña maestra    |

---

## Estructura del proyecto

```
remote-manager/
├── electron/
│   ├── main.js        # Proceso principal: IPC, cifrado AES, lanzadores
│   └── preload.js     # Bridge seguro (contextIsolation)
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── index.css      # Tema oscuro con variables CSS
│   └── components/
│       ├── Sidebar.jsx        # Panel de grupos
│       ├── ServerGrid.jsx     # Vista cuadrícula / lista
│       ├── ServerModal.jsx    # Añadir / editar servidor
│       ├── SettingsModal.jsx  # Ajustes de la app
│       ├── SetupWizard.jsx    # Asistente primera vez
│       └── ContextMenu.jsx    # Menú contextual (clic derecho)
├── index.html
├── vite.config.js
└── package.json
```
