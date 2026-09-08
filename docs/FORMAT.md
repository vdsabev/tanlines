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
      angle: 90
      hinge: valley # valley | mountain
  hardware: []
  motion:
    - id: open
      folds: { spine: 30 }
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

## Folds, hardware, motion, assembly

Stored in v1; 3D compiles them later. Fold `angle` is degrees. Hardware: `{ type: snap|rivet|button, at: [x, y], size? }`. Motion: named sets of hinge angles. `assembly` joins pieces by fold/edge id.

## Paper

| name | mm        |
| ---- | --------- |
| A5   | 148 × 210 |
| A4   | 210 × 297 |
| A3   | 297 × 420 |

Print is PDF, 1 user unit = 1 mm, page = paper size, plus a 50 mm calibration bar. Export SVG with `width`/`height` in mm.
