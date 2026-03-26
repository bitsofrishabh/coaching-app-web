export const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const calculateBMI = (weightKg, heightCm) => {
  const weight = toNumber(weightKg);
  const height = toNumber(heightCm);
  if (!weight || !height) return null;
  const heightM = height / 100;
  if (heightM <= 0) return null;
  return weight / (heightM * heightM);
};

export const getHealthyWeightRange = (heightCm) => {
  const height = toNumber(heightCm);
  if (!height) return null;
  const heightM = height / 100;
  const minKg = 18.5 * heightM * heightM;
  const maxKg = 24.9 * heightM * heightM;
  return { minKg, maxKg };
};

export const getHealthyTargetWeight = (heightCm) => {
  const height = toNumber(heightCm);
  if (!height) return null;
  const heightM = height / 100;
  const targetBmi = (18.5 + 24.9) / 2;
  return targetBmi * heightM * heightM;
};

export const getHealthyWeightDelta = (currentWeightKg, heightCm) => {
  const current = toNumber(currentWeightKg);
  const range = getHealthyWeightRange(heightCm);
  if (!current || !range) return null;
  if (current > range.maxKg) {
    return { direction: "lose", kg: current - range.maxKg };
  }
  if (current < range.minKg) {
    return { direction: "gain", kg: range.minKg - current };
  }
  return { direction: "healthy", kg: 0 };
};

export const calculateMaintenanceCalories = (client) => {
  const targetWeight = getHealthyTargetWeight(client?.height_cm);
  if (targetWeight) return Math.round(targetWeight * 24);

  const currentWeight = toNumber(client?.current_weight_kg) || toNumber(client?.initial_weight_kg);
  if (!currentWeight) return null;
  return Math.round(currentWeight * 24);
};
