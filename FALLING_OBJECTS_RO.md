# De ce cad toate lucrurile la fel de repede?

*Un ghid pentru copii curioși de 10-12 ani — însoțește `free_fall_simulation.py`*

---

## 1. Un experiment surprinzător

Ține o carte grea într-o mână și o gumă de șters în cealaltă. Ridică-le la
aceeași înălțime. Dă-le drumul **exact în același moment**.

Care ajunge prima jos?

Aproape toată lumea spune *cartea* — e mai grea, deci sigur gravitația o trage
mai repede în jos. Încearcă. Ajung jos **în același timp**.

Aceasta este una dintre cele mai celebre surprize din toată fizica. Hai să
vedem de ce.

---

## 2. Ce se întâmplă în realitate

Când un obiect cade, se petrec două lucruri în același timp — și ele lucrează
unul împotriva celuilalt.

**Lucrul 1: Obiectele grele sunt trase mai puternic.**

Pământul trage de fiecare kilogram al unui obiect. O bilă de 20 kg este trasă
de 20 de ori mai puternic decât o bilă de 1 kg. Aceasta se numește **greutate**:

> greutate = masă × g

Până aici pare clar — de aici ai putea crede că bila grea ar trebui să câștige.

**Lucrul 2: Obiectele grele sunt mai greu de pus în mișcare.**

Gândește-te cum împingi un cărucior de cumpărături. Pe unul gol îl pornești cu
un deget. Unul plin cu baxuri de apă are nevoie de un brânci serios ca să
pornească. Aceeași împingere, viteză mai mică.

Această „încăpățânare" se numește **inerție**, iar masa unui obiect *este*
măsura încăpățânării lui. O bilă de 20 kg este de 20 de ori mai greu de pus în
mișcare decât una de 1 kg.

**Acum pune cele două lucruri împreună.**

Bila grea este trasă de 20 de ori mai puternic... dar este și de 20 de ori mai
greu de pus în mișcare. Tragerea în plus și încăpățânarea în plus **se anulează
perfect una pe cealaltă**.

Într-un singur rând de matematică:

> accelerație = forță ÷ masă = (masă × g) ÷ masă = **g**

Uită-te ce s-a întâmplat: masa apare și sus *și* jos, deci se simplifică și
dispare. Rămâne doar **g** — același număr pentru orice obiect. O pană, un
ciocan, un elefant, un grăunte de nisip: pe aceeași planetă, toate accelerează
exact la fel.

---

## 3. Atunci de ce depinde timpul de cădere?

Doar de două lucruri:

| Ce schimbi | Ce se întâmplă cu timpul de cădere |
|---|---|
| **Masa** obiectului | Absolut nimic! |
| **Înălțimea** de la care cade | Mai sus = cădere mai lungă |
| **g** (pe ce planetă ești) | Gravitație mai slabă = cădere mai lungă |

Și iată formula care spune asta. Nu te speria de ea — e scurtă:

> **t = √(2h ÷ g)**

- **t** este timpul de cădere (în secunde)
- **h** este înălțimea de la care cade obiectul (în metri)
- **g** arată cât de puternică este gravitația (în m/s² — metri pe secundă, la
  fiecare secundă)

Observă ce **lipsește** din formulă: nu există niciun *m* pentru masă nicăieri
în ea. Formulei pur și simplu nu-i pasă cât de greu este obiectul tău.

### Cele trei lumi din simulare

| Lumea | g (m/s²) | O cădere de la 20 m durează |
|---|---|---|
| Pământul (Terra) | 9,81 | 2,02 s |
| Marte | 3,72 | 3,28 s |
| Luna | 1,62 | 4,97 s |

Pe Lună gravitația este de aproximativ 6 ori mai slabă decât pe Pământ — dar
căderea durează doar de vreo 2,5 ori mai mult, nu de 6 ori. Asta se întâmplă
din cauza radicalului din formulă: pentru ca o cădere să dureze de două ori mai
mult, gravitația trebuie să fie de **patru** ori mai slabă.

---

## 4. Căderea nu se face cu viteză constantă — obiectul accelerează

Un obiect care cade nu coboară cu o singură viteză fixă. În fiecare secundă, pe
Pământ, devine cu aproximativ **9,81 m/s mai rapid**:

| După... | Viteza | Distanța parcursă |
|---|---|---|
| 1 secundă | 9,8 m/s | 4,9 m |
| 2 secunde | 19,6 m/s | 19,6 m |
| 3 secunde | 29,4 m/s | 44,1 m |

