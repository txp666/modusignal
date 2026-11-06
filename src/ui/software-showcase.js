// The desktop-software cards on the home page: staggered entrance, the demo video plays while its card is in view,
// a spotlight and a slight tilt that follow the pointer.
export function initSoftwareShowcase(root = document) {
  const section = root.querySelector("[data-software-showcase]");
  if (!section) return;
  const cards = [...section.querySelectorAll("[data-sw-card]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(pointer: fine)").matches;

  // The entrance only plays on wide screens with a mouse; elsewhere the cards are simply shown.
  if (!reduced && finePointer && matchMedia("(min-width: 861px)").matches && cards.length) {
    cards.forEach((card, i) => card.style.setProperty("--sw-d", `${(i % 2) * 0.08 + Math.floor(i / 2) * 0.06}s`));
    cards[0].parentElement.classList.add("sw-reveal");
    const reveal = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          reveal.unobserve(entry.target);
        }
      }
    }, { threshold: 0.12 });
    cards.forEach((card) => reveal.observe(card));
  }

  const play = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const video = entry.target.querySelector("video");
      if (!video || reduced) continue;
      if (entry.intersectionRatio >= 0.55) {
        if (video.preload === "none") video.preload = "auto";
        video.play().then(() => entry.target.classList.add("playing")).catch(() => {});
      } else {
        video.pause();
        entry.target.classList.remove("playing");
      }
    }
  }, { threshold: [0, 0.55, 1] });
  cards.forEach((card) => play.observe(card));

  if (!finePointer || reduced) return;
  for (const card of cards) {
    const media = card.querySelector(".sw-media");
    card.addEventListener("pointermove", (event) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty("--mx", `${event.clientX - r.left}px`);
      card.style.setProperty("--my", `${event.clientY - r.top}px`);
      if (!media) return;
      const m = media.getBoundingClientRect();
      const x = (event.clientX - m.left) / m.width - 0.5;
      const y = (event.clientY - m.top) / m.height - 0.5;
      media.style.setProperty("--ry", `${(x * 6).toFixed(2)}deg`);
      media.style.setProperty("--rx", `${(y * -5).toFixed(2)}deg`);
    });
    card.addEventListener("pointerleave", () => {
      media?.style.setProperty("--ry", "0deg");
      media?.style.setProperty("--rx", "0deg");
    });
  }
}
