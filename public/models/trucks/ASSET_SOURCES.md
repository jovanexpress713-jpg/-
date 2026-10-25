# Verified Truck 3D Asset Sources

This directory is intentionally empty of binary vehicle models until the exact files are downloaded and verified. Do not register a model as official merely because a source page exists.

## Candidates reviewed

| Asset | Format | Licence | Approx. size | Source |
|---|---|---|---:|---|
| 7.5 t class box truck with roll-up door | GLB | CC0 | 5.8 MB | https://www.innerscene.com/tools/library/3d-parts/7-5-t-class-box-truck-with-roll-up-door-12baea66 |
| Dump truck | GLB | CC0 | 6.0 MB | https://www.innerscene.com/tools/library/3d-parts/dump-truck-8fbb9f8c |
| Refuse collection truck | GLB | CC0 | 8.5 MB | https://www.innerscene.com/tools/library/3d-parts/refuse-collection-truck-eeacf549 |
| Semi truck | GLB | CC0 | 3.0 MB | https://grab3d.com/models/vehicles/semi-truck/ |
| Pickup truck | GLB | CC0 | 1.5 MB | https://grab3d.com/models/vehicles/pickup-truck/ |

## Acceptance gate before adding a model

1. Download the binary GLB/GLTF from the source page.
2. Verify the licence on the source page at the time of download.
3. Verify the file is a valid glTF 2.0 asset and can be loaded by the project's Three.js viewer.
4. Record SHA-256, filename, source URL, licence, dimensions, triangle count when available, and verification date.
5. Only then place the binary under `public/models/trucks/` and register it as an official local asset.
6. Run the vehicle asset integration tests and the full CI verification suite.

## Current truthful status

As of this commit, **no binary truck GLB/GLTF is installed in this repository**. The sources above are verified candidates, not installed assets. This distinction is intentional so the application never presents a broken URL or an unverified model as an official fleet asset.
