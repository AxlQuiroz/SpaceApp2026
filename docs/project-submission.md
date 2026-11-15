# RockieOS — project submission draft

**Challenge:** Build a Junior Astronaut Mission Trainer  
**Final project:** https://github.com/AxlQuiroz/SpaceApp2026

## High-level summary

RockieOS is a decision and resource trainer for children aged 7–12. Players operate a lunar or Martian outpost, balancing power, life support, radiation protection, food reserves and delayed communication. Every turn reveals the consequences of their choices. Before committing an action, players can compare the next turn with and without it.

## What we built

A browser interface built with Next.js and React connects to a Python/FastAPI simulation engine and a scientific-resource service. Anonymous sessions preserve missions and recover safely from interrupted requests. The Windows launcher prepares dependencies, runs checks and starts a local presentation.

Two difficulties and two destinations are available. Historical cases keep their NASA observations fixed. Varied training changes only simulated equipment faults and dust incidents. Replaying a completed or failed attempt preserves its conditions and compares resources, outcomes and decisions by turn.

## How NASA data matters

On Mars, Curiosity MSL-RAD measurements from May 20, 2024 are grouped into twelve two-hour UTC intervals. Their arithmetic means shape the game's exposure curve. Each mission saves the actual profile used, its source hash and the transformation metadata. Players see the historical date and instrument, not a claim of live habitat telemetry.

DONKI supplies historical solar-event context. CRaTER/LRO provides an orbital lunar reference. OSD-104 is presented as mouse biological research, without deriving human health coefficients. The sources screen links to original records and preserves attribution.

Power, consumption, food targets, shielding factors, health and points remain explicit educational rules. A solar event does not obscure sunlight: the lunar exercise reduces electrical output through a simulated protection mode. The Martian dust incident is simulated separately.

## Why the decisions teach something

Turning off a subsystem can save battery while reducing later supplies. Crops represent an established harvest, so players can compare a short-term energy saving with tomorrow's reserve. Research reports earn a bonus only for newly collected data. A request with no new data earns no science. The radio exercise models a chosen 20-minute one-way delay; players must act autonomously if danger arrives before a reply.

The final evaluation checks duration, health, science and food reserve, plus sharing new research on Mars. Words, short explanations, optional questions and outcome comparisons support reflection. Learning effectiveness remains a hypothesis until observed user testing is completed.

## Data and references

- NASA CCMC / DONKI: https://ccmc.gsfc.nasa.gov/tools/DONKI/
- NASA OSDR / RadLab: https://visualization.osdr.nasa.gov/radlab/
- NASA OSDR / OSD-104: https://osdr.nasa.gov/bio/repo/data/studies/OSD-104
- NASA/JPL radio delay: https://science.nasa.gov/blog/speaking-percys-language-how-to-talk-so-perseverance-will-listen/
- NASA space-weather effects: https://science.nasa.gov/sun/solar-storms-and-flares/
- Dataset query URLs and SHA-256 values: resource-api snapshot manifest and each mission's `/science` response.

## AI disclosure

ChatGPT/Codex assisted with architecture, implementation, review, documentation and testing. Claude assisted with earlier development and interface work, as recorded in the repository history. The team remains responsible for reviewing the code, data interpretation and scientific claims. See [CREDITS.md](../CREDITS.md). NASA does not endorse this project.

## Demo script — keep the final video below 30 seconds

| Time | Screen | Message |
| --- | --- | --- |
| 0–4 s | Outpost and crew | “Can you keep a crew alive beyond Earth?” |
| 4–11 s | Toggle and forecast | “Save power now—or keep producing supplies for tomorrow.” |
| 11–19 s | Mars radiation and shelter | “Real Curiosity readings shape the challenge. Your shelter decision changes the outcome.” |
| 19–25 s | Outcome comparison | “Try again with the same conditions and learn what your decisions changed.” |
| 25–29 s | Name and source credits | “RockieOS. Real data, meaningful decisions.” |

An alternative presentation can use seven slides: problem, audience, decision loop, NASA data, trade-off example, working prototype and evidence/next steps. Do not describe planned user studies as completed.

## Final handoff fields

The team must attach the real demo link, verify reviewer access to the final project, complete team/member information, review the current submission guide and submit through its NASA team page. Those external actions are not performed by editing this repository. A public repository is supplied above; a deployed browser URL should be added only after that deployment has been tested.
