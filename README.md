# Neutrón

App del juego de mesa Neutrón (Robert A. Kraus, 1978), para jugar **1 jugador contra la IA** o **2 jugadores en el mismo dispositivo**, en PC y en celular. Es una PWA (se puede instalar y usar sin internet): HTML + CSS + JavaScript plano, sin build step ni backend.

## Estructura del proyecto

- `engine.js` — motor de reglas puro (sin interfaz): tablero, movimientos, turnos, condiciones de victoria.
- `ai.js` / `ai-worker.js` — la IA (Fácil, Medio, Difícil), corre en un Web Worker para no trabar la interfaz.
- `colors.js` — paletas de colores y cálculo automático del color de las líneas del tablero.
- `storage.js` — guardado de la configuración y autoguardado de la partida en curso (localStorage).
- `audio.js` — sonidos generados con Web Audio API (no usa archivos de audio).
- `app.js` — interfaz: pantallas, tablero, arrastre de piezas, animaciones.
- `index.html`, `style.css` — estructura y estilos.
- `manifest.webmanifest`, `sw.js`, `icon*.png/svg` — lo necesario para instalarla como PWA y que funcione sin conexión.
- `tests/` — pruebas automáticas del motor y de la IA (Vitest) y pruebas de interfaz (Playwright).

## Cómo probarla en desarrollo

No hace falta instalar nada para jugar: es HTML/CSS/JS servido tal cual. Necesitás sí un servidor local (abrir el `index.html` con doble clic no alcanza, porque los Web Workers y los módulos de JavaScript no funcionan con `file://`).

Con Python (ya suele venir instalado en Windows, Mac y Linux):

```bash
python -m http.server 8080
```

Y abrís `http://localhost:8080` en el navegador.

Si tenés Node.js instalado, también podés usar:

```bash
npx serve .
```

## Cómo correr los tests

Los tests automáticos usan [Vitest](https://vitest.dev) (motor de reglas e IA) y [Playwright](https://playwright.dev) (interfaz, arrastre, tamaños de pantalla). Para correrlos hace falta **Node.js 18 o más nuevo** instalado (https://nodejs.org, versión LTS).

```bash
npm install          # una sola vez, instala vitest y playwright
npm test              # corre los tests del motor y de la IA
npm run test:e2e      # corre los tests de interfaz con Playwright (requiere: npx playwright install, una sola vez)
```

Estos tests no son necesarios para jugar ni para publicar la app: solo sirven para verificar que las reglas y la IA funcionan bien durante el desarrollo.

## Cómo generar la versión final

No hay "build": los archivos de la carpeta `neutron-app/` (menos `tests/`, `scripts/` y `package.json`) **son** la versión final, lista para copiar a cualquier hosting o abrir localmente.

## Cómo instalarla

### En PC (Windows, Mac, Linux) con Chrome o Edge

1. Abrí la app en el navegador (la URL donde la hayas publicado, o `http://localhost:8080` si la estás probando local).
2. En la barra de direcciones va a aparecer un ícono de "Instalar app" (o: menú ⋮ → "Instalar Neutrón…").
3. Confirmá. Queda como una app normal, con su propio ícono, y funciona sin conexión.

### En Android (Chrome)

1. Abrí la app en Chrome.
2. Menú ⋮ → **"Instalar app"** (o "Agregar a pantalla de inicio").
3. Confirmá. Queda un ícono en el teléfono como cualquier otra app.

### En iPhone/iPad (Safari)

1. Abrí la app en Safari (tiene que ser Safari, no Chrome, para poder instalarla en iOS).
2. Tocá el botón de compartir (el cuadrado con la flecha hacia arriba).
3. Elegí **"Agregar a pantalla de inicio"**.
4. Confirmá. Queda un ícono en la pantalla de inicio y abre a pantalla completa.

## Cómo publicarla (para que cualquiera la abra desde un link)

La forma más simple y gratuita es **GitHub Pages**:

1. Crear un repositorio en GitHub (puede ser público) y subir el contenido de esta carpeta.
2. En la configuración del repositorio, activar GitHub Pages apuntando a la rama principal.
3. GitHub te da una URL (algo como `https://usuario.github.io/neutron-app/`). Esa es la URL para compartir, abrir en el celu, o instalar como PWA.

Cualquier otro hosting de archivos estáticos (Netlify, Vercel, un hosting tradicional, etc.) también sirve: solo hay que subir los archivos de esta carpeta tal cual.

## Cómo abrirla sin conocimientos técnicos

Una vez publicada (por ejemplo en GitHub Pages), alcanza con mandar el link. Quien lo reciba lo abre en el navegador del celu o la PC y, si quiere, lo instala siguiendo los pasos de más arriba. No hace falta instalar Node, Python, ni ningún programa adicional para *jugar*; eso solo hace falta para *desarrollar* o correr los tests.
