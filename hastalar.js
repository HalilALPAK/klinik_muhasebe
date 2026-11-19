"use strict";

/* Hasta hesapları listesi: her hastanın ücret, ödenen ve kalan tutarı */

const hastalarSayfasi = document.getElementById("hastalar-sayfasi");
const hastaArama = document.getElementById("hasta-arama");
const yalnizBorclular = document.getElementById("yalniz-borclular");

function kalanHucresi(kalan) {
  const sinif = kalan > 0 ? "sayi borc" : kalan < 0 ? "sayi avans" : "sayi soluk";
  return el("td", { className: sinif, title: kalan < 0 ? "Fazla ödeme (avans)" : undefined }, paraGoster(kalan));
}

function hastalariCiz() {
  const ozetler = hesapOzetleri();
  const aranan = kucult(hastaArama.value.replace(/\s+/g, " "));
  const gorunen = veri.hastalar
    .map((h) => ({ h, o: ozetler.get(h.id) || BOS_OZET }))
    .filter(({ h, o }) => (!yalnizBorclular.checked || o.kalan > 0)
      && kucult(`${h.hastaNo} ${tamAd(h)} ${h.tc || ""}`).includes(aranan))
    .sort((a, b) => (yalnizBorclular.checked ? b.o.kalan - a.o.kalan : 0) || tamAd(a.h).localeCompare(tamAd(b.h), "tr"));

  const satirlar = gorunen.map(({ h, o }) => el("tr", { onclick: () => { location.hash = `hasta/${h.id}`; } },
    el("td", { className: "soluk" }, String(h.hastaNo ?? "-")),
    el("td", null, el("a", { href: `#hasta/${h.id}` }, tamAd(h))),
    el("td", null, h.tc || "-"),
    el("td", { className: "sayi" }, paraGoster(o.ucret)),
    el("td", { className: "sayi" }, paraGoster(o.odenen)),
    kalanHucresi(o.kalan),
  ));
  tabloyuDoldur(document.getElementById("hasta-satirlari"), document.getElementById("hasta-bos"), satirlar,
    !veri.hastalar.length ? "Henüz hasta yok. Hastalar klinik panelinden eklenir."
      : yalnizBorclular.checked && !aranan ? "Borçlu hasta yok." : "Aramayla eşleşen hasta yok.");

  const bugun = bugununTarihi();
  const ayBasi = `${bugun.slice(0, 7)}-01`;
  const alacak = toplam([...ozetler.values()], (o) => Math.max(0, o.kalan));
  const borcluSayisi = [...ozetler.values()].filter((o) => o.kalan > 0).length;
  ozetKutulari(document.getElementById("genel-ozet"), [
    { baslik: "Toplam alacak", deger: paraGoster(alacak), sinif: "vurgu", alt: `${borcluSayisi} borçlu hasta` },
    { baslik: "Bugünkü tahsilat", deger: paraGoster(toplam(veri.odemeler.filter((o) => o.tarih === bugun), (o) => o.tutar)) },
    { baslik: "Bu ay tahsilat", deger: paraGoster(toplam(veri.odemeler.filter((o) => tarihAraliginda(o, ayBasi, bugun)), (o) => o.tutar)) },
    { baslik: "Bu ay gider", deger: paraGoster(toplam(veri.giderler.filter((g) => tarihAraliginda(g, ayBasi, bugun)), (g) => g.tutar)) },
  ]);
}

hastaArama.addEventListener("input", hastalariCiz);
yalnizBorclular.addEventListener("change", hastalariCiz);
