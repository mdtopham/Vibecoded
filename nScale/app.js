const countInput = document.querySelector("#count");
const train = document.querySelector("#train");
const template = document.querySelector("#card-template");
const title = document.querySelector("#result-title");
const summary = document.querySelector("#summary");

function clampCount(value) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 1;
  return Math.min(CARS.length, Math.max(1, parsed));
}

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function renderCard(car, position) {
  const node = template.content.firstElementChild.cloneNode(true);
  node.querySelector(".position").textContent = position;
  const image = node.querySelector("img");
  image.src = car.image;
  image.alt = `${car.road} ${car.number} ${car.type}`;
  node.querySelector(".car-type").textContent = car.type;
  node.querySelector(".road").textContent = car.road;
  node.querySelector(".number").textContent = car.number;
  return node;
}

function drawTrain() {
  const count = clampCount(countInput.value);
  countInput.value = count;
  const selection = shuffled(CARS).slice(0, count);

  train.replaceChildren(...selection.map((car, index) => renderCard(car, index + 1)));

  const names = {
    1: "One-car train",
    2: "Two-car train",
    3: "Three-car train",
    4: "Four-car train",
    5: "Five-car train",
    6: "Six-car train",
    7: "Seven-car train",
    8: "Eight-car train"
  };
  title.textContent = names[count];
  const roads = [...new Set(selection.map(car => car.road))].join(" / ");
  summary.textContent = `${roads} · ${count} card${count === 1 ? "" : "s"}`;
}

function changeCount(delta) {
  countInput.value = clampCount(clampCount(countInput.value) + delta);
}

document.querySelector("#decrease").addEventListener("click", () => changeCount(-1));
document.querySelector("#increase").addEventListener("click", () => changeCount(1));
document.querySelector("#draw").addEventListener("click", drawTrain);
document.querySelector("#reshuffle").addEventListener("click", drawTrain);
document.querySelector("#print").addEventListener("click", () => window.print());
countInput.addEventListener("change", () => {
  countInput.value = clampCount(countInput.value);
});

const catalogue = document.querySelector("#catalogue");
for (const car of CARS) {
  const item = document.createElement("article");
  item.className = "catalogue-item";
  item.innerHTML = `
    <img src="${car.image}" alt="${car.road} ${car.number} ${car.type}">
    <p>${car.type} · ${car.road} ${car.number}</p>
  `;
  catalogue.append(item);
}

drawTrain();
