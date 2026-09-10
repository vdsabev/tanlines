import { describe, expect, it } from 'bun:test';
import { foldPose, foldPoseT, motionTarget } from '../src/format/pose';

describe('foldPose', () => {
	it('holds rest at t=0 and motion at t=1', () => {
		expect(foldPose(0, 90, 0)).toBe(0);
		expect(foldPose(0, 90, 1)).toBe(90);
		expect(foldPose(90, 0, 0)).toBe(90);
		expect(foldPose(90, 0, 1)).toBe(0);
	});

	it('unfolds to 0 when motion equals rest', () => {
		expect(motionTarget(90, 90)).toBe(0);
		expect(foldPose(90, 90, 0)).toBe(90);
		expect(foldPose(90, 90, 1)).toBe(0);
		expect(foldPoseT(90, 90, 90)).toBe(0);
		expect(foldPoseT(90, 90, 0)).toBe(1);
	});
});
