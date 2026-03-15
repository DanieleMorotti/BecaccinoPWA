# Becaccino PWA

PWA multiplayer con stanze realtime basata su Firebase Firestore e autenticazione anonima.

## Setup rapido (Firebase)
1. Crea un progetto Firebase.
2. Abilita Authentication -> Anonymous.
3. Abilita Cloud Firestore (modalita produzione o test).
4. Copia la configurazione del progetto e sostituisci i valori in `app.js`.
5. Incolla le regole di sicurezza da `firestore.rules` nella console Firebase.
6. Carica i file statici su GitHub Pages.

## Note
- Logica Becaccino 4 giocatori 2v2 con briscola, obbligo di rispondere al seme, prese e punteggi in terzi.
- I punti della mano sono calcolati in terzi e arrotondati per difetto al punto intero prima di aggiungerli alla partita.
