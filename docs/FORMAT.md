# `.tan` format (version 1)

A Tan Lines document is YAML. Units are millimetres. 2D origin is the top-left of each piece: +X right, +Y down. 3D: +Z out of the front face.

Point an agent at this file and an example in `examples/`.

## Document

```yaml
version: 1
unit: mm
defaults:
  leather: veg-tan
  thickness: 2
  stitch:
    inset: 3.5
    spacing: 3.5
    hole: 1
    style: saddle
    color: '#e8d4a0'
leathers:
  veg-tan:
    front: { roughness: 0.35, grain: fine }
    back: { roughness: 0.8, grain: suede }
    color: '#6b3a2a'
pieces: []
layout:
  paper: A4 # A3 | A4 | A5 | { w: 210, h: 297 }
  margin: 10
  placements:
    - piece: body
      x: 10
      y: 10
      rotate: 0 # degrees; no flip on the sheet
assembly: []
```

`leathers` is in this file. Built-in name: `veg-tan` (overridable).

## Piece

```yaml
- id: body
  side: front # front | back
  leather: veg-tan
  transform: { x: 0, y: 0, rotate: 0, flip: none } # none | x | y
  outline: { rect: { w: 90, h: 70, r: 6 } }
  holes:
    - rect: { x: 8, y: 8, w: 74, h: 20, r: 2 }
  stitch:
    - along: outline
      inset: 3.5
      spacing: 3.5
      start: 0
      skip: []
  folds:
    - id: spine
      from: [0, 35]
      to: [90, 35]
      angle: 0
      hinge: valley # valley | mountain
  hardware: []
  motion:
    - id: spine
      folds: { spine: 90 }
```

Several pieces in one document. `layout.placements` puts them on the same sheet. The editor shows the whole file in one textarea; a piece list highlights on the sheet. Isolating one piece’s YAML in the textarea is later.

`transform` is the piece’s design pose (including flip for the back). Sheet placement does not flip.

## Shapes

One closed outline per piece. Holes use the same kinds and are cut out.

**rect** — `x? y? w h` plus `r` and/or `chamfer` (1–4 values, CSS order: TL TR BR BL). `r` is circular rounding. `chamfer` is a 45° cut of that length along each adjacent edge. If both are set on a corner, `r` wins when r > 0.

**ellipse** — `cx? cy? rx ry`. Default center `(rx, ry)` so the box is `0,0`–`2rx,2ry`. Circle when `rx = ry`.

**path** — `d` (SVG subset: M L C Q A Z) or `pts` (`[x, y]` vertices; optional per-vertex `r` or `chamfer`).

## Stitch

A rule, not a list of holes. `along` is `outline` or a hole index later.

1. Inset the target path by `inset` mm (inside the leather).
2. Walk that curve, placing a hole every `spacing` mm, starting at `start` mm. Stop before overlapping the first hole.
3. Each hole is a circle of diameter `hole`.

`skip` is ranges `[from, to]` mm along the inset path left unpunched.

`style` is `saddle` (default), `running`, or `box`. Saddle puts a stitch in every gap on both faces. Running alternates faces. Box pairs consecutive holes (even gaps on both faces, odd gaps empty). `defaults.stitch.color` is the waxed thread in the 2D sheet and 3D (default `#e8d4a0`). Punch circles stay dark. Where a run crosses an interior fold the thread follows the outer wrap.

## Folds, hardware, motion, assembly

Fold `angle` is the rest pose in degrees. An interior fold splits the piece; a fold on the outline is a join edge (no split). Valley hinges sit on the back face (thickness allowance); mountain on the front. The outer face wraps on a radius of `thickness` so the fold corner is round.

Motion is a named map of fold id → angle. One motion per hinge for now; the 3D slider blends rest → that angle (0 = rest, 1 = motion). Hardware is `{ type: snap|rivet|button|stamp, at: [x, y], size? }`. Defaults: snap 10 mm, rivet 4, button 8, stamp 12. Piece-local 2D; 3D sits on the panel that owns `at`.

`assembly` joins two named folds, qualified as `pieceId.foldId`:

```yaml
assembly:
  - a: body.lip
    b: flap.lip
```

Empty `assembly` leaves each piece standalone in the assembly view.

## Paper

| name | mm        |
| ---- | --------- |
| A5   | 148 × 210 |
| A4   | 210 × 297 |
| A3   | 297 × 420 |

Print is PDF, 1 user unit = 1 mm, page = paper size, plus a 50 mm calibration bar. Export SVG with `width`/`height` in mm.
