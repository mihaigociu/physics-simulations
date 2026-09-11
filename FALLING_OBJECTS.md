# Why Does Everything Fall at the Same Speed?

*A guide for curious 10-12 year olds — goes with `free_fall_simulation.py`*

---

## 1. A surprising experiment

Hold a heavy book in one hand and a small eraser in the other. Lift them to
the same height. Drop them **at exactly the same moment**.

Which one hits the floor first?

Almost everybody says *the book* — it's heavier, so surely gravity pulls it
down faster. Try it. They hit the floor **together**.

This is one of the most famous surprises in all of physics. Let's find out why.

---

## 2. What is actually going on

When something falls, two things are happening at the same time — and they
work against each other.

**Thing 1: Heavy objects are pulled harder.**

Earth pulls on every kilogram of an object. A 20 kg ball is pulled 20 times
harder than a 1 kg ball. That's called its **weight**:

> weight = mass × g

So far, so good — this makes it *sound* like the heavy ball should win.

**Thing 2: Heavy objects are harder to get moving.**

Think about pushing a shopping trolley. An empty one starts rolling with one
finger. A trolley full of water bottles needs a real shove to get going.
Same push, less speed.

This stubbornness is called **inertia**, and an object's mass *is* its
stubbornness. A 20 kg ball is 20 times harder to get moving than a 1 kg ball.

**Now put the two together.**

The heavy ball gets pulled 20 times harder... but it is also 20 times harder
to get moving. The extra pull and the extra stubbornness **cancel each other
out perfectly**.

In one line of maths:

> acceleration = force ÷ mass = (mass × g) ÷ mass = **g**

Look what happened: the mass appears on the top *and* on the bottom, so it
cancels and disappears. What's left is just **g** — the same number for
everything. A feather, a hammer, an elephant, a grain of sand: on the same
planet, they all speed up at exactly the same rate.

---

## 3. So what *does* change the fall time?

Only two things:

