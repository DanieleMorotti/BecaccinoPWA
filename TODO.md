# TODO

To test it locally, run with:
"""
npm run dev
"""

## Firebase data cleaning

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


## UI

- from settings possibility of different UI for cards? (napoletane vs romagnole tipo)


## APP

- add striscio, busso etc like a side menu where "apri mano" is. Once selected and the card is played, at the center will appear the name of the specified action.
- add history available with a small history button with all the played cards in some pretty way
- add a settings button in the info, near the leave room, to choose how to order the cards in hand (asc, desc), clockwise, ....