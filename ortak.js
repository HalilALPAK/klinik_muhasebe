"use strict";

/*
 * Ortak yardımcılar: para, tarih, metin ve küçük DOM yardımcıları.
 * Para her yerde kuruş cinsinden tam sayıdır (1.250,50 ₺ = 125050).
 */

const PARA_BICIMI = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 125050 → "1.250,50 ₺"
function paraGoster(kurus) {
  const isaret = kurus < 0 ? "−" : "";
  return `${isaret}${PARA_BICIMI.format(Math.abs(kurus) / 100)} ₺`;
}

// Form kutusuna yazılacak hali: 125050 → "1.250,50"; 0 → ""
const paraYaz = (kurus) => (kurus ? PARA_BICIMI.format(kurus / 100) : "");

/*
 * Kullanıcının yazdığı tutarı kuruşa çevirir. Geçersizse ya da negatifse null, boşsa 0.
 * Virgül varsa ondalık ayracıdır, noktalar binlik ayracıdır: "1.250,5" → 125050.
 * Virgül yoksa: "1.250" / "12.500.000" binliktir; "1250.5" ondalıktır.
 */
function paraOku(metin) {
  let m = String(metin ?? "").replace(/\s|₺|TL/gi, "");
  if (m === "") return 0;
  if (m.includes(",")) {
    if (!/^\d{1,3}(\.\d{3})*,\d{0,2}$|^\d+,\d{0,2}$/.test(m)) return null;
    m = m.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(m)) {
    m = m.replace(/\./g, "");
  } else if (!/^\d+(\.\d{0,2})?$/.test(m)) {
    return null;
  }
  const [tam, ondalik = ""] = m.split(".");
  return Number(tam) * 100 + Number(ondalik.padEnd(2, "0") || 0);
}

const iki = (n) => String(n).padStart(2, "0");
const tarihMetni = (d) => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
const bugununTarihi = () => tarihMetni(new Date());

// "2026-11-19" → "19.11.2026"
const tarihGoster = (tarih) => (tarih ? tarih.split("-").reverse().join(".") : "-");

function gunEkle(tarih, gun) {
  const [y, a, g] = tarih.split("-").map(Number);
  return tarihMetni(new Date(y, a - 1, g + gun));
}

const AY_ADLARI = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// Panelle aynı eşleşme kuralı: Türkçe küçük harf, ı = i
const kucult = (metin) => String(metin || "").toLocaleLowerCase("tr").replace(/ı/g, "i").trim();
const tamAd = (hasta) => `${hasta.ad} ${hasta.soyad}`;
const toplam = (liste, deger) => liste.reduce((t, x) => t + deger(x), 0);

// el("td", { className: "sayi" }, "metin", baskaDugum): metinler her zaman textContent olarak girer
function el(etiket, ozellikler, ...cocuklar) {
  const dugum = document.createElement(etiket);
  for (const [ad, deger] of Object.entries(ozellikler || {})) {
    if (deger === undefined || deger === null || deger === false) continue;
    if (ad === "dataset") Object.assign(dugum.dataset, deger);
    else if (ad.startsWith("on")) dugum.addEventListener(ad.slice(2), deger);
    else if (ad in dugum && ad !== "list") dugum[ad] = deger;
    else dugum.setAttribute(ad, deger === true ? "" : deger);
  }
  dugum.append(...cocuklar.flat().filter((c) => c !== null && c !== undefined && c !== false).map((c) => (
    typeof c === "number" ? String(c) : c
  )));
  return dugum;
}

const ikonSvg = (yol) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${yol}"/></svg>`;
const IKON_KALEM = ikonSvg("M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4");
const IKON_COP = ikonSvg("M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5");

function ikonDugmesi(ikon, etiket, tiklaninca) {
  const dugme = el("button", { type: "button", className: "ikon-dugme", title: etiket, "aria-label": etiket, onclick: tiklaninca });
  dugme.innerHTML = ikon;
  return dugme;
}

// Özet kutusu: { baslik, deger, sinif }
function ozetKutulari(kap, kutular) {
  kap.replaceChildren(...kutular.map(({ baslik, deger, sinif, alt }) => el("div", { className: `ozet-kutu ${sinif || ""}` },
    el("span", { className: "ozet-baslik" }, baslik),
    el("strong", null, deger),
    alt ? el("span", { className: "ozet-alt" }, alt) : null,
  )));
}

function tabloyuDoldur(govde, bos, satirlar, bosMetni) {
  govde.replaceChildren(...satirlar);
  bos.hidden = satirlar.length > 0;
  if (bosMetni) bos.textContent = bosMetni;
}
