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
