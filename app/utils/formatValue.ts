/**
 * Format a number with appropriate units based on the data type
 *
 * This function provides consistent formatting across the application:
 * - For Meters: Uses nm, μm, mm, cm, m, km, and light years
 * - For USD: Uses $ prefix with K, M, B, T suffixes
 * - For other units: Uses K, M, B, T suffixes
 */
export function formatValue(value: number, units?: string): string {
  // Special formatting for distance measurements in meters
  if (units === "Meters") {
    // Extremely large: use light years
    if (value >= 9.461e15) {
      const lightYears = value / 9.461e15;
      if (lightYears >= 1e9) {
        return `${(lightYears / 1e9).toFixed(2)}B ly`;
      }
      if (lightYears >= 1e6) {
        return `${(lightYears / 1e6).toFixed(2)}M ly`;
      }
      if (lightYears >= 1000) {
        return `${(lightYears / 1000).toFixed(2)}K ly`;
      }
      return `${lightYears.toFixed(2)} ly`;
    }
    // Very large: use scientific notation with meters
    if (value >= 1e15) {
      return `${value.toExponential(2)} m`;
    }
    // Large distances: kilometers
    if (value >= 1000) {
      const km = value / 1000;
      if (km >= 1e9) {
        return `${(km / 1e9).toFixed(1)}B km`;
      }
      if (km >= 1e6) {
        return `${(km / 1e6).toFixed(1)}M km`;
      }
      if (km >= 1000) {
        return `${(km / 1000).toFixed(1)}K km`;
      }
      return `${km.toFixed(1)} km`;
    }
    // Medium distances: meters
    if (value >= 1) {
      return `${value.toFixed(2)} m`;
    }
    // Centimeters
    if (value >= 0.01) {
      return `${(value * 100).toFixed(2)} cm`;
    }
    // Millimeters
    if (value >= 0.001) {
      return `${(value * 1000).toFixed(2)} mm`;
    }
    // Micrometers
    if (value >= 1e-6) {
      return `${(value * 1e6).toFixed(2)} μm`;
    }
    // Nanometers
    if (value >= 1e-9) {
      return `${(value * 1e9).toFixed(2)} nm`;
    }
    // Picometers and smaller: use scientific notation with meters
    return `${value.toExponential(2)} m`;
  }

  // Special formatting for USD (add $ prefix, no suffix needed)
  if (units === "USD") {
    if (value >= 1e12) {
      return `$${(value / 1e12).toFixed(1)}T`;
    }
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  }

  // Standard formatting for other unit types (People, Years, etc.)
  const suffix = units ? ` ${units}` : "";
  if (value >= 1e12) {
    return `${(value / 1e12).toFixed(1)}T${suffix}`;
  }
  if (value >= 1e9) {
    return `${(value / 1e9).toFixed(1)}B${suffix}`;
  }
  if (value >= 1e6) {
    return `${(value / 1e6).toFixed(1)}M${suffix}`;
  }
  if (value >= 1e3) {
    return `${(value / 1e3).toFixed(1)}K${suffix}`;
  }
  return `${value.toFixed(0)}${suffix}`;
}
