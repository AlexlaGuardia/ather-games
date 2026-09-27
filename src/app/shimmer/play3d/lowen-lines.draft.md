# Lowen — the Passage caravan (DRAFT, for Alex sign-off)

> Written by Lark (game-writing agent), against `world/manamals.md` › *★ Adoption — Lowen's caravan*
> (RULED 2026-09-27) and its glossary entry (`glossary.md` › **Lowen**). Not wired. Not committed.
>
> **Canon obeyed:** Lowen is an Alkin, keeps the caravan, says almost nothing, speaks only once an
> animal has stayed. Adoption gives the keeper the animal; the bond (watched → followed → chosen)
> is still the animal's choice and comes later, separately. Marks pay for care, never for the
> animal. Roster for now: **Dustwhisker** (stray) and **Sporeling** (stray or quiet one) — the only
> two species Jin has live. One adoption per keeper per month. The wagon runs the Passage, the
> caravan's own ground even though the Passage sits under Rune Hold — Lowen is Lowen on both
> sides of the tunnel, same as Greg is Greg on both sides of his door. Register: cozy-side, warm,
> plain, dry. **No em dashes, no semicolons.** Vocabulary checked against `glossary.md`: Marks (not
> "coin" generically), no "gate" for travel, no "cache" (this isn't loot). Nothing here names a new
> place, fact, or mechanic — only delivery.
>
> **Canon gaps found while drafting** — none blocking. Two open questions flagged below under
> *Gaps* are Jin's tuning calls per the ruling ("cadence, roster size, care costs, achievements"),
> not canon gaps, so I did not invent numbers or names to fill them.

---

## 1. Before anything stays — NOTHING spoken

Confirmed as the design: **Lowen says nothing at all** while the animal decides. He is not silent
*to* the player — he is silent because the moment isn't his. Any beat here belongs to the animal's
approach (engine-rendered) and the player's own choice to stand still or reach out.

One optional non-verbal stage note, for whichever pass needs a beat marker in an otherwise-empty
scene:

```
[trigger: passage:lowen:wait | keeper stands at the wagon step, no animal has come yet]
[SCENE: Lowen sits on the step with his hands loose in his lap. He does not look at the keeper. He watches the wagon.]
```

```
[trigger: passage:lowen:approach | an animal breaks from the wagon and crosses toward the keeper]
[SCENE: Lowen's eyes follow it. He still says nothing.]
```

No spoken line in this slot. Do not give Lowen a line here even a short one — the design is that
his voice is the reward, not the wait.

---

## 2. When one has stayed — a stray

*[trigger: passage:lowen:stay-stray-dustwhisker]*
```
[SCENE: The Dustwhisker stops. Doesn't bolt. Sits down at the keeper's boot and stays there.]
LOWEN: Huh. Didn't run.
LOWEN: That's the whole test. Yours, if you want it.
```
(2 lines, longest 24 chars)

*[trigger: passage:lowen:stay-stray-dustwhisker-alt]*
```
LOWEN: Well now.
LOWEN: Nobody taught it that. It just stayed.
```
(2 lines, longest 44 chars)

*[trigger: passage:lowen:stay-stray-sporeling]*
```
[SCENE: The Sporeling stops rolling and leans its small cap toward the keeper, waiting.]
LOWEN: It's asking. Sporelings always ask first.
LOWEN: Go on. Answer it.
```
(2 lines, longest 47 chars)

*[trigger: passage:lowen:stay-stray-sporeling-alt]*
```
LOWEN: There. That's a yes, from it.
LOWEN: Rare, from anything that quiet.
```
(2 lines, longest 34 chars)

---

## 3. When one has stayed — a quiet one (tenderest beat, spare)

> Keep these the shortest lines in the whole set. A quiet one is a Mana'mal whose Alkin died and
> has gone silent, sometimes for years. Lowen doesn't explain that — he never lectures the
> mechanic. He just marks that this one is different, and lets it be enough.

*[trigger: passage:lowen:stay-quiet-dustwhisker]*
```
[SCENE: The Dustwhisker crosses slow, ears low, and presses against the keeper's leg like it forgot it could.]
LOWEN: Been quiet a long while, that one.
LOWEN: Not anymore.
```
(2 lines, longest 30 chars)

*[trigger: passage:lowen:stay-quiet-dustwhisker-alt]*
```
LOWEN: Hm. Didn't think it had that in it.
LOWEN: Good.
```
(2 lines, longest 38 chars)

*[trigger: passage:lowen:stay-quiet-sporeling]*
```
[SCENE: The Sporeling has ridden three towns without lifting its cap. It lifts it now.]
LOWEN: First time I've heard it, this trip.
LOWEN: Take it home.
```
(2 lines, longest 40 chars)

*[trigger: passage:lowen:stay-quiet-sporeling-alt]*
```
LOWEN: That's a long quiet, ending.
LOWEN: Go easy with it.
```
(2 lines, longest 33 chars)

---

## 4. Taking them home (after the keeper accepts and pays the care)

*[trigger: passage:lowen:accept-pay]*
```
LOWEN: Care's not free. Marks cover feed and the road, not the animal.
[SCENE: The keeper counts out Marks. Lowen takes them without counting them back.]
LOWEN: Take it home. Feed it before you feed yourself.
```
(2 lines, longest 68 chars)

*[trigger: passage:lowen:accept-pay-alt1]*
```
LOWEN: This much for the trouble. The animal was never for sale.
LOWEN: Go on, then.
```
(2 lines, longest 60 chars)

*[trigger: passage:lowen:accept-pay-alt2]*
```
LOWEN: Marks for its keep. Nothing more owed, either way.
LOWEN: It's yours now. Whether it stays yours is up to it.
```
(2 lines, longest 56 chars)

---

## 5. "Not today" (the keeper declines)

*[trigger: passage:lowen:decline]*
```
LOWEN: Not today, then.
LOWEN: Wagon comes back next month.
```
(2 lines, longest 22 chars)

*[trigger: passage:lowen:decline-alt1]*
```
LOWEN: Fair enough. Not every day's the day.
```
(1 line, 42 chars)

*[trigger: passage:lowen:decline-alt2]*
```
LOWEN: No trouble. It'll ride on to the next town.
```
(1 line, 49 chars)

---

## 6. Already took one home this month (returning keeper)

*[trigger: passage:lowen:already-adopted]*
```
LOWEN: You've got yours this month.
LOWEN: One's plenty to look after. Next month.
```
(2 lines, longest 44 chars)

*[trigger: passage:lowen:already-adopted-alt1]*
```
LOWEN: One a month. Yours is home already.
```
(1 line, 41 chars)

*[trigger: passage:lowen:already-adopted-alt2]*
```
LOWEN: Come back when the wagon does. You're full up.
```
(1 line, 51 chars)

---

## 7. Wagon closed / out of the month's week

> Treated as a sign on the wagon per the brief, since Lowen isn't necessarily present to speak it.
> Kept short enough to double as a spoken line if Jin prefers Lowen to say it instead.

*[trigger: passage:wagon-closed:sign]*
```
[SIGN: GONE ON. BACK FIRST WEEK.]
```
(1 line, 24 chars)

*[trigger: passage:wagon-closed:sign-alt1]*
```
[SIGN: NOT HERE. FIRST WEEK, EVERY MONTH.]
```
(1 line, 42 chars)

*[trigger: passage:wagon-closed:spoken]*
*(if Lowen himself is standing there, wagon empty, off-cadence)*
```
LOWEN: Wrong week. First week's the wagon's.
```
(1 line, 43 chars)

---

## Counts

- Total spoken LOWEN lines: 30 (across all slots and variants, including the spoken-alt for slot 7)
- Scene boxes: 6
- Sign text: 2
- Longest single line: **"Care's not free. Marks cover feed and the road, not the animal."** (68 chars, slot 4)
- All lines ≤ 80 chars. No em dashes. No semicolons. No Earth-animal nouns (Dustwhisker, Sporeling
  named per canon; no "rabbit," no "mushroom" used as a noun for Sporeling — described by shape only:
  "cap," "rolling").

## Gaps (Jin's tuning, not canon gaps — flagged per the ruling's own boundary line)

- Whether Lowen ever names the animal's *species-name-as-word* to the player in the same breath as
  the stay-line, or whether the UI supplies the species name and Lowen never says it at all. I
  wrote his lines species-silent by default (matching "says almost nothing"), but slot 2/3 name the
  species once each for clarity in a script read — cut those words first if the build already shows
  the species name on-screen.
- Care cost (Marks amount) is unstated on purpose — Jin's number, not mine.
- Whether "quiet one" is ever flagged to the player as a distinct category before adoption (a label
  in the UI) or only shown through Lowen's stay-line, as written here. I assumed the latter, since
  the ruling calls the reveal "the tenderest beat" and a UI label would spoil it.

## Sign-off ask

For Alex: confirm the silence-first design note (slot 1), the register (plain/dry, no em dash), and
that slot 3's "quiet one" lines land soft enough without over-explaining what a quiet one is. Ready
to route corrections into `magii-voice.md` under Session Corrections, tagged **Lark**, once given.
