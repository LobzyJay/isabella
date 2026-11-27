# Isabella one-pager: interaction plan

Source of truth for look, copy and layout: `design/T-V4-Home.dc.html` (Concept A).
This plan only changes **behaviour**. Every colour, type size and spacing stays as on the board.

Status key: **Works**: fine as exported. **Fix**: exists but behaves badly. **Missing**: the design promises it but nothing happens.

---

## 0. How we get there

Today the site runs the design export as-is (its own runtime in `public/support.js`). That's why it matches the board, but the behaviour can't be changed without editing generated markup.

**Step 0:** convert the page into real components (one per section) with a script, keeping every inline style value. Then each item below is a small, isolated change, and the 3D hero later swaps into one component.

Shared rules for every section:
- **Scroll:** the page scroll drives every pinned sequence. No scroll-inside boxes; the board's chips all say "live: page scroll drives it".
- **Anchors:** header links scroll smoothly and land below the 104px sticky header.
- **Keyboard:** everything you can click you can reach with Tab, open with Enter or Space, and close with Esc. There's a visible gold focus ring (`#F4B03E`, 2px, offset 3px).
- **Touch:** nothing relies on hover alone. A tap does what a hover shows, or opens the detail directly.
- **Reduced motion:** pinned sequences show their final frame and fades replace movement.
- **Timing:** reveals take 0.4–0.6s on `cubic-bezier(.2,.7,.2,1)`, with a stagger of 60–80ms.

---

## 1. Loader: Works
Gold ring fills around the seal, which then shrinks into the header logo.
- Keep it. Tie the ring to real loading (fonts + hero images, later the 3D model) with a 1.2s minimum so it never flashes.

## 2. Header: Fix
Sticky, with a blurred dark backing that fades in over the first 160px.
- Add an **active section** state: the gold underline sits under Residences or Amenities while you're in that section.
- **Reserve a Unit** scrolls to the reserve section and puts focus on the first form field.
- The logo scrolls back to the top.

## 3. Hero, "into the building": Fix (becomes the 3D slot)
Today you scroll **inside** the hero box, so the page feels stuck until the inner box runs out.
- **Change:** pin the hero to the page and let page scroll drive the same timeline (T1 70 → T2 930 → T3 3030 → T4 3330). The timing, callouts and settled frame stay exactly as on the board.
- **Hero buttons:** your brief says one button only. The board still has **See the building**; I'll drop it unless you want it kept.
- Later the 3D tower replaces the image stack here. The timeline, callouts and copy stay.

## 4. From Florence to Lagos: Missing
**Read her story +** does nothing.
- **Plan:** it opens the story **in place**. The card grows downward, the extra paragraphs fade in, and "+" turns to "−". It doesn't jump you to another section.

## 5. Pioneer suites, "Fifty seals. Fifty Names.": Fix
Fifty seals sit in a static grid.
- **On entering:** the seals stamp in row by row (scale 1.1 → 1, opacity 0 → 1, staggered).
- **Sealed vs open:** seals already taken show filled; open ones are outlined. This drives **Few places left** (e.g. "7 of 50 left") from one number in config.
- **Hover or tap a seal:** a small label shows "Pioneer 07 · sealed" or "Open · reserve this seal". Tapping an open seal goes to the reserve form.

## 6. The handover (#invitation): Fix
Today it's a scroll-inside box: the seal zooms out, the hands photo appears, then the six bento tiles rise in.
- **Change:** pin it to the page and drive the same CSS keyframes from page scroll. Every keyframe percentage stays the board's.
- **Tiles:** the amenity tile's **See every amenity →** opens the amenities overlay (section 7), and **Reserve a Unit** goes to the form.