Uită-te atent la ultima coloană. În prima secundă cade 4,9 m. În secunda
*următoare* cade 14,7 m — de trei ori mai mult! Viteza crește uniform, dar
distanța crește mult mai repede:

> **h = ½ × g × t²**

Acel mic **²** este motivul pentru care o cădere de la mare înălțime este mult
mai periculoasă decât una de la înălțime mică.

### Cum se citesc cele două grafice

În timp ce bilele cad, simularea desenează două grafice în partea dreaptă, iar
ele arată aceeași cădere în două moduri diferite.

**Viteza pe măsură ce trece timpul** iese ca o linie perfect *dreaptă*. O linie
dreaptă înseamnă că viteza crește cu aceeași cantitate în fiecare secundă —
exact asta înseamnă „9,81 m/s²". Amândouă bilele desenează aceeași linie
dreaptă, una peste cealaltă.

**Viteza după ce a căzut o anumită distanță** iese ca o *curbă* care se
înclină. Uită-te la primii 5 metri: viteza crește foarte repede. Apoi uită-te la
ultimii 5 metri: viteza aproape nu se mai schimbă. Curba aceea este
`v = √(2gh)` — iar radicalul. De aceea, dacă cazi de 4 ori mai de sus, nu
aterizezi de 4 ori mai repede, ci doar de 2 ori.

Așadar aceeași cădere este o linie dreaptă în raport cu timpul și o curbă în
raport cu distanța. Niciunul dintre grafice nu ține cont de masă.

În simulare, la fiecare 0,25 secunde rămâne în urmă un cerc palid, ca un aparat
foto care declanșează blițul într-o cameră întunecată. La început cercurile sunt
înghesuite unul în altul. Aproape de pământ sunt foarte depărtate. **Distanțe
care cresc = obiect care accelerează.** Și amândouă bilele își lasă cercurile
exact în aceleași locuri.

---

## 5. „Dar o pană cade mai încet decât o piatră!"

Bine — este corect să mă contrazici. Ai perfectă dreptate: dacă dai drumul unei
pene și unei pietre în camera ta, piatra câștigă detașat.

Motivul este **aerul**. Aerul e făcut din ceva real, iar un obiect care cade
trebuie să-l împingă la o parte. Această împingere înapoi se numește
**rezistența aerului** (sau frecare cu aerul) și este mai mare pentru lucrurile
late, plate și pufoase. O pană este aproape numai suprafață și aproape fără
masă, așa că aerul o oprește aproape imediat. O piatră aproape nici nu simte
aerul.

Deci regula adevărată este:

> **Fără aer, toate obiectele cad la fel. Aerul este cel care face ca lucrurile
> ușoare să cadă mai încet.**

Încearcă în simulare: asigură-te că ești pe **Terra**, apasă **A** ca să
pornești rezistența aerului, pune înălțimea la 100 m și alege 0,1 kg contra
50 kg. Acum bila grea câștigă cu
aproximativ jumătate de secundă — și vei vedea că cercurile bilei ușoare nu se
mai depărtează unul de altul spre final. A încetat să accelereze! Aerul împinge
înapoi exact la fel de tare cât trage gravitația, deci bila a atins viteza sa
maximă, numită **viteză limită**. Exact așa te ține în siguranță o parașută.

Apoi apasă **A** din nou ca să iei aerul la o parte, și egalitatea revine.

**Fiecare lume are aerul ei.** Comutatorul de aer folosește atmosfera reală a
lumii pe care te afli, deci nu face același lucru peste tot:

| Lumea | Aer | Cu comutatorul de aer PORNIT |
|---|---|---|
| Pământul | 1,225 kg/m³ | O diferență mare — cam jumătate de secundă pe 100 m |
| Marte | 0,020 kg/m³ (≈60× mai rarefiat) | Aproape nimic — cam 1/100 de secundă |
| Luna | deloc | **Exact nimic.** Nu există aer care să fie pornit |

Ultimul rând este cel important. **Luna nu are atmosferă**, deci pe Lună
comutatorul de aer nu face nimic, oricum l-ai pune — cele două bile ajung tot
împreună, exact la √(2h/g). Asta nu este o scurtătură din simulare; este chiar
motivul pentru care ciocanul și pana au ajuns la egalitate în 1971.

### Două experimente reale care au demonstrat asta

- **Galileo, în jurul anului 1590.** Se povestește că a urcat în Turnul din Pisa
  și a lăsat să cadă două bile cu greutăți foarte diferite. Au ajuns jos în
  același timp. Timp de 2.000 de ani toți îl crezuseră pe Aristotel, care
  spunea că lucrurile grele cad mai repede. Galileo a verificat. Aristotel
  greșea.
