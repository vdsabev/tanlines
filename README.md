# Tan Lines

Leather pattern editor. Type YAML (`.tan`), preview 1:1 mm on a sheet, export SVG/PDF.

Spec: `docs/FORMAT.md`. Example: `public/examples/cardholder.tan`.

Share a pattern: append `?src=<encoded-url>`; the example dropdown links there too.

```
bun install
bun run dev
bun test
```

Print the PDF at **Actual size / 100%**. Check the 50 mm bar with a ruler.

## Roadmap

- Drag/rotate pieces on the 2D sheet so `layout.placements` is written back from the preview. YAML placements already compile and print.
- Mark the bad line when YAML fails. Invalid input already keeps the last good scene.
- Piece list that highlights on the sheet. Isolating one piece’s YAML in the editor is later (`docs/FORMAT.md`).
- Stitch `count` / `count: auto` (`round(L / spacing)`). Rules are spacing-only today; the last gap can be larger than `spacing`.
- Stitch `along` a named path. `outline` and hole index work.
- Extra length on the 2D pattern at a fold. 3D already offsets the hinge by thickness.
- Leather `grain` / `roughness` as textures, not material numbers.
- `flip: x | y` as a back-texture turn in 3D. Parsed and stored.
- Confirm a printed PDF against a ruler (phase 2 “done when”).
- `src/view2d/` (empty) and a separate `schema.ts` (schema lives in `parse.ts`).
- More example `.tan` files (drop them in `public/examples/` and list them in `App.vue`); tests cover geometry, `public/examples/` holds cardholder, bookmark, and foldcard.

Out of v1: nested print packing UI, URL-encoded documents, component/E2E tests, timeline animation (motion is sliders).
