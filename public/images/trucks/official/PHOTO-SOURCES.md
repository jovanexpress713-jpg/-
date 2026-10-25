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

## Interactive 3D model status
The previously prototyped remote Grab3D semi-truck preview was removed from the dashboard because it was stylized rather than photorealistic and required an external network download. It is not bundled or presented as a finished local 3D asset.

A production 3D model must be added to the repository under public/models/ejaz/ only after:
- its visual fidelity is reviewed and accepted;
- its license explicitly permits the intended commercial use;
- the GLB and all dependent textures are actually bundled;
- the local viewer loads without network access; and
- CI typecheck, tests, and production build pass.

The existing category photos remain local project assets, but their original photographer/license provenance has not been independently verified here. Do not claim photorealistic 3D delivery until the model file itself is present and visually inspected.
