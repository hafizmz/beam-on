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
- Players sign up before playing with a name or nickname, school, state, Form or year, interest in medical physics (1–5). Players in Form 1–5 or studying A levels or the IB (under 18) must confirm that a parent or guardian agrees. Email is optional and asked only from players who want news of outreach events. Pressing **Start my first day** sends these answers straight to the organiser's Google Form; feedback after playing is sent the same way. If the device is offline, answers are queued and sent when it reconnects.
- Privacy: see the bilingual [privacy notice](privacy.html) (English and Bahasa Malaysia), written for the Personal Data Protection Act 2010 as amended in 2024.
- Progress is saved in the browser. Use **Clear progress on this device** on the menu page before the next group plays.

## Files

- `index.html`: chapter menu, career cards, pathway, teacher notes
- `ch1.html` … `ch6.html`: the chapters
- `privacy.html`: privacy notice in English and Bahasa Malaysia
- `common.css`, `common.js`: shared styles, music and sound, progress, sign-up, solution lock

No build step and no server: plain HTML, CSS and JavaScript. Chapter 1 loads three.js from cdnjs for its 3D view. Music and sound effects are generated live with the Web Audio API.

Physics is simplified for learning; each chapter's Physicist's notebook explains what is simplified.