- **Luna, 2 august 1971.** Astronautul David Scott a stat pe Lună în fața unei
  camere de televiziune, a întins un ciocan geologic și o pană de șoim și le-a
  dat drumul. Pe Lună nu există aer. Au atins praful în aceeași clipă. Poți
  vedea filmarea și azi — caută *„Apollo 15 hammer and feather"*.

---

## 6. Lucruri de încercat în simulare

Pornește-o așa:

```bash
python free_fall_simulation.py
```

1. **Fă lupta cât mai inegală posibil.** Pune bila ușoară la 0,1 kg și pe cea
   grea la 50 kg — adică de 500 de ori mai grea. Apasă DROP. Tot egalitate.
2. **Prezice înainte să apeși.** Pune înălțimea la 45 m. Calculează
   t = √(2 × 45 ÷ 9,81) (este cam 3 s). Verifică apoi în căsuța „prediction",
   dă drumul bilelor și urmărește cronometrul.
3. **Întrecere între planete.** Ține înălțimea la 20 m și dă drumul bilelor pe
   Terra, apoi pe Marte, apoi pe Lună (tastele **1**, **2**, **3**). Unde e cel
   mai lent? De ce?
4. **De patru ori mai sus.** Dă drumul de la 5 m, apoi de la 20 m. Înălțimea a
   crescut de 4 ori — timpul a crescut de 4 ori sau doar de 2 ori? Vezi
   radicalul ascuns în răspunsul tău?
5. **Încetinește.** Apasă **-** de câteva ori pentru „slow motion" și privește
   cum cresc distanțele dintre cercuri — și cum se desenează cele două grafice.
6. **Adu aerul înapoi.** Apasă **A** și încearcă o bilă ușoară contra unei bile
   grele, de la 100 m.

---

## 7. Chestionar

Răspunsurile sunt chiar la final — nu trage cu ochiul până nu le-ai încercat pe
toate zece!

**1.** Dai drumul unei bile de 1 kg și unei bile de 10 kg de la aceeași
fereastră, în același moment, și nu există aer. Care ajunge prima jos?

- a) Bila de 10 kg, pentru că Pământul o trage mai puternic
- b) Bila de 1 kg, pentru că e mai ușor de mișcat
- c) Ajung jos în același timp
- d) Depinde de culoarea lor

---

**2.** Pământul trage de zece ori mai puternic de bila de 10 kg. Atunci de ce
nu câștigă ea întrecerea?

- a) De fapt Pământul trage la fel de puternic de amândouă
- b) Pentru că este și de zece ori mai greu de pus în mișcare
- c) Pentru că bila grea e mai mare, deci aerul o încetinește
- d) Chiar câștigă, dar cu prea puțin ca să se vadă

---

**3.** Care două lucruri hotărăsc cât durează o cădere?

- a) Masa și înălțimea
- b) Masa și forma
- c) Înălțimea și cât de puternică este gravitația
- d) Doar masa

---

**4.** Uită-te la formula t = √(2h/g). Unde este masa în ea?

- a) Este ascunsă în g
- b) Este ascunsă în h
- c) Nu există deloc — timpul de cădere nu depinde de masă
- d) Trebuie să înmulțești rezultatul cu masa la final

---

**5.** O bilă cade de la 20 m pe Pământ în 2 secunde. Dai drumul aceleiași bile
de la 20 m pe Lună, unde gravitația este mai slabă. Acum căderea durează:

- a) Mai puțin de 2 secunde
- b) Exact 2 secunde
- c) Aproximativ 5 secunde
- d) Bila plutește și nu ajunge niciodată jos

---

**6.** Pe Pământ, un obiect în cădere câștigă aproximativ 9,8 m/s de viteză în
fiecare secundă. Cât de repede se mișcă 3 secunde după ce i-ai dat drumul
(ignorând aerul)?

- a) 9,8 m/s
- b) Aproximativ 29 m/s
- c) 3 m/s
- d) Rămâne cu aceeași viteză pe tot drumul

---

**7.** În simulare, la fiecare 0,25 secunde rămâne în urmă un cerc palid. De ce
cercurile sunt din ce în ce mai depărtate pe măsură ce bila cade?

- a) Bila devine mai grea
- b) Bila accelerează, deci parcurge mai multă distanță în fiecare 0,25 s
- c) Gravitația devine mai puternică aproape de pământ
- d) Este doar o eroare de desenare

---

**8.** Dai drumul unei bile de la 5 m, apoi de la 20 m — de patru ori mai sus.
Timpul de cădere devine:

- a) De 4 ori mai lung
- b) De 2 ori mai lung
- c) De 16 ori mai lung
- d) Exact la fel

