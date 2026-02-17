# Preset Comparisons

This feature allows you to share pre-saved comparisons using short, memorable URLs instead of long base64-encoded URLs.

## How to Use

Instead of using long URLs with the `shared` parameter like:

```
http://localhost:3000/?shared=eyJiYWxscyI6W3sibmFtZSI6IkFtYXpvbiI...
```

You can now use short, clean URLs with the `preset` parameter like:

```
http://localhost:3000/?preset=money-comparison
```

## Available Presets

The following presets are available in `/public/data/presets.json`:

### 1. `money-comparison`

Comparing major tech companies, valuable items, and income levels

- Companies: Amazon, TSMC, Apple
- Valuable items: Commercial Satellite, Private Island, Fighter Jet, Sports Car
- Income levels: Germany, Nigeria

**URL**: `/?preset=money-comparison`

### 2. `stars-planets`

Comparing celestial bodies from planets to giant stars

- Planets: Mercury, Earth, Saturn, Jupiter
- Stars: Sun, Vega, Rigel, Betelgeuse, Deneb

**URL**: `/?preset=stars-planets`

### 3. `assets-gdp-debt`

Global economic indicators and national debts

- National debts: US, Canada, UK
- Global assets: World GDP, All Gold Ever Mined, Bitcoin
- Companies and individuals: Amazon, Microsoft, Jeff Bezos
- Reference: Fighter Jet

**URL**: `/?preset=assets-gdp-debt`

### 4. `energy-waste`

Comparing total waste production per MWh across different energy sources

- Fossil fuels: Coal, Natural Gas
- Renewables: Solar PV, Hydroelectric, Wind
- Nuclear
- Biomass
- Reference: City Bus, Average Human, Nuclear Waste

**URL**: `/?preset=energy-waste`

### 5. `energy-consumption`

Various scales of energy consumption and production

- Power generation: Nuclear Power Plant, Wind Farm, Bitcoin Network
- Countries: Norway, Germany
- Buildings: Hospital, Office, Home
- Appliances: Air Conditioner, Hair Dryer, Microwave, Laptop
- Others: Rocket Launch, Flight, Hot Shower

**URL**: `/?preset=energy-consumption`

### 6. `military-expenditure`

Military spending by major countries in 2023

- Countries: United States, China, India, United Kingdom, Germany, Spain, Mexico

**URL**: `/?preset=military-expenditure`

## Adding New Presets

To add a new preset, edit `/public/data/presets.json` and add a new entry with the following structure:

```json
{
  "your-preset-id": {
    "name": "Display Name",
    "description": "Brief description of the comparison",
    "balls": [
      {
        "name": "Item Name",
        "color": "#hexcolor",
        "originalRadius": 1234.56,
        "units": "USD",
        "sourceId": "optional-source-id"
      }
    ],
    "comparisonType": "area"
  }
}
```

### Fields:

- **name**: Human-readable name for the preset (not used in URL)
- **description**: Brief description of what this preset compares
- **balls**: Array of data points to visualize
  - **name**: Display name for the data point
  - **color**: Hex color code (e.g., "#ef4444")
  - **originalRadius**: The value/magnitude to compare
  - **units**: Unit of measurement (e.g., "USD", "Meters", "Kg", "kWh")
  - **sourceId**: (Optional) Reference to the data source
- **comparisonType**: Either "area" or "linear"
  - "area": Compares by area (radius²)
  - "linear": Compares by radius directly

## Technical Implementation

The preset feature works by:

1. Checking for the `preset` query parameter in the URL
2. Fetching `/public/data/presets.json`
3. Loading the corresponding preset data
4. Applying it to the simulation (same as the `shared` parameter)

The `preset` parameter takes priority over the `shared` parameter if both are present.
