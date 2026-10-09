---
title: Why does everything fall at the same speed?
description: A guide for curious 10–12 year olds about falling objects, gravity and air resistance.
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
| Earth | 9.81 | 2.02 s |
| Mars | 3.72 | 3.28 s |
| Moon | 1.62 | 4.97 s |

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

### Reading the three graphs

The simulation draws three graphs while the balls fall. They all
show the very same fall, just answering three different questions.

**Distance fallen as time passes** comes out as a *curve that gets steeper* —
a shape called a parabola. In the first second the line barely lifts off the
bottom; by the last second it is climbing steeply. That is `h = ½ × g × t²`
drawn out: the ball covers far more ground in its last second than in its
first. This graph answers *where is it?*

**Speed as time passes** comes out as a perfectly *straight* line. A straight
line means the speed goes up by the same amount every second — that's what
"9.81 m/s²" actually means. Both balls draw the same straight line, right on
top of each other.

**Speed after falling a distance** comes out as a *curve* that leans over. Look
at the first 5 metres: the speed shoots up fast. Then look at the last 5
metres: the speed barely changes. That curve is `v = √(2gh)` — the square root
again. It's why falling 4 times further doesn't make you land 4 times faster,
only 2 times faster.

Notice that the top two graphs share the same bottom axis — time — so you can
read them against each other: at any moment, the top graph tells you how far
the ball has fallen and the middle one tells you how fast it is going.

So the same fall is a steepening curve for distance, a straight line for
speed, and a flattening curve for speed against distance. **None of the three
graphs cares about the mass** — the two balls draw the same shapes.

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

Try it in the simulation: make sure you are on **Earth**, switch
**Air resistance** on (or press **A**), set the height to 100 m and pick 0.1 kg against 50 kg. Now the heavy ball wins by
about half a second — and you'll see the light ball's flash-circles stop
spreading out near the bottom. It has stopped speeding up! The air is pushing
back exactly as hard as gravity pulls, so it has hit its top speed, called
**terminal velocity**. This is exactly how a parachute keeps you safe.

Then switch the air off again, and the tie comes back.

**Each world has its own air.** The air switch uses the real atmosphere of the
world you are standing on, so it does not do the same thing everywhere:

| World | Air | With the air switch ON |
|---|---|---|
| Earth | 1.225 kg/m³ | A big difference — about half a second over 100 m |
| Mars | 0.020 kg/m³ (≈60× thinner) | Almost nothing — about 1/100 of a second |
| Moon | none at all | **Exactly nothing.** There is no air to switch on |

That last row is the important one. **The Moon has no atmosphere**, so on the Moon
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

Each link opens the simulation already set up. Press **Drop!** when you're ready.

1. **[Make the fight as unfair as possible.](../?m1=0.1&m2=50)** The blue ball
   is 0.1 kg and the red one 50 kg, which is 500 times heavier. Drop them.
   Still a tie.
2. **[Predict before you press.](../?h=45)** The height is 45 m. Work out
   t = √(2 × 45 ÷ 9.81) in your head-ish (it's about 3 s). Check the
   "prediction" box, then drop and watch the clock.
3. **Race the worlds.** Keep the height at 20 m and drop on
   [Earth](../), then [Mars](../?world=mars), then [the Moon](../?world=moon).
   Which is slowest? Why?
4. **Four times the height.** Drop from [5 m](../?h=5), then from
   [20 m](../). The height went up 4 times. Did the time go up 4 times, or
   only 2? Can you see the square root hiding in your answer?
5. **Go slow.** Press the **−** next to *Simulation speed* a few times for
   slow motion. Watch the gaps between the flash-circles grow, and the graphs
   draw themselves.
6. **[Bring back the air.](../?h=100&m1=0.1&m2=50&air=1)** Air resistance is on,
   the drop is 100 m, and it's a light ball against a heavy one.

---

*Inspired by Lecture 1 of Walter Lewin's 8.01x, MIT Physics I: Classical
Mechanics.*