---

**9.** Pe **Pământ**, pornești rezistența aerului și dai drumul unei bile de
0,1 kg contra unei bile de 50 kg, de la 100 m. Ce se întâmplă?

- a) Ajung jos tot exact în același timp
- b) Cea grea ajunge prima, pentru că aerul o încetinește mult mai mult pe cea
  ușoară
- c) Cea ușoară ajunge prima, pentru că e mai ușor de mișcat
- d) Niciuna nu mai ajunge vreodată la pământ

---

**10.** Pe Lună, un astronaut dă drumul unui ciocan și unei pene în același
moment. Ce arată camera de televiziune?

- a) Ciocanul ajunge jos mult înaintea penei
- b) Pana ajunge prima, pentru că gravitația Lunii e slabă
- c) Ajung jos împreună, pentru că Luna nu are aer
- d) Amândouă plutesc în spațiu

---

### Întrebări bonus, pentru mintea antrenată

**11.** Două bile identice de 1 kg cad împreună și ajung jos împreună. Acum
imaginează-ți că le lipești într-un singur obiect de 2 kg și îi dai drumul.
Ar trebui ca acesta să cadă brusc mai repede? Ce îți spune răspunsul tău despre
întrebarea dacă lucrurile grele pot cădea mai repede decât cele ușoare?

**12.** Gravitația pe Marte este 3,72 m/s², adică puțin mai mult de două ori mai
slabă decât cea de pe Pământ (9,81 m/s²). Căderea de la 20 m pe Marte durează
mai mult de două ori mai mult sau mai puțin de două ori? Verifică cu simularea,
apoi explică folosind radicalul.

**13.** Un grafic din simulare este o linie dreaptă, iar celălalt este o curbă,
deși amândouă arată exact aceeași cădere. Ce este reprezentat pe orizontală în
cazul liniei drepte și ce este reprezentat pe orizontală în cazul curbei? De ce
schimbarea aceasta transformă o linie în curbă?

**14.** Ești pe Lună în simulare și apeși **A** ca să pornești rezistența
aerului. Nu se schimbă absolut nimic. Este simularea defectă? Explică.

---

## Răspunsuri

| Nr. | Răspuns | De ce |
|---|---|---|
| 1 | c | Fără aer, toate obiectele cad la fel. |
| 2 | b | Tragerea de 10× mai mare este anulată de o inerție de 10× mai mare: a = mg/m = g. |
| 3 | c | Înălțimea h și gravitația g — singurele lucruri din t = √(2h/g). |
| 4 | c | Nu există niciun *m* în formulă; masa s-a simplificat. |
| 5 | c | t = √(2 × 20 ÷ 1,62) ≈ 4,97 s. Gravitație mai slabă = cădere mai lentă. |
| 6 | b | v = g × t = 9,8 × 3 ≈ 29,4 m/s. Accelerează tot drumul în jos. |
| 7 | b | Timp egal, distanță mai mare — exact așa arată accelerarea. |
| 8 | b | De 4 ori înălțimea dă √4 = 2 ori timpul de cădere. |
| 9 | b | Rezistența aerului afectează mult mai mult obiectele ușoare; bila ușoară atinge viteza limită. |
| 10 | c | Apollo 15, 1971. Fără aer, deci fără rezistența aerului, deci egalitate perfectă. |
| 11 | — | Lipirea a două bile nu le poate face să cadă mai repede — nimic din cădere nu s-a schimbat. Este un indiciu puternic că masa pur și simplu nu poate influența ritmul căderii. (Galileo a folosit chiar acest argument!) |
| 12 | — | Mai puțin de două ori: 3,28 s în loc de 2,02 s. Din cauza radicalului, gravitația trebuie să fie de **4** ori mai slabă pentru ca timpul să se dubleze. |
| 13 | — | Linia dreaptă are **timpul** pe orizontală (viteza crește cu aceiași 9,81 m/s în fiecare secundă). Curba are **distanța parcursă** pe orizontală (v = √(2gh), deci cea mai mare parte a vitezei se câștigă la început). Aceeași cădere, două întrebări diferite. |
| 14 | — | Nu este defectă — este corectă. Luna nu are atmosferă, deci nu există aer care să se opună nimicului; comutatorul nu are pe ce să acționeze, iar căderea rămâne exact √(2h/g). Încearcă același lucru pe Marte, pentru o diferență minusculă, și pe Pământ, pentru una mare. |

---

*Inspirat de Lecția 1 din 8.01x a lui Walter Lewin — MIT Physics I: Classical
Mechanics.*
