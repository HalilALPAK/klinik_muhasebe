"use strict";

/* Raporlar: dönem toplamları, aylık özet ve borçlu hastalar */

const raporlarSayfasi = document.getElementById("raporlar-sayfasi");
const raporDonemi = document.getElementById("rapor-donemi");
const raporBaslangic = document.getElementById("rapor-baslangic");
const raporBitis = document.getElementById("rapor-bitis");
const raporYili = document.getElementById("rapor-yili");

function donemAraligi() {
  const bugun = bugununTarihi();
  const [y, a] = bugun.split("-").map(Number);
  switch (raporDonemi.value) {
    case "bugun": return [bugun, bugun];
    case "gecenAy": {
      const once = a === 1 ? [y - 1, 12] : [y, a - 1];
      const bas = `${once[0]}-${iki(once[1])}-01`;
      return [bas, gunEkle(`${y}-${iki(a)}-01`, -1)];
    }
    case "buYil": return [`${y}-01-01`, `${y}-12-31`];
    case "ozel": {
      const bas = raporBaslangic.value || bugun;
      const bit = raporBitis.value || bas;
      return bas <= bit ? [bas, bit] : [bit, bas];
    }
    default: return [`${y}-${iki(a)}-01`, gunEkle(a === 12 ? `${y + 1}-01-01` : `${y}-${iki(a + 1)}-01`, -1)];
  }
}

// [{ ad, tutar }] → büyükten küçüğe çubuklu liste
function dagilimListesi(kap, kalemler, bosMetni) {
  const enBuyuk = Math.max(1, ...kalemler.map((k) => k.tutar));
  kap.replaceChildren(kalemler.length
    ? el("ul", { className: "dagilim" }, kalemler.sort((x, y) => y.tutar - x.tutar).map((k) => el("li", null,
      el("span", { className: "dagilim-ad" }, k.ad),
      el("span", { className: "sayi" }, paraGoster(k.tutar)),
      el("span", { className: "dagilim-cubuk", style: `width:${Math.round((k.tutar / enBuyuk) * 100)}%` }),
    )))
    : el("p", { className: "liste-bos" }, bosMetni));
}

function grupla(liste, anahtar, deger) {
  const gruplar = new Map();
  for (const x of liste) gruplar.set(anahtar(x), (gruplar.get(anahtar(x)) || 0) + deger(x));
  return [...gruplar].map(([ad, tutar]) => ({ ad, tutar }));
}

function yillariDoldur() {
  const yillar = new Set([Number(bugununTarihi().slice(0, 4))]);
  for (const k of ["tahakkuklar", "odemeler", "giderler"]) for (const x of veri[k]) yillar.add(Number(x.tarih.slice(0, 4)));
  const secili = raporYili.value || bugununTarihi().slice(0, 4);
  raporYili.replaceChildren(...[...yillar].sort((a, b) => b - a).map((y) => el("option", { value: y }, String(y))));
  raporYili.value = secili;
}

