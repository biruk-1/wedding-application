# Kiburan design reference

Visual source of truth: the approved multi-screen reference sheet (welcome, onboarding, dashboard, checklist, vendors, guests, budget).

## Product

Wedding planning + vendor marketplace for Ethiopia (ETB, Amharic + English, Africa/Addis_Ababa).

## Visual direction

| Element | Direction |
| --- | --- |
| Surfaces | Warm ivory / cream (`#F9F6F1`) |
| Primary | Champagne gold (`#C59D5F`) |
| Success / progress | Forest green (`#2D4F3E`) |
| Type | Serif display (Cormorant Garamond) + sans UI (DM Sans) |
| Shape | Rounded cards/inputs (~12–16), soft shadows, minimal borders |

Central tokens: `src/theme/` — see `docs/design-tokens.md` for provisional hex notes.

## Welcome screen

- Full-bleed wedding photography
- Brand wordmark **Kiburan** (serif, gold) as the hero signal
- Tagline: Plan Together / Celebrate Forever
- Primary: **Get Started** → `/create-wedding`
- Secondary: **I already have an account** → `/login`

### Gaps vs Figma / brand kit

1. Official monogram (intertwined initials in the reference) is **not** in the repo — wordmark only.
2. Hero image is **provisional** Unsplash stock at `assets/images/welcome-hero.jpg` — replace with approved photography before release.
3. Exact Figma type sizes / spacing not exported — provisional ramp in `typography.ts`.

## App structure

- Routes: `app/`
- Shared UI: `src/components/ui/`
- Layout: `src/components/layout/`
- Features: `src/features/<domain>/`
