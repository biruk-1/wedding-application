# UI refinement milestone

## Design system

- **Colors:** `colors.text` → charcoal; `colors.heading` for screen titles; gold primary CTAs; green success/save/progress
- **Buttons:** `primary`, `secondary` (cream), `outline`, `success`, `danger`, `ghost`; `size="compact"`
- **Inputs:** Shared focus accent (gold); `SearchField`, `AppDatePicker`, `AppTimePicker`
- **Navigation:** `WeddingTabBar` on home, checklist, vendors, guests, more

## Date/time picker

- **Library:** `@react-native-community/datetimepicker` (Expo SDK 58 compatible)
- **Why:** Native iOS/Android pickers with a consistent Kiburan field shell; iOS uses cancel/done sheet
- **Storage:** Still `YYYY-MM-DD` and `HH:MM` in forms; local calendar helpers in `src/lib/datetime/localDate.ts`

## Integrations

| Screen | Control |
| --- | --- |
| Create wedding | Wedding date |
| Task form | Due date |
| Event / timeline item forms | Start/end date & time |
| Record payment | Payment date |

## New / updated components

`AppDatePicker`, `AppTimePicker`, `SearchField`, `EmptyState`, `IconButton`, `WeddingTabBar`, `DashboardHero`, `FeatureShortcutGrid`, `WeddingMoreScreen`
