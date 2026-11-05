# Theme environment assets

Rebuild with `node scripts/build-theme-assets.mjs`. All files are stored locally; nothing is
loaded from the network at runtime.

## Photography

Chosen to follow the Kiburan reference mockup (Modern floral/contemporary couple,
Traditional Habesha ceremony + warm cultural interior, Fusion cream reception hall)
while staying on verified licensed sources.

| File | Source | License | Verified context |
| --- | --- | --- | --- |
| `traditional/wedding-images/hero.jpg`, `preview.jpg`, `portrait.jpg` | [Abel Abera / Pexels 34498421](https://www.pexels.com/photo/ethiopian-wedding-in-front-of-cathedral-34498421/) | Pexels License | Ethiopian bride and groom in traditional embroidered white attire, Addis Ababa. Used for dashboard / Discover heroes. |
| `traditional/wedding-images/atmosphere.jpg` | [nard get / Pexels 18765288](https://www.pexels.com/photo/smoke-in-hall-18765288/) | Pexels License | Traditional Ethiopian restaurant / coffee-ceremony interior in Addis Ababa. Warm wood, woven thatch and incense — used as the soft Traditional background wash (matches the reference's cultural interior atmosphere). |
| `modern/wedding-images/hero.jpg`, `preview.jpg`, `atmosphere.jpg` | [OneStop Productions / Unsplash D4I92c-Usvg](https://unsplash.com/photos/D4I92c-Usvg) | Unsplash License | Couple at sunset by OneStop Productions, an Addis Ababa (Ring Road, Bole) wedding studio. Atmosphere is derived from the same local hero. |
| `fusion/wedding-images/hero.jpg`, `preview.jpg`, `atmosphere.jpg` | [Pexels 2306281](https://www.pexels.com/photo/elegant-wedding-reception-table-setting-2306281/) | Pexels License | Cream reception hall with tall florals — matches the Fusion column of the reference (modern venue). Cultural identity for Fusion still comes from tibeb / wine UI accents layered on top. |

Rejected candidates: festival / Ashenda / Meskel / flag processions / generic African attire
that is not Ethiopian wedding context. The previous Fusion bridal-sandal detail and any
Western-only stock that did not match the reference columns were replaced.

## Textures (procedurally generated, original)

| File | Reference |
| --- | --- |
| `traditional/textures/shamma-weave.png` | Plain weave of hand-loomed Ethiopian cotton (shamma / netela). |
| `fusion/textures/linen.png` | Finer, quieter weave so selective accents carry the identity. |
| `modern/textures/paper-grain.png` | Near-invisible grain under the Modern gradient. |

## Decorations (vector, `src/components/theme/ornaments`)

The tibeb bands are original geometric compositions (stepped lozenges, zig-zag rows and
parallel rules) modelled on the structure of tibeb: a handwoven supplementary-weft border
placed at the edges of white cotton cloth. Reference: Powerhouse Collection object 8506,
"Embroidered Habesha kemis and netela from Ethiopia, 1960s"
(<https://collection.powerhouse.com.au/object/8506>).

Deliberately excluded: cross motifs and other religious symbols as generic decoration,
the national flag, and pan-African or non-Ethiopian textile patterns. Patterns appear
only at edges and dividers, never behind body text.
