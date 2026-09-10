/** Slider 1. If motion equals rest, 1 is 0° (unfold). */
export function motionTarget(rest: number, motion: number): number {
	return motion === rest ? 0 : motion;
}

export function foldPose(rest: number, motion: number, t: number): number {
	return rest + (motionTarget(rest, motion) - rest) * t;
}

export function foldPoseT(rest: number, motion: number, angle: number): number {
	const target = motionTarget(rest, motion);
	const d = target - rest;
	if (Math.abs(d) < 1e-9) return 0;
	return (angle - rest) / d || 0;
}