| What you change | What happens to the fall time |
|---|---|
| **Mass** of the object | Nothing at all! |
| **Height** you drop from | Higher = longer fall |
| **g** (which planet you're on) | Weaker gravity = longer fall |

And here is the formula that says it. Don't be scared of it — it's short:

> **t = √(2h ÷ g)**

- **t** is the time it takes to fall (in seconds)
- **h** is the height you drop from (in metres)
- **g** tells you how strong gravity is (in m/s² — metres per second, per second)

Notice what is **missing** from the formula: there is no *m* for mass anywhere
in it. The formula simply doesn't care how heavy your object is.

### The three worlds in the simulation

| World | g (m/s²) | Fall from 20 m takes |
|---|---|---|
| Earth (Terra) | 9.81 | 2.02 s |
| Mars (Marte) | 3.72 | 3.28 s |
| Moon (Luna) | 1.62 | 4.97 s |

On the Moon, gravity is about 6 times weaker than on Earth — but the fall
takes only about 2.5 times longer, not 6 times. That's because of the square
root in the formula: to make the fall twice as long, gravity has to get
**four** times weaker.

---

## 4. Falling isn't at a steady speed — it keeps speeding up

A falling object doesn't drop at one fixed speed. Every single second on
Earth, it gets about **9.81 m/s faster**:

| After... | Speed | Distance fallen |
|---|---|---|
| 1 second | 9.8 m/s | 4.9 m |
| 2 seconds | 19.6 m/s | 19.6 m |
| 3 seconds | 29.4 m/s | 44.1 m |

Look carefully at that last column. In the first second it falls 4.9 m. In the
*next* second it falls 14.7 m — three times as far! The speed grows evenly,
but the distance grows much faster than that:

> **h = ½ × g × t²**

That little **²** is why falling from a high place is so much more dangerous
than falling from a low one.

### Reading the two graphs

The simulation draws two graphs on the right while the balls fall, and they
show the same fall in two different ways.

**Speed as time passes** comes out as a perfectly *straight* line. A straight
line means the speed goes up by the same amount every second — that's what
"9.81 m/s²" actually means. Both balls draw the same straight line, right on
top of each other.

**Speed after falling a distance** comes out as a *curve* that leans over. Look
at the first 5 metres: the speed shoots up fast. Then look at the last 5
metres: the speed barely changes. That curve is `v = √(2gh)` — the square root
again. It's why falling 4 times further doesn't make you land 4 times faster,
only 2 times faster.

So the same fall is a straight line against time, and a curve against
distance. Neither graph cares about the mass.

In the simulation, every 0.25 seconds a faint circle is left behind, like a
camera flashing in a dark room. At the start the circles are crowded close
together. Near the ground they are stretched far apart. **Widening gaps =
speeding up.** And both balls leave their circles in exactly the same places.

---

## 5. "But a feather falls slower than a stone!"

Good — you should be arguing with me. You're completely right: drop a feather
and a stone in your bedroom, and the stone wins easily.

The reason is **air**. Air is made of real stuff, and a falling object has to
shove it out of the way. This push-back is called **air resistance** (or
drag), and it is bigger for wide, flat, fluffy things. A feather is almost all
surface and almost no mass, so the air stops it almost immediately. A stone
barely notices the air.

So the real rule is:

> **Without air, everything falls at the same rate. Air is what makes light
> things fall more slowly.**

Try it in the simulation: make sure you are on **Terra**, press **A** to switch
air resistance on, set the height to 100 m and pick 0.1 kg against 50 kg. Now the heavy ball wins by
about half a second — and you'll see the light ball's flash-circles stop
spreading out near the bottom. It has stopped speeding up! The air is pushing
back exactly as hard as gravity pulls, so it has hit its top speed, called
**terminal velocity**. This is exactly how a parachute keeps you safe.

Then press **A** again to take the air away, and the tie comes back.

**Each world has its own air.** The air switch uses the real atmosphere of the
world you are standing on, so it does not do the same thing everywhere:

| World | Air | With the air switch ON |
|---|---|---|
| Earth | 1.225 kg/m³ | A big difference — about half a second over 100 m |
| Mars | 0.020 kg/m³ (≈60× thinner) | Almost nothing — about 1/100 of a second |
| Moon | none at all | **Exactly nothing.** There is no air to switch on |

That last row is the important one. **The Moon has no atmosphere**, so on Luna
the air switch does nothing whatever you set it to — the two balls still land
together, at exactly √(2h/g). That is not a shortcut in the simulation; it is
the reason the hammer and the feather tied in 1971.

### Two real experiments that proved it

- **Galileo, around 1590.** The story goes that he climbed the Leaning Tower of
  Pisa and dropped two balls of very different weight. They landed together.
  Everybody had believed Aristotle for 2,000 years, who said heavy things fall
  faster. Galileo checked. Aristotle was wrong.
- **The Moon, 2 August 1971.** Astronaut David Scott stood on the Moon in front
  of a TV camera, held out a geology hammer and a falcon feather, and let go.
  There is no air on the Moon. They hit the dust at the same instant. You can
  still watch the video — search for *"Apollo 15 hammer and feather"*.

---

## 6. Things to try in the simulation

Run it like this:

```bash
python free_fall_simulation.py
```

1. **Make the fight as unfair as possible.** Set the light ball to 0.1 kg and
   the heavy one to 50 kg — that's 500 times heavier. Press DROP. Still a tie.
2. **Predict before you press.** Set the height to 45 m. Work out
   t = √(2 × 45 ÷ 9.81) in your head-ish (it's about 3 s). Now check the
   "prediction" box, then drop and watch the clock.
3. **Race the planets.** Keep the height at 20 m and drop on Terra, then
   Marte, then Luna (keys **1**, **2**, **3**). Which is slowest? Why?
4. **Four times the height.** Drop from 5 m, then from 20 m. The height went up
   4 times — did the time go up 4 times, or only 2? Can you see the square root
   hiding in your answer?
5. **Go slow.** Press **-** a few times for slow motion and watch the gaps
   between the flash-circles grow — and the two graphs draw themselves.
6. **Bring back the air.** Press **A** and try a light ball against a heavy one
   from 100 m.

---

## 7. Quiz

Answers are at the very bottom — don't peek until you've tried all ten!

**1.** You drop a 1 kg ball and a 10 kg ball from the same window at the same
moment, and there is no air. Which lands first?

- a) The 10 kg ball, because Earth pulls it harder
- b) The 1 kg ball, because it is easier to move
- c) They land at the same time
- d) It depends on their colour

---

**2.** Earth pulls ten times harder on the 10 kg ball. So why doesn't it win
the race?

- a) Earth actually pulls on both of them equally
- b) Because it is also ten times harder to get moving
- c) Because the heavy ball is bigger, so the air slows it down
- d) It does win, but by too little to see

---

**3.** Which two things decide how long a fall takes?

- a) The mass and the height
- b) The mass and the shape
- c) The height and the strength of gravity
- d) Only the mass

---

**4.** Look at the formula t = √(2h/g). Where is the mass in it?

