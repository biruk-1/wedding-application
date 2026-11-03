# Adaptive Ethiopian wedding themes

Kiburan’s visual identity follows the celebration’s **`weddings.style`** field (`modern` | `traditional` | `blend`). No separate theme column is required. All eight celebration kinds use these same style palettes.

## Themes

| Style (DB) | Theme | Primary surface | Gold accent | Green accent |
| --- | --- | --- | --- | --- |
| `modern` | Modern Ethiopian | `#F8F5EF` | `#C6A064` | `#315B48` |
| `traditional` | Traditional Ethiopian | `#F3E8D5` | `#C69A45` | `#244B37` |
| `blend` | Ethiopian Fusion | `#F8F5EF` | `#C6A064` | `#315B48` |

Traditional also uses burgundy `#762F3D` and terracotta `#A85C3D` sparingly in decorative treatments (not large UI fills).

## Architecture

- **`src/theme/palettes.ts`** — palette + decoration tokens per style.
- **`src/theme/WeddingThemeContext.tsx`** — resolves style from route `weddingId` + cached memberships; supports `previewStyle` during create-wedding onboarding.
- **`useColors()` / `useDecorations()`** — use in UI instead of static `@/theme/colors` imports.
- **`ThemeBackdrop` / `TibebMotif`** — lightweight backdrop geometry (no heavy image patterns behind forms).
- **`src/features/weddings/celebrationsConfig.ts`** — event-aware onboarding and non-wedding dashboard imagery.

## Changing style

- **Onboarding:** Create wedding → Details → Wedding style.
- **Settings:** Wedding → More → Settings → **Wedding appearance** (writers/owners only). Updates `weddings.style` via Supabase RLS.

## Persistence

Style is stored on the wedding row and reloaded through React Query memberships / wedding detail on app restart.

## Future (not in schema)

- Regional or community-specific preferences beyond the three starting directions.
- User-selected `cover_image_url` hero (field exists; UI uses bundled style/event photography).

## Limitations

- System light/dark mode is still not offered.
- Auth/welcome screens use the active wedding’s theme when signed in; otherwise Modern Ethiopian default.
- Internal wedding theme, table, and route names remain for compatibility.
- Shemgelena and Qelekel reuse the approved traditional/fusion photography pending ceremony-specific licensed assets.

Image sources and license notes are maintained in `assets/images/ATTRIBUTION.md`.