## 7. Amenities: Fix
Four cards plus **View all amenities →**, which opens the eight-chapter story over the section.
- **Change (from the board's chip):** the overlay opens **fixed, full screen** and locks the page scroll behind it. It has a close button, Esc closes it, and focus returns to the button that opened it.
- **Clicking one of the four cards** opens the overlay **at that chapter** (aquarium, sky pool, spa or dining), not at the start.
- The chapter index (I–VIII) on the side is clickable and jumps to that chapter.

## 8. Residences, hotel and residence cards: Fix (the one you flagged)

**What's wrong today**
1. **Hover replaces the card.** A dark panel slides over the whole card, so the name, size and price you were comparing disappear.
2. **Two photos fire at once.** The room photo and a second photo fade in together, so you mostly see one image dropping over another.
3. **Residence cards switch palette.** The cards are cream (`#F4ECDB`), but the panel that covers them is maroon (`#5C1A1A`), so it reads as a different component.
4. **Bad crop.** The photo strip is a fixed 180px tall. On the wide residence cards that crops the room to a sliver.
5. **On touch, a tap just "sticks" the hover.** There's no real open or close, and **Reserve →** goes to `#` without picking the unit.

**New interaction**
- **At rest:** the card is unchanged from the board (number, tag, name, type, size, price).
- **Hover or keyboard focus (desktop):** the card keeps all its text. A photo band opens at the top of the card, growing from the top edge down to about 45% of the card's height. The summary moves down to make room, with the price still pinned at the bottom. The card lifts 6px with the board's shadow. Hotel cards keep their maroon, residence cards keep their cream, and the text colours don't change.
- **Click or tap: open a detail view** (recommended: a panel sliding in from the right, 560px wide, over a dimmed page). It holds:
  - the full photo, with the second photo as a two-step gallery (dots plus arrows, swipe on touch);
  - name, type, size and price, and the description line from the board;
  - a short "What's included" list (managed and let for you vs. a private home with its own arrival);
  - **Reserve this suite →**, which closes the panel, scrolls to the reserve section and selects this unit in the list (Medici Classic → 01 Studio … Crown of Medici → 05 Penthouse).
- **Closing the panel:** Esc, the close button or a click on the dimmed page. Focus returns to the card.
- **Touch:** a tap opens the panel directly, with no half-hover state.
- **Alternative if you'd rather not have a panel:** the clicked card expands in place to span the row and shows the gallery inside. It needs no layer on top, but it pushes the other cards around.

## 9. Where she Stands (Victoria Island map): Missing
The copy says **Tap a place to open its detail →**, but nothing is clickable.
- **Plan:** three gold pins on the map (Ikoyi 7 min, Eko Atlantic City 5 min, the airport 10 min). The pins are also the list on the left.
- **Hover a place:** its pin pulses and a thin gold route draws from Isabella to it.
- **Click a place:** a small card opens on the map with the place's name, drive time and one line of detail, plus prev/next to step through the places.

## 10. House of Sujimoto, "seal opens on scroll": Fix
A scroll-inside box: the coin seal scales away and a cream iris opens onto the developer intro.
- **Change:** drive it from page scroll, keeping the board's keyframes.
- **The Sujimoto line (Medici → Isabella):** a horizontal timeline. You can drag it on desktop, scroll it with the trackpad and swipe it on touch, with arrow buttons too. Each tower card shows its status tag (Delivered, In development, Completed 2026, Now, private pre-launch) and lifts on hover. Isabella sits last and is highlighted.

## 11. Letter, "To the First Fifty": Fix
The whole letter is a single link, so it's one huge click target with nowhere to go.
- **Plan:** make it plain content and reveal it line by line on entering. The signature draws in last.

## 12. The site film: Missing
A muted loop with **Watch the film · 0:45** that does nothing.
- **Plan:** clicking opens a full-screen player with sound, controls and captions. Esc closes it, and the loop pauses behind it.

## 13. Reserve, "Choose your residence": Works, with gaps
The view toggle, unit list, +/− stepper, total and "You are" chips all work.
- **Make the floor-plan pins clickable:** clicking a pin selects that unit in the list, and selecting in the list highlights the pin.
- **Form:** fields need labels and validation (name, and a phone or WhatsApp number). Submitting shows a sending state, then a success message in place.
- **Where submissions go:** WhatsApp (a pre-filled message with the unit, quantity and total) and/or email. **You choose.**
- **Arriving from a card or seal:** the unit is already selected and the name field has focus.

## 14. FAQ: Works
Topic tabs, question list, prev/next.
- Add left/right arrow keys across the tabs and up/down across the questions. A link can open a specific question, e.g. `#faq/payment-plan`.

## 15. Footer: Fix
- The social links and **Reserve on WhatsApp** point to `#`. They need real URLs (**you supply them**).

---

## Decisions I need from you
1. **Residence and hotel card click:** a side panel (recommended) or expand in place?
2. **Hero:** drop **See the building** (your brief) or keep it (the board)?
3. **Reserve form:** send to WhatsApp, email, or both?
4. **Pioneer seals:** how many of the fifty are taken right now?

## Order of work
1. Step 0: turn the export into components; visually identical, checked against the zip.
2. Page-scroll pinning: hero, handover, House of Sujimoto (these change the whole feel).
3. Residence and hotel cards plus the detail panel, wired to the reserve form.
4. Amenities overlay as full screen, opening at a chapter.
5. Map, film player and the "Read her story" expand.
6. Seals, timeline drag, header active state, form sending, FAQ keys.
7. The 3D hero drops into section 3 when the model is ready.
