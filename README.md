# Number Sense

An interactive visualization tool for understanding and comparing numerical values through physics-based simulations. Values are represented as bouncing balls whose sizes correspond to their magnitudes, making large-scale differences intuitive and engaging.

## Features

- **Physics-Based Visualization**: Uses Matter.js to create realistic ball physics simulations where size represents value
- **Multiple Data Sources**: Pre-loaded datasets including:
  - Billionaires' net worth
  - Companies' market capitalization
  - GDP by country
  - Population by country
  - Stellar diameters
  - Historical time periods
  - Price comparisons
  - And more...
- **Comparison Modes**:
  - **Area Mode**: Ball sizes scale by area (default, mathematically accurate)
  - **Diameter Mode**: Ball sizes scale by diameter (linear, more intuitive for some comparisons)
- **Interactive Comparison**: Navigate between values to see side-by-side comparisons with calculated ratios
- **Custom Values**: Add your own data points with custom names, values, and units
- **State Sharing**: Share your simulations via URL with compressed state encoding
- **Mobile Optimized**: Full support for touch interactions and mobile Safari with dynamic viewport units
- **Zoom & Pan**: Interactive controls for exploring large value ranges
- **Legend Management**: Toggle visibility, remove items, and focus on specific values

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

```bash
npm install
```

### Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing

Run the test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

### Data Management

Fetch and update all data sources:

```bash
npm run fetch-data
```

Generate the data index:

```bash
npm run generate-index
```

## Project Structure

```
app/
├── components/
│   ├── AddDataDialog/     # Data selection and addition UI
│   ├── PhysicsCanvas/     # Main physics simulation canvas
│   │   ├── hooks/         # Physics engine and interaction hooks
│   │   ├── handlers/      # Event handlers for zoom, pan, etc.
│   │   └── physics/       # Matter.js physics logic
│   └── Toast/             # Toast notifications
├── utils/                 # Utility functions (formatting, state sharing)
└── page.tsx              # Main application page

public/
└── data/                  # JSON data files for various datasets

scripts/                   # Data fetching and generation scripts
```

## Technology Stack

- **Framework**: Next.js 15+ (App Router)
- **Language**: TypeScript with strict mode
- **Styling**: Tailwind CSS 4 with CSS Modules
- **Physics**: Matter.js
- **Testing**: Vitest + React Testing Library
- **State**: React hooks with localStorage persistence
- **Icons**: Lucide React
- **Compression**: pako (for URL state encoding)

## Key Interactions

- **Click/Tap**: Select balls in comparison mode or toggle legend items
- **Scroll/Pinch**: Zoom in and out
- **Drag**: Pan around the canvas
- **Hover** (desktop): View detailed tooltips
- **Navigation Arrows** (comparison mode): Move between values sequentially

## Browser Support

Optimized for modern browsers with special attention to:

- Mobile Safari (iOS)
- Chrome/Edge
- Firefox

Uses dynamic viewport height units (`dvh`) for proper mobile display.

## Debug Mode

Append `?debugMode=true` to the URL to enable debug mode (e.g. `http://localhost:3000/?debugMode=true`).

This activates two additional capabilities:

### Drop Ball toolbar

A raw input toolbar appears above the canvas with:

- **Name** – label for the ball
- **Area** – numeric value (interpreted as the ball's area)
- **Drop Ball** button – spawns the ball directly into the simulation

This is useful for quickly testing custom values without going through the data dialog.

### Preset export helpers

Two functions become available in the browser's developer console:

```js
// Logs the preset object and its JSON representation to the console
window.debugExportPreset(
  "my-preset-id",
  "My Preset Name",
  "Optional description",
);

// Returns the preset as a formatted JSON string
window.debugExportPresetJson(
  "my-preset-id",
  "My Preset Name",
  "Optional description",
);
```

Both functions snapshot the current canvas balls (including their names, colors, radii, and comparison type) into the preset format used by `public/data/presets.json`. The output can be copied and added directly to that file to create a new built-in preset.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the MIT License.

## Acknowledgments

Built with [Next.js](https://nextjs.org), powered by [Matter.js](https://brm.io/matter-js/) physics engine.
