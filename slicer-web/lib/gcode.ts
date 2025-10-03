export interface GcodeEstimate {
  time_s: number;
  filamentLen_mm: number;
}

interface Vector3 {
  x: number;
  y: number;
  z: number;
}

function sanitizeLine(line: string): string {
  let sanitized = line;
  sanitized = sanitized.replace(/\(.*?\)/g, '');
  const semicolonIndex = sanitized.indexOf(';');
  if (semicolonIndex !== -1) {
    sanitized = sanitized.slice(0, semicolonIndex);
  }
  return sanitized.trim();
}

function parseArgs(parts: string[]): Record<string, number> {
  const args: Record<string, number> = {};

  for (let i = 1; i < parts.length; i += 1) {
    const token = parts[i];
    if (!token) {
      continue;
    }

    const letter = token[0]?.toUpperCase();
    const value = Number.parseFloat(token.slice(1));
    if (!letter || Number.isNaN(value)) {
      continue;
    }
    args[letter] = value;
  }

  return args;
}

export function parseAndEstimate(content: string): GcodeEstimate {
  const position: Vector3 = { x: 0, y: 0, z: 0 };
  let extruder = 0;
  let absolutePositioning = true;
  let absoluteExtrusion = true;
  let feedRateMmPerMin: number | undefined;

  let time_s = 0;
  let filamentLen_mm = 0;

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = sanitizeLine(rawLine);
    if (!line) {
      continue;
    }

    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      continue;
    }

    const command = parts[0].toUpperCase();
    const commandLetter = command[0];
    const commandNumber = Number.parseInt(command.slice(1), 10);

    if (!commandLetter || Number.isNaN(commandNumber)) {
      continue;
    }

    const args = parseArgs(parts);

    if (commandLetter === 'G') {
      switch (commandNumber) {
        case 90:
          absolutePositioning = true;
          continue;
        case 91:
          absolutePositioning = false;
          continue;
        case 92: {
          if ('X' in args) {
            position.x = args.X;
          }
          if ('Y' in args) {
            position.y = args.Y;
          }
          if ('Z' in args) {
            position.z = args.Z;
          }
          if ('E' in args) {
            extruder = args.E;
          }
          continue;
        }
        default:
          break;
      }
    } else if (commandLetter === 'M') {
      if (commandNumber === 82) {
        absoluteExtrusion = true;
        continue;
      }
      if (commandNumber === 83) {
        absoluteExtrusion = false;
        continue;
      }
    }

    const isMoveCommand = commandLetter === 'G' && (commandNumber === 0 || commandNumber === 1);
    if (!isMoveCommand) {
      continue;
    }

    if ('F' in args) {
      const candidate = args.F;
      feedRateMmPerMin = candidate > 0 ? candidate : undefined;
    }

    const nextPosition: Vector3 = { ...position };
    if ('X' in args) {
      nextPosition.x = absolutePositioning ? args.X : nextPosition.x + args.X;
    }
    if ('Y' in args) {
      nextPosition.y = absolutePositioning ? args.Y : nextPosition.y + args.Y;
    }
    if ('Z' in args) {
      nextPosition.z = absolutePositioning ? args.Z : nextPosition.z + args.Z;
    }

    let extrusionDelta = 0;
    if ('E' in args) {
      if (absoluteExtrusion) {
        extrusionDelta = args.E - extruder;
        extruder = args.E;
      } else {
        extrusionDelta = args.E;
        extruder += args.E;
      }
    }

    const dx = nextPosition.x - position.x;
    const dy = nextPosition.y - position.y;
    const dz = nextPosition.z - position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > 0 && feedRateMmPerMin && feedRateMmPerMin > 0) {
      const feedRateMmPerSec = feedRateMmPerMin / 60;
      if (feedRateMmPerSec > 0) {
        time_s += distance / feedRateMmPerSec;
      }
    }

    if (extrusionDelta > 0) {
      filamentLen_mm += extrusionDelta;
    }

    position.x = nextPosition.x;
    position.y = nextPosition.y;
    position.z = nextPosition.z;
  }

  return { time_s, filamentLen_mm };
}
