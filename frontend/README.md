# AttendTrack Frontend 🎨

The AttendTrack frontend is a high-performance, single-page application built with React, Vite, and TypeScript. It is designed to be lean, fast, and highly visual.

## 📱 Design Philosophy

- **Mobile First**: Optimized for quick interactions on the floor.
- **Visual Feedback**: Dynamic progress rings and color-coded status indicators (Green for IN, Red for OUT).
- **Real-time Interaction**: The app calculates and updates "minutes worked today" live, giving employees immediate satisfaction.

## 🛠️ Tech Stack

- **React (Hooks)**: For state management and component lifecycle.
- **Vite**: Ultra-fast development and build tool.
- **TypeScript**: Ensuring type safety across the application.
- **Vanilla CSS**: Custom-crafted styles for a premium, non-generic look.

## 🧩 Key Components

### `App.tsx`
The heart of the application. It handles:
- **Data Fetching**: Syncing with the Flask backend.
- **Dynamic Grid**: Adjusting the layout based on the number of active employees.
- **Progress Logic**: Managing the SVG-based circular progress indicators.

### `App.css`
A curated design system featuring:
- Seamless gradients.
- Glassmorphism effects.
- Subtle micro-animations for button interactions.

---

## 🏗️ Development

To run the frontend in development mode:
```bash
bun dev
```

To build for production:
```bash
bun build
```
The optimized bundle will be generated in the `dist/` directory.
