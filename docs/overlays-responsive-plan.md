# Overlays and panels: responsive plan

Every overlay takes over the screen it opens on. You either close it or scroll past its end, and it never asks you to scroll inside a box.

| Overlay | Desktop and laptop | Tablet (iPad) | Phone | Closing |
| --- | --- | --- | --- | --- |
| **Amenities** (8 chapters) | Fixed full screen, page locked behind. Chapters crossfade full-bleed. The chapter index sits on the right. | Same, index moves under the title | Same full screen, index hidden (chapter number shows in each chapter) | ✕, Esc, or scroll past the last chapter |
| **Suite detail** (hotel and residence cards) | Side panel 560px wide, full height. The photo shrinks to make room; the details never scroll. Below 760px tall, the description line and the smart-room note drop out. | Side panel 60% wide | Bottom sheet, up to 92% height, swipe down to close (built) | ✕, Esc, click outside, swipe down (phone) |
| **Film** | Expands from its card to full screen, plays with sound | Same | Same; the phone's own full-screen player takes over on rotate | ✕ Close, Esc, click outside |
| **Menu** (phone only) | — | — | Full-screen sheet, sections plus Reserve | ✕, Esc, tapping a section |

## Rules every overlay follows
- **Size:** taken from the real screen (`--isa-vh`), never the 900px board height.
- **Page lock:** the page behind is locked while it's open and unlocked on close, and focus returns to what opened it.
- **Motion:** opening takes ≈450ms on the drawer curve; closing is faster (≈260ms).
- **Keyboard:** Tab stays inside the overlay; Esc always closes.
- **Reduced motion:** overlays appear and disappear without movement.

## Still to build
- Amenities on phone: the same takeover and crossfade as desktop. The mobile board has its own amenities overlay; it gets the same treatment.
- Suite panel on tablet: the 60% width.
- Check every overlay on a real iPhone and iPad (so far tested in resized browser windows only).
