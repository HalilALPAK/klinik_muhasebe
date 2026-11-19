"use strict";

/* Fiyat listesi: tedavi adına göre diş başına fiyat; ücretlendirirken öneri olarak gelir */

const fiyatlarSayfasi = document.getElementById("fiyatlar-sayfasi");
const fiyatArama = document.getElementById("fiyat-arama");
const pasifleriGoster = document.getElementById("pasifleri-goster");

function fiyatlariCiz() {
  const aranan = kucult(fiyatArama.value);
  const gorunen = veri.fiyatlar
    .filter((f) => (pasifleriGoster.checked || f.aktif) && kucult(f.tedavi).includes(aranan))
    .sort((a, b) => a.tedavi.localeCompare(b.tedavi, "tr"));

  tabloyuDoldur(document.getElementById("fiyat-satirlari"), document.getElementById("fiyat-bos"),
    gorunen.map((f) => el("tr", { className: f.aktif ? "" : "pasif" },
      el("td", null, f.tedavi),
      el("td", { className: "sayi" }, paraGoster(f.fiyat)),
      el("td", null, f.aktif ? "Aktif" : "Pasif"),
      el("td", { className: "eylem" },
        ikonDugmesi(IKON_KALEM, "Düzelt", () => fiyatPenceresiniAc({ kayit: f })),
        ikonDugmesi(IKON_COP, "Sil", () => onaylaVeSil("fiyatlar", f, `"${f.tedavi}" fiyatı silinsin mi? Yazılmış ücretler değişmez.`))),
    )),
    veri.fiyatlar.length ? "Aramayla eşleşen fiyat yok." : "Henüz fiyat yok. \"+ Fiyat Ekle\" ile ya da sağdaki listeden ekleyin.");

  // Panelde kullanılmış ama fiyatı olmayan tedaviler (pasifler de "var" sayılır)
  const fiyatli = new Set(veri.fiyatlar.map((f) => kucult(f.tedavi)));
  const sayilar = new Map();
  for (const h of veri.hastalar) {
    for (const i of hastaninIslemleri(h)) {
      const anahtar = kucult(i.tedavi);
      if (!anahtar || fiyatli.has(anahtar)) continue;
      const kayit = sayilar.get(anahtar) || { ad: i.tedavi.trim(), sayi: 0 };
      kayit.sayi += 1;
      sayilar.set(anahtar, kayit);
    }
  }
  const fiyatsizlar = [...sayilar.values()].sort((a, b) => b.sayi - a.sayi || a.ad.localeCompare(b.ad, "tr"));
  document.getElementById("fiyatsiz-tedaviler").replaceChildren(...fiyatsizlar.map(({ ad, sayi }) => el("li", null,
    el("span", null, ad, el("span", { className: "soluk" }, ` · ${sayi} işlem`)),
    el("button", { type: "button", className: "dugme kucuk", onclick: () => fiyatPenceresiniAc({ tedavi: ad }) }, "Fiyat ver"),
  )));
  document.getElementById("fiyatsiz-bos").hidden = fiyatsizlar.length > 0;
}

fiyatArama.addEventListener("input", fiyatlariCiz);
pasifleriGoster.addEventListener("change", fiyatlariCiz);
document.getElementById("fiyat-ekle").addEventListener("click", () => fiyatPenceresiniAc());
