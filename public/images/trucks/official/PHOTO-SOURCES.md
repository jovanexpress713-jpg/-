# EJAZ image asset provenance

## Dashboard hero photograph
- Source: Juan Pablo, Unsplash photo “Two trucks on a highway under cloudy sky”
- Page: https://unsplash.com/photos/two-trucks-on-a-highway-under-cloudy-sky-BFypIgR6FH8
- License: Unsplash License; the page marks this photo as free to use.
- Implementation: loaded from images.unsplash.com in the dashboard hero. It is an online image reference, not bundled into this repository; an internet connection is required for that hero photo.

## Four vehicle-category reference images
The dashboard's category cards use the existing local project assets:
- official-curtain.webp
- official-dry.webp
- official-reefer.webp
- official-flatbed.webp

These files were already present in the repository under public/images/trucks/official/. The existing project README describes them as reference photographs provided by the user. This file does not independently certify their original photographer or licensing provenance.

## Asset integrity policy
- Do not label a photo as an actual shipment record or a specific customer's cargo unless that image is attached to that record.
- Do not present procedural OBJ geometry as a real vehicle.
- Before adding more third-party images, record the source and license of each image. Prefer free commercial-use assets and bundle approved files when binary asset upload is available.

## Interactive 3D reference model
- Model: Semi Truck (49,550 triangles, 2K textures), from Grab3D's Cozy Vehicles Kit.
- Page: https://grab3d.com/models/vehicles/semi-truck/
- Download: https://grab3d.com/dl/semi-truck/semi-truck.glb
- License: CC0 1.0; the source catalog states that models may be used commercially without attribution.
- Implementation: the dashboard loads this GLB through Three.js from the external source. It is a stylized reference model, not a photoreal scan, manufacturer CAD, or proof of a customer's actual vehicle. It requires internet access; if the source is unavailable, the component displays a clear fallback.
- Source catalog and download URL policy: https://grab3d.com/developers/