- a) It's hidden inside the g
- b) It's hidden inside the h
- c) It isn't there at all — the fall time doesn't depend on mass
- d) You have to multiply the answer by the mass at the end

---

**5.** A ball takes 2 seconds to fall from 20 m on Earth. You drop the same
ball from 20 m on the Moon, where gravity is weaker. The fall now takes:

- a) Less than 2 seconds
- b) Exactly 2 seconds
- c) About 5 seconds
- d) The ball floats and never lands

---

**6.** On Earth a falling object gains about 9.8 m/s of speed every second.
How fast is it going 3 seconds after you let go (ignoring air)?

- a) 9.8 m/s
- b) About 29 m/s
- c) 3 m/s
- d) It stays at the same speed the whole way down

---

**7.** In the simulation, a faint circle is left behind every 0.25 seconds.
Why do the circles get further and further apart as the ball falls?

- a) The ball is getting heavier
- b) The ball is speeding up, so it covers more distance in each 0.25 s
- c) Gravity gets stronger closer to the ground
- d) It's just a drawing glitch

---

**8.** You drop a ball from 5 m, then from 20 m — four times higher. The fall
time gets:

- a) 4 times longer
- b) 2 times longer
- c) 16 times longer
- d) Exactly the same

---

**9.** On **Earth**, you switch air resistance ON and drop a 0.1 kg ball
against a 50 kg ball from 100 m. What happens?

- a) They still land at exactly the same time
- b) The heavy one lands first, because the air slows the light one much more
- c) The light one lands first, because it is easier to move
- d) Neither one ever reaches the ground

---

**10.** On the Moon, an astronaut drops a hammer and a feather at the same
moment. What does the TV camera show?

- a) The hammer lands well before the feather
- b) The feather lands first because the Moon's gravity is weak
- c) They land together, because the Moon has no air
- d) Both of them float away into space

---

### Bonus brain-stretchers

**11.** Two identical 1 kg balls are dropped together and land together. Now
imagine gluing them into one 2 kg object and dropping that. Should it suddenly
fall faster? What does your answer tell you about whether heavy things can fall
faster than light ones?

**12.** Gravity on Mars is 3.72 m/s², a bit more than twice as weak as Earth's
9.81 m/s². Is the fall from 20 m on Mars more than twice as long, or less than
twice as long? Check with the simulation, then explain why using the square
root.

**13.** One graph in the simulation is a straight line and the other is a
curve, yet both show the very same fall. What is plotted along the bottom of
the straight-line one, and what is plotted along the bottom of the curved one?
Why does swapping that change a line into a curve?

**14.** You are on the Moon in the simulation and you press **A** to switch
air resistance ON. Nothing at all changes. Is the simulation broken? Explain.

---

## Answer key

| Q | Answer | Why |
|---|---|---|
| 1 | c | With no air, every object falls at the same rate. |
| 2 | b | The 10× stronger pull is cancelled by 10× more inertia: a = mg/m = g. |
| 3 | c | Height h and gravity g — the only things in t = √(2h/g). |
| 4 | c | There is no *m* in the formula; mass cancelled out. |
| 5 | c | t = √(2 × 20 ÷ 1.62) ≈ 4.97 s. Weaker gravity = slower fall. |
| 6 | b | v = g × t = 9.8 × 3 ≈ 29.4 m/s. It keeps speeding up all the way down. |
| 7 | b | Equal time, more distance — that's exactly what "speeding up" looks like. |
| 8 | b | 4 times the height gives √4 = 2 times the fall time. |
| 9 | b | Air resistance hurts light objects far more; the light ball hits terminal velocity. |
| 10 | c | Apollo 15, 1971. No air, so no air resistance, so it's a perfect tie. |
| 11 | — | Gluing two balls together can't make them fall faster — nothing about the falling changed. That's a strong hint that mass simply can't affect the fall rate. (Galileo used this very argument!) |
| 12 | — | Less than twice as long: 3.28 s instead of 2.02 s. Because of the square root, gravity must get **4** times weaker to double the fall time. |
| 13 | — | The straight line has **time** along the bottom (speed rises by the same 9.81 m/s every second). The curve has **distance fallen** along the bottom (v = √(2gh), so most of the speed is gained early). Same fall, two different questions. |
| 14 | — | Not broken — correct. The Moon has no atmosphere, so there is no air to resist anything; the air switch has nothing to act on and the fall stays exactly √(2h/g). Try the same thing on Mars for a tiny difference, and on Earth for a big one. |

---

*Inspired by Lecture 1 of Walter Lewin's 8.01x — MIT Physics I: Classical
Mechanics.*
