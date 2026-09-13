// Minimal document for New: one rectangle, one hole, one stitch rule.
export const starterText = `pieces:
  - id: piece
    outline:
      rect: { w: 100, h: 60, r: 6 }
    holes:
      - ellipse: { cx: 50, cy: 30, rx: 4, ry: 4 }
    stitch:
      - along: outline

layout:
  paper: A4
  margin: 10
  placements:
    - piece: piece
      x: 10
      y: 10
`;
