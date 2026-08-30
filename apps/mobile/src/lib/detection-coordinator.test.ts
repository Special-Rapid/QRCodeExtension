import { strict as assert } from 'node:assert';
import test from 'node:test';
import { canCommitDetection, nextDetectionEpoch } from './detection-coordinator.ts';

test('a barcode acquisition prevents an in-flight OCR completion from opening the picker', () => {
  let current = 0;
  const liveOcr = nextDetectionEpoch(current);
  current = liveOcr;
  const barcode = nextDetectionEpoch(current);
  current = barcode;
  assert.equal(canCommitDetection({ claimEpoch: liveOcr, currentEpoch: current, phase: 'ready', expectedPhase: 'ready', locked: false }), false);
  assert.equal(canCommitDetection({ claimEpoch: barcode, currentEpoch: current, phase: 'acquiring', expectedPhase: 'acquiring', locked: false }), true);
});

test('an OCR picker claim prevents a late barcode timer from replacing it with a result or auto-handoff', () => {
  let current = 0;
  const barcode = nextDetectionEpoch(current);
  current = barcode;
  const liveOcr = nextDetectionEpoch(current);
  current = liveOcr;
  assert.equal(canCommitDetection({ claimEpoch: barcode, currentEpoch: current, phase: 'acquiring', expectedPhase: 'acquiring', locked: false }), false);
  assert.equal(canCommitDetection({ claimEpoch: barcode, currentEpoch: current, phase: 'acquiring', expectedPhase: 'acquiring', locked: true }), false);
  assert.equal(canCommitDetection({ claimEpoch: liveOcr, currentEpoch: current, phase: 'ready', expectedPhase: 'ready', locked: false }), true);
});