function raporlariCiz() {
  const [bas, bit] = donemAraligi();
  const aralikta = (liste) => liste.filter((x) => tarihAraliginda(x, bas, bit));
  const tahsilat = aralikta(veri.odemeler);
  const ucretler = aralikta(veri.tahakkuklar);
  const giderler = aralikta(veri.giderler);
  const tahsilatToplami = toplam(tahsilat, (o) => o.tutar);
  const giderToplami = toplam(giderler, (g) => g.tutar);

  document.getElementById("rapor-aralik-yazisi").textContent = bas === bit ? tarihGoster(bas) : `${tarihGoster(bas)} – ${tarihGoster(bit)}`;
  ozetKutulari(document.getElementById("rapor-ozeti"), [
    { baslik: "Ücretlendirme", deger: paraGoster(toplam(ucretler, netTutar)), alt: `${ucretler.length} kalem` },
    { baslik: "Tahsilat", deger: paraGoster(tahsilatToplami), alt: `${tahsilat.length} ödeme` },
    { baslik: "Gider", deger: paraGoster(giderToplami), alt: `${giderler.length} gider` },
    { baslik: "Net (tahsilat − gider)", deger: paraGoster(tahsilatToplami - giderToplami), sinif: tahsilatToplami - giderToplami < 0 ? "borc" : "vurgu" },
  ]);

  dagilimListesi(document.getElementById("rapor-yontem"), grupla(tahsilat, (o) => YONTEMLER[o.yontem] || o.yontem, (o) => o.tutar), "Bu dönemde tahsilat yok.");
  dagilimListesi(document.getElementById("rapor-doktor"), grupla(ucretler, (t) => t.doktor || "Doktor yazılmamış", netTutar), "Bu dönemde ücretlendirme yok.");
  dagilimListesi(document.getElementById("rapor-kategori"), grupla(giderler, (g) => KATEGORILER[g.kategori] || g.kategori, (g) => g.tutar), "Bu dönemde gider yok.");

  // Aylık özet
  yillariDoldur();
  const yil = raporYili.value;
  const aylik = (liste, deger, ay) => toplam(liste.filter((x) => x.tarih.startsWith(`${yil}-${iki(ay)}`)), deger);
  const satirlar = AY_ADLARI.map((ad, i) => {
    const u = aylik(veri.tahakkuklar, netTutar, i + 1);
    const t = aylik(veri.odemeler, (o) => o.tutar, i + 1);
    const g = aylik(veri.giderler, (x) => x.tutar, i + 1);
    return { ad, u, t, g };
  });
  const toplamSatir = { ad: "Toplam", u: toplam(satirlar, (s) => s.u), t: toplam(satirlar, (s) => s.t), g: toplam(satirlar, (s) => s.g) };
  document.getElementById("aylik-satirlari").replaceChildren(...[...satirlar, toplamSatir].map((s) => el("tr", { className: s === toplamSatir ? "toplam-satiri" : "" },
    el("td", null, s.ad),
    el("td", { className: "sayi" }, paraGoster(s.u)),
    el("td", { className: "sayi" }, paraGoster(s.t)),
    el("td", { className: "sayi" }, paraGoster(s.g)),
    el("td", { className: `sayi ${s.t - s.g < 0 ? "borc" : ""}` }, paraGoster(s.t - s.g)),
  )));

  // Borçlu hastalar
  const ozetler = hesapOzetleri();
  const borclular = veri.hastalar
    .map((h) => ({ h, o: ozetler.get(h.id) || BOS_OZET }))
    .filter(({ o }) => o.kalan > 0)
    .sort((a, b) => b.o.kalan - a.o.kalan);
  tabloyuDoldur(document.getElementById("borclu-satirlari"), document.getElementById("borclu-bos"),
    borclular.map(({ h, o }) => el("tr", { onclick: () => { location.hash = `hasta/${h.id}`; } },
      el("td", { className: "soluk" }, String(h.hastaNo ?? "-")),
      el("td", null, el("a", { href: `#hasta/${h.id}` }, tamAd(h))),
      el("td", { className: "tarih" }, o.sonOdeme ? tarihGoster(o.sonOdeme) : "Hiç ödemedi"),
      el("td", { className: "sayi borc" }, paraGoster(o.kalan)),
    )));
}

raporDonemi.addEventListener("change", () => {
  const ozel = raporDonemi.value === "ozel";
  document.getElementById("rapor-ozel").hidden = !ozel;
  if (ozel && !raporBaslangic.value) {
    raporBaslangic.value = `${bugununTarihi().slice(0, 7)}-01`;
    raporBitis.value = bugununTarihi();
  }
  raporlariCiz();
});
raporBaslangic.addEventListener("change", raporlariCiz);
raporBitis.addEventListener("change", raporlariCiz);
raporYili.addEventListener("change", raporlariCiz);
document.getElementById("rapor-yazdir").addEventListener("click", () => window.print());
