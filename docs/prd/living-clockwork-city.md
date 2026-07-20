# Living Clockwork City — Product Requirements

## Vision

A miniature 3D city where the economy is physically simulated. Citizens need food, transport, housing, employment, and energy. Instead of spreadsheets, every resource is a visible object moving through the city: bread carts, water tanks, batteries, workers, waste containers, and construction materials.

The signature play moment: the player removes one road, factory, bridge, or power station and watches consequences spread through the living machine.

## Player Fantasy

You are a curious engineer poking a delicate clockwork. The city is not a spreadsheet with a 3D skin — it is a diorama whose pipes, roads, and carts *are* the economy. Cause and effect should be readable with your eyes, not a HUD dump.

## Goals

1. **Legibility first:** A new player can understand what is flowing where within 30 seconds of watching the idle city.
2. **Causal play:** Removing one piece produces a delayed, spatial cascade (shortages, backups, idle workers, dark blocks) that the player can narrate aloud.
3. **Miniature craft:** The city should feel like a hand-built tabletop machine, not an open-world sim.

## Non-Goals (v1)

- Competitive multiplayer
- Full city-builder construction from scratch as the primary loop
- Realistic physics (rigid bodies, fluid solvers) as the simulation backbone
- Procedural megacities
- Combat, narrative campaign, or RPG progression

## Core Loop (MVP)

1. Observe an idle authored district humming with visible resource tokens.
2. Select one infrastructure piece (road segment, bakery, power station, bridge).
3. Demolish it.
4. Watch shortages and backups propagate through the remaining graph.
5. Optionally restore or try another demolition to compare outcomes.

## Resource Loops (Full Vision)

| Loop | Visible tokens | Key nodes |
|------|----------------|-----------|
| Food | Bread carts, crates | Farms → bakeries → markets → homes |
| Water | Tanks, pipes | Reservoir → pumps → homes/factories |
| Energy | Batteries, cable glow | Power plant → substations → consumers |
| Labor | Worker figures | Homes → workplaces (with transit) |
| Waste | Bins, dump trucks | Consumers → dumps / recyclers |
| Construction | Timber, brick stacks | Depots → build sites |

**MVP ships Food + Energy + Labor only.** Water, waste, and construction follow once demolish-cascade readability is proven.

## Success Criteria (MVP)

- Idle city runs for 5+ minutes without soft-locking.
- At least three demolition scenarios produce visibly distinct cascades.
- A spectator can explain *why* a neighborhood went dark or hungry after watching for one minute — without reading numbers.
- Simulation logic is fully testable headless (no Three.js required for unit tests).

## Assumptions Locked for Planning

- **Platform:** Web (TypeScript + Vite + Three.js).
- **Simulation model:** Discrete token agents on a directed city graph, not continuous physics.
- **Content:** Hand-authored starter district (JSON/YAML map), not procedural generation.
- **Camera:** Orbit / isometric diorama view.
- **Interaction:** Click-to-inspect, click-to-demolish; undo restore for experimentation.
