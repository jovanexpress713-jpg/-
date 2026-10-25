# EJAZ Transport — Photo-First Mode

## Current product mode

The fleet command center is intentionally photo-first until official 3D vehicle assets are supplied.

- Official vehicle photographs remain the primary visual asset.
- Operational indicators remain interactive: speed, fuel, recorded load, remaining capacity, ETA, engine temperature, route progress, fleet filters, and attention state.
- Payload visualization is based on saved vehicle fields and is explicitly not live sensor or weighbridge telemetry.
- 3D/AR assets are deferred rather than simulated or fabricated.

## Vehicle assets

The project already contains official photographs for the four operational body categories:

- curtainsider
- dry van
- refrigerated
- flatbed

The future eight 3D models can be attached to the existing asset registry when the actual GLB/glTF files are supplied. No placeholder model is treated as an official asset.

## Acceptance rule

A supplied 3D asset becomes active only after the file is present, its format is validated, its registry entry is created, and the viewer/build tests pass. Until then, the photo remains the authoritative visual fallback.
