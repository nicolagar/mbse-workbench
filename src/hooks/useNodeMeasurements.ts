import { useCallback, useState } from "react";

export interface NodeMeasurement {
  width: number;
  height: number;
}

const materiallyChanged = (previous: NodeMeasurement | undefined, next: NodeMeasurement) =>
  !previous || Math.abs(previous.width - next.width) >= 1 || Math.abs(previous.height - next.height) >= 1;

export function useNodeMeasurements() {
  const [measurements, setMeasurements] = useState<Record<string, NodeMeasurement>>({});

  const reportMeasurement = useCallback((id: string, measurement: NodeMeasurement) => {
    if (!Number.isFinite(measurement.width) || !Number.isFinite(measurement.height) || measurement.width <= 0 || measurement.height <= 0) return;
    const rounded = {
      width: Math.round(measurement.width),
      height: Math.round(measurement.height)
    };
    setMeasurements((current) => materiallyChanged(current[id], rounded)
      ? { ...current, [id]: rounded }
      : current);
  }, []);

  return { measurements, reportMeasurement };
}
