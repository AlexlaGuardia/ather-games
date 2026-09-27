# Rune Hold Townsfolk — Draft Lines (Lark, for Alex sign-off)

> Draft only. Not wired into the build. Register: cozy/mortal-seam, plain and short, **no em dashes** (per dispatch).
> Roles are never named — role-keeper tags below (LOCAL, TRAVELER, APPRENTICE, INNKEEPER, SMITH, BOOKSTORE KEEPER,
> BOARD KEEPER, CLERK) are build-facing labels, not in-game names; nothing is shown to the player as that word.
> Named regulars (Renna, Dorik, Brenn, Mabry) are canon (`world/rune-hold.md` › The Kindled Mug, The Regulars' Week).
> Week days are the ruled five: Solday, Coomday, E'xday, Niteday, Floday (`world/calendar.md`). No Earth weekdays,
> no Earth animal/plant nouns, no "gate" for in-Ather travel (n/a here — mortal town only).

---

## 1. Ambient barks (unnamed, heard walking past)

### A local
[trigger: bark:local, unnamed townsperson, ambient on the square/streets]
- LOCAL: Mind the step there. The frost got into the stone again.
- LOCAL: Smells like bread today. Someone's oven finally caught.
- LOCAL: Roads were quiet this morning. That never lasts past highsun.
- LOCAL: Another cart in from the east. Word travels faster than the wheels.

### A traveler bound for the Station (with luggage)
[trigger: bark:traveler_station, unnamed traveler, ambient near the road/Station approach]
- TRAVELER: Ship's this way, I hope. I am not carrying this pack twice.
- TRAVELER: One more crossing and I am home. Or somewhere new. We'll see.
- TRAVELER: Is the Station far? My arms have an opinion about that.
- TRAVELER: Rune Hold's a fine place to leave from. Most towns aren't.

### The smith's apprentice
[trigger: bark:apprentice, unnamed apprentice, ambient near the forge/smithy streets]
- APPRENTICE: Careful, that's still hot. Everything here is still hot.
- APPRENTICE: Master says my hands will toughen up. Still waiting on that.
- APPRENTICE: Another day, another burn I'll pretend I meant to get.
- APPRENTICE: The forge never sleeps. Some weeks, neither do I.

---

## 2. Role keepers (greeting, keeper stops near them)

### The innkeeper (Forgelight Inn) — knows everyone's business, says nothing
[trigger: greet:innkeeper, keeper approaches the innkeeper]
- INNKEEPER: Room's ready when you are. Everything else stays with me.
- INNKEEPER: Clean sheets, fair price, no questions. That's the whole trade.
- INNKEEPER: Sleep well. Whatever you did before you got here is your business.
- INNKEEPER: I hear plenty in this town. All of it stays behind the counter.

### The smith (front-keeper, the town forge)
[trigger: greet:smith, keeper approaches the smith at the forge-front]
- SMITH: Need something forged, or just warming your hands?
- SMITH: Good metal, fair price. Ask twice if you don't believe me.
- SMITH: Mind the sparks. I don't charge for burns, but I don't apologize either.
- SMITH: Rune Hold runs on what I make. Has done longer than I have.

### The Bookstore's keeper
[trigger: greet:bookstore_keeper, keeper approaches the counter at Eyuun's Bookstore]
- BOOKSTORE KEEPER: Quiet in here. That's rather the point of the place.
- BOOKSTORE KEEPER: Every tale on this shelf was somebody's true one, once.
- BOOKSTORE KEEPER: Take your time. The stories aren't going anywhere.
- BOOKSTORE KEEPER: Eyuun's name is on the door. Mind you keep the quiet for him.

### Whoever tends the Notice Board
[trigger: greet:board_keeper, keeper approaches the Notice Board]
- BOARD KEEPER: Fresh notice, if you're after work or a way home.
- BOARD KEEPER: Half of this board's true. I try to keep it the good half.
- BOARD KEEPER: Pin it, post it, or just ask me. I read faster than you.
- BOARD KEEPER: The roads bring news here first. I just get to hang it up.

### The Station clerk
[trigger: greet:station_clerk, keeper approaches the clerk's window at the Travelers Station]
- CLERK: Manifest's this way. Berth number's on your ticket.
- CLERK: Passage or trade? Different line, same window.
- CLERK: Ship's loading. Don't dawdle, and don't run either.
- CLERK: Everyone leaves through here eventually. Some come back.

---

## 3. The regulars, by where the week puts them

> Mabry never leaves the table — no outdoor lines for Mabry. Mabry's table lines belong with the Mug's existing
> Magii-table dialogue, not this draft.

### Renna — the square, Solday
[trigger: bark:renna_square, Renna on the crossroads square, Solday]
- RENNA: Solday. Best day to do nothing and talk about it at length.
- RENNA: You look like you've got a story in you. Sit, tell the whole square.
- RENNA: Table's warm tonight, if the square gets old. Just saying.

### Renna — working the Passage crowd, E'xday
[trigger: bark:renna_passage, Renna in the Passage on market day (E'xday)]
- RENNA: E'xday. Best deals and worst decisions, and I'm behind both.
- RENNA: Don't buy the first thing you see down here. Buy the second.
- RENNA: Table's quiet without me today. Don't tell Mabry I said that.

### Dorik — home, mending, Solday
[trigger: bark:dorik_home, Dorik at his open door on the terraces, Solday]
- DORIK: Mending. Always mending. Things wear out faster than I fix them.
- DORIK: Wrong stitch. Start again.
- DORIK: Come in if you like, door's open. Just don't touch the thread.

### Dorik — the forge, Coomday / E'xday / Niteday
[trigger: bark:dorik_forge, Dorik working the forge]
- DORIK: Metal doesn't lie to you. People do. Metal's easier.
- DORIK: Coomday's for the hard pieces. This one's fighting me back.
- DORIK: Long night ahead. The fire doesn't care what day it is.
- DORIK: Heavy hands, they call it. Heavy hands just don't rush the work.

### Brenn — the Station, watching arrivals, Solday / Niteday
[trigger: bark:brenn_station, Brenn at the Station]
- BRENN: Ship's early. That usually means something.
- BRENN: Most people wave. I just count who's still standing there after.
- BRENN: Long shift tonight. I don't mind it. The Station talks, if you listen.

### Brenn — the Notice Board, E'xday
[trigger: bark:brenn_board, Brenn reading at the Notice Board]
- BRENN: Read it all already. You're a little behind.
- BRENN: Half these notices will matter by Floday. I know which half.
- BRENN: Don't post over mine. I haven't finished being right about it.

---

## Counts

- Total lines: 51 (12 ambient, 20 role-keeper, 19 regular: Renna 6, Dorik 7, Brenn 6).
- Longest line: "SMITH: Mind the sparks. I don't charge for burns, but I don't apologize either." (79 characters).
- All lines under ~90 characters; one sentence, occasionally two short ones.

## Canon gaps

None found blocking. One open question flagged for Jin, not Magii (build-scope, not a canon fact):

- **Is "the smith" front-keeper role the same NPC as Dorik-at-the-forge, or a second smith?** `world/rune-hold.md` ›
  *THE TOWNSFOLK* lists "the smith" as an unnamed front-keeper role in its own bullet, separate from *THE REGULARS'
  WEEK* naming Dorik's trade as a smith who works the forge three days a week. Canon doesn't say whether these are
  one person wearing two hats (Dorik mans the front-facing forge on his working days) or two different smiths (a
  role-keeper who's always there, plus Dorik who is also a smith but off doing his own thing). Both readings are
  canon-consistent — nothing here invents a fact either way, and the lines above were written so they work under
  either reading (the SMITH role lines carry no name and no personality that would clash with Dorik's card). Jin's
  call on wiring; flag to Magii only if it turns out to matter for a quest or a bond.
