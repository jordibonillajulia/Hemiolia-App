import { computeRegistroAlta } from '@kreyo/verifactu-hash-calculator';

const hash = computeRegistroAlta({
  idEmisorFactura: "89890001K",
  numSerieFactura: "12345678/G33",
  fechaExpedicionFactura: "01-01-2024",
  tipoFactura: "F1",
  cuotaTotal: "12.35",
  importeTotal: "123.45",
  huellaAnterior: null,
  fechaHoraHusoGenRegistro: "2024-01-01T19:20:30+01:00"
});

console.log("Calculated hash:", hash);
if (hash === "3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60") {
  console.log("SUCCESS! Matches AEAT test vector.");
} else {
  console.log("FAILED! Does not match AEAT test vector.");
}
