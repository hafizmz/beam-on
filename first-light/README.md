# Beam On: First Light

A six-chapter medical physics game for secondary school students (ages 15–17, SPM, O level or IGCSE Physics). The player is the new medical physicist at a cancer centre in Malaysia, and every puzzle runs on school physics.

**Play it:** https://hafizmz.github.io/beam-on/first-light/

| Ch | Title | Levels | Physics |
|---|---|---|---|
| 1 | Shield It | First bunker, Budget cut, Primary beam | Inverse square law, half-value layers |
| 2 | Hit the Target | Pak Hassan's lung, Behind the eyes, Wrap around the cord | X-ray attenuation, crossfire beams, inverse planning |
| 3 | Morning Check | Stormy morning, A little too close, Slow drift | Gas laws in ion chambers, measurement error |
| 4 | Safe Zone | Clear the room, Screening, The 5-gauss line | Magnetic fields, MRI safety, radio waves |
| 5 | Tracer Time | First clinic, Heavy morning, Late delivery | Half-life and radioactive decay |
| 6 | Stop on the Spot | One perfect peak, Spread it out, Through the sinus | The Bragg peak and proton range |

## For teachers

- Each chapter takes 10–15 minutes and stands alone.
- Every level has a password-locked **Show solution** button for demonstrations. Ask the organiser for the password.
- Players must sign up before playing: name or nickname, email, school, state, Form or year, and interest in medical physics (1–5). The game then opens the organiser's Google Form with these answers filled in for the player to submit. Contact consent is optional.
- Progress is saved in the browser. Use **Clear progress on this device** on the menu page before the next group plays.

## Files

- `index.html`: chapter menu, career cards, pathway, teacher notes
- `ch1.html` … `ch6.html`: the chapters
- `common.css`, `common.js`: shared styles, music and sound, progress, sign-up, solution lock

No build step and no server: plain HTML, CSS and JavaScript. Chapter 1 loads three.js from cdnjs for its 3D view. Music and sound effects are generated live with the Web Audio API.

Physics is simplified for learning; each chapter's Physicist's notebook explains what is simplified.
