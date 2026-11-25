// Draw both girls from the shared template in index.html
const girlArt = document.getElementById("girl").innerHTML;
document.querySelectorAll(".girl").forEach((svg) => (svg.innerHTML = girlArt));

const chaptersEl = document.getElementById("chapters");
const stage = document.querySelector(".stage");
const root = document.documentElement;

// Build one section per trip
window.TRIPS.forEach((trip, i) => {
  const section = document.createElement("section");
  section.className = "chapter";
  section.dataset.index = i;
  section.innerHTML = `
    <article class="card">
      <span class="age">${/^\d+$/.test(trip.age) ? "age " + trip.age : trip.age}</span>
      <h2></h2>
      <p class="meta"></p>
      <p class="text"></p>
    </article>`;
  section.querySelector("h2").textContent = trip.title;
  section.querySelector(".meta").textContent = [trip.place, trip.when].filter(Boolean).join(" · ");
  section.querySelector(".text").textContent = trip.text;
  if (trip.fly) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fly-btn";
    btn.textContent = "See it from above ✈";
    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.textContent = "Loading the map…";
      try {
        const flight = await import(`./fly-${trip.fly}.js`);
        flight.open();
      } catch (err) {
        console.error(err);
        alert("The 3D trip couldn't load. Check your internet connection and try again.");
      }
      btn.disabled = false;
      btn.textContent = "See it from above ✈";
    });
    section.querySelector(".card").append(btn);
  }
  if (trip.photo) {
    const img = document.createElement("img");
    img.src = trip.photo;
    img.alt = trip.title;
    img.loading = "lazy";
    section.querySelector(".card").append(img);
  }
  chaptersEl.append(section);
});

// When a chapter comes into view: reveal its card and change the sky
const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add("seen");
    const trip = window.TRIPS[entry.target.dataset.index];
    if (trip.sky) root.style.setProperty("--sky", trip.sky);
    stage.dataset.scene = trip.scene || "";
    stage.dataset.hat = trip.hat || "";
  }
}, { threshold: 0.4 });
document.querySelectorAll(".chapter").forEach((s) => observer.observe(s));

// The girls grow with scroll progress, and walk while you scroll
let stopTimer;
function onScroll() {
  const max = document.body.scrollHeight - innerHeight;
  const progress = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
  root.style.setProperty("--grow", progress.toFixed(3));

  stage.classList.add("walking");
  clearTimeout(stopTimer);
  stopTimer = setTimeout(() => stage.classList.remove("walking"), 150);
}
addEventListener("scroll", onScroll, { passive: true });
onScroll();
