export function nextDetectionEpoch(current: number) {
  return current + 1;
}

export function isCurrentDetection(epoch: number, current: number) {
  return epoch === current;
}

export function canCommitDetection({
  claimEpoch,
  currentEpoch,
  phase,
  expectedPhase,
  locked,
}: {
  claimEpoch: number;
  currentEpoch: number;
  phase: string;
  expectedPhase: string;
  locked: boolean;
}) {
  return isCurrentDetection(claimEpoch, currentEpoch) && phase === expectedPhase && !locked;
}
