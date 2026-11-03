# UI audit (pre–UI refinement)

Reference: approved eight-screen Kiburan mock (welcome, onboarding, home, checklist, vendors, guests, guest detail, budget).

## Strengths already in code

- Cormorant Garamond + DM Sans pairing and ivory surface tokens
- Welcome screen aligned with full-bleed hero and gold CTA
- Wedding creation flow with step indicator and style cards
- Shared `Button`, `TextField`, `Card`, `Header`, skeletons

## Gaps vs reference (addressed in this milestone)

| Area | Issue |
| --- | --- |
| Typography color | Body text used forest green instead of charcoal |
| Buttons | Secondary actions looked like green outline links; no compact/outline variants |
| Dates/times | Plain `YYYY-MM-DD` / `HH:MM` text fields everywhere |
| Home dashboard | Stack of cards instead of hero, countdown bar, shortcut grid, upcoming tasks |
| Navigation | No bottom tab bar on primary wedding screens |
| Search | Duplicated raw `TextInput` styling in filter bars |
| Vendors | Vertical photo cards vs reference horizontal “View profile” rows |
| Focus states | Inputs used green focus ring instead of champagne gold |

## Out of scope (documented)

- Checklist **category** landing (app uses task list + filters; same data, different layout)
- Vendor **favorite** hearts (no favorites API)
- Guest detail **stepper/tags** polish partially limited by existing form fields
- Native tab navigator file move (custom tab bar preserves deep links)
