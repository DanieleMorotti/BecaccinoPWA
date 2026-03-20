# TODO

To test it locally, run with:
"""
npx serve .
"""

## Firebase

Yes — for Firestore there is a built‑in way to expire data, but for Auth accounts
there isn’t a “settings” TTL; you need a cleanup job.

Firestore (game data)
Use a TTL policy on a timestamp field (e.g., expireAt) and set it to createdAt + 1
hour. Firestore will automatically delete documents whose TTL timestamp is in the
past. Deletion is not immediate; expired documents are typically removed within 24
hours. TTL also does not delete subcollections under a document. (firebase.google.
com (https://firebase.google.com/docs/firestore/ttl?utm_source=openai))

Where to set it: Google Cloud Console → Firestore → Time‑to‑live (TTL) → create po
licy for your collection group and field. (firebase.google.com
(https://firebase.google.com/docs/firestore/ttl?utm_source=openai))

If you need near‑exact 1‑hour cleanup, use a scheduled Cloud Function/Cloud Schedu
ler job that queries expired docs and deletes them (TTL is best‑effort, not precis
e). (firebase.google.com
(https://firebase.google.com/docs/firestore/ttl?utm_source=openai))

Accounts (temporary users)
Firebase Auth doesn’t have a TTL setting. The typical approach is:

1. Run a scheduled cleanup (Cloud Functions + Admin SDK) that lists users and dele
    tes those older than your threshold. The Admin SDK supports programmatic deleti
    on. (firebase.google.com
    (https://firebase.google.com/docs/auth/admin/manage-users?utm_source=openai))
2. When you delete a user, you can automatically delete their Firestore/Storage da
    ta with the Delete User Data extension. (firebase.google.com

(https://firebase.google.com/docs/extensions/official/delete-user-data?utm_source=openai))

If users delete themselves in the client, Firebase supports deleteUser(...) but re
quires recent sign‑in. (firebase.google.com
(https://firebase.google.com/docs/auth/web/manage-users?utm_source=openai))


## UI

- add an image to the homepage / create an icon for the webapp
- from settings possibility of different UI for cards? (napoletane vs romagnole tipo)


## APP

- add history available with a small history button with all the played cards in some pretty way
- add striscio, busso etc like a side menu where "apri mano" is. Once selected and the card is played, at the center will appear the name of the specified action.
- add a settings button in the info, near the leave room, to choose how to order the cards (asc, desc) and something else.