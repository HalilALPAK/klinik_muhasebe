"use strict";

/*
 * Bir hastanın hesabı: paneldeki ücretlendirilmemiş işlemler, ücret (tahakkuk) ve
 * ödemelerin yürüyen bakiyeli dökümü, ekstre yazdırma.
 */

const hesapSayfasi = document.getElementById("hesap-sayfasi");
let acikHesapId = null;

function ucretlendirilmemisIslemler(hasta) {
  const ucretli = new Set(veri.tahakkuklar.filter((t) => t.hasta === hasta.id && t.islemId).map((t) => t.islemId));
  const kalan = hastaninIslemleri(hasta).filter((i) => !ucretli.has(i.id));
  return {
    yapilan: kalan.filter((i) => i.yapildi).sort((a, b) => (a.yapilmaTarihi || "").localeCompare(b.yapilmaTarihi || "")),
    planlanan: kalan.filter((i) => !i.yapildi),
  };
}

const listeFiyati = (islem) => {
  const f = fiyatBul(islem.tedavi);
  return f ? f.fiyat * Math.max(1, (islem.disler || []).length) : null;
};

function ucretsizSatiri(hasta, islem) {
  const fiyat = listeFiyati(islem);
  return el("tr", { className: islem.yapildi ? "" : "planlanan" },
    el("td", null, el("span", { className: `durum ${islem.yapildi ? "yapildi" : ""}` }, islem.yapildi ? "Yapıldı" : "Planlandı")),
    el("td", { className: "tarih" }, islem.yapildi ? tarihGoster(islem.yapilmaTarihi) : "-"),
    el("td", null, islem.tedavi),
    el("td", null, (islem.disler || []).join(", ") || "-"),
    el("td", null, islem.doktor || "-"),
    el("td", { className: fiyat === null ? "sayi soluk" : "sayi" }, fiyat === null ? "fiyat yok" : paraGoster(fiyat)),
    el("td", { className: "eylem" },
      islem.yapildi ? null : el("button", { type: "button", className: "dugme kucuk", title: "Bu işlem için hastayı çağırmayı hatırlat",
        onclick: () => hatirlaticiPenceresiniAc({ hastaId: hasta.id, islem }) }, "Hatırlatıcı"),
      " ",
      el("button", { type: "button", className: "dugme kucuk", onclick: () => ucretPenceresiniAc({ hastaId: hasta.id, islem }) }, "Ücretlendir")),
  );
}

function dokumSatirlari(hasta) {
  const hareketler = [
    ...veri.tahakkuklar.filter((t) => t.hasta === hasta.id).map((t) => ({ tur: "ucret", kayit: t, tarih: t.tarih, created: t.created })),
    ...veri.odemeler.filter((o) => o.hasta === hasta.id).map((o) => ({ tur: "odeme", kayit: o, tarih: o.tarih, created: o.created })),
  ].sort(tarihSirasi);

  let bakiye = 0;
  return hareketler.map(({ tur, kayit }) => {
    const ucretMi = tur === "ucret";
    const tutar = ucretMi ? netTutar(kayit) : kayit.tutar;
    bakiye += ucretMi ? tutar : -tutar;
    const aciklama = ucretMi
      ? [kayit.aciklama, kayit.doktor && `· ${kayit.doktor}`, kayit.indirim ? `· ${paraGoster(kayit.indirim)} indirim` : ""].filter(Boolean).join(" ")
      : [`Ödeme (${YONTEMLER[kayit.yontem] || kayit.yontem})`, kayit.aciklama && `· ${kayit.aciklama}`].filter(Boolean).join(" ");
    const duzelt = ucretMi
      ? () => ucretPenceresiniAc({ hastaId: hasta.id, kayit })
      : () => odemePenceresiniAc({ hastaId: hasta.id, kayit });
    const silSorusu = `${tarihGoster(kayit.tarih)} tarihli ${paraGoster(tutar)} ${ucretMi ? "ücret" : "ödeme"} silinsin mi?`;
    return el("tr", { className: ucretMi ? "" : "odeme-satiri" },
      el("td", { className: "tarih" }, tarihGoster(kayit.tarih)),
      el("td", null, aciklama),
      el("td", { className: "sayi" }, ucretMi ? paraGoster(tutar) : ""),
      el("td", { className: "sayi" }, ucretMi ? "" : paraGoster(tutar)),
      kalanHucresi(bakiye),
      el("td", { className: "eylem yazdirma-gizli" },
        ikonDugmesi(IKON_KALEM, "Düzelt", duzelt),
        ikonDugmesi(IKON_COP, "Sil", () => onaylaVeSil(ucretMi ? "tahakkuklar" : "odemeler", kayit, silSorusu))),
    );
  });
}

function hesabiCiz() {
  const hasta = hastaBul(acikHesapId);
  if (!hasta) return;
  document.getElementById("hesap-basligi").textContent = tamAd(hasta);
  document.getElementById("hesap-hasta-no").textContent = `Hasta No: ${hasta.hastaNo ?? "-"}`;
  const r = telefonu(hasta.id);
  document.getElementById("hesap-telefon").replaceChildren(...[
    r ? el("span", { className: "telefon-numara" }, telefonGoster(r)) : null,
    whatsappDugmesi(hasta),
    el("button", { type: "button", className: "dugme kucuk yazdirma-gizli", onclick: () => telefonPenceresiniAc(hasta.id) },
      r ? "Telefonu düzelt" : "+ Telefon ekle"),
  ].filter(Boolean));
  document.getElementById("hesap-panel-baglantisi").href = `../#hasta/${hasta.id}`;
  document.getElementById("ekstre-tarihi").textContent = `${tamAd(hasta)} · Hasta No ${hasta.hastaNo ?? "-"} · ${tarihGoster(bugununTarihi())}`;

  const o = hesapOzetleri().get(hasta.id) || BOS_OZET;
  ozetKutulari(document.getElementById("hesap-ozeti"), [
    { baslik: "Toplam ücret", deger: paraGoster(o.ucret) },
    { baslik: "Ödenen", deger: paraGoster(o.odenen), alt: o.sonOdeme ? `Son ödeme ${tarihGoster(o.sonOdeme)}` : "Ödeme yok" },
    { baslik: o.kalan < 0 ? "Avans (fazla ödeme)" : "Kalan borç", deger: paraGoster(Math.abs(o.kalan)), sinif: o.kalan > 0 ? "borc" : o.kalan < 0 ? "avans" : "" },
  ]);

  const { yapilan, planlanan } = ucretlendirilmemisIslemler(hasta);
  tabloyuDoldur(document.getElementById("ucretsiz-satirlari"), document.getElementById("ucretsiz-bos"),
    [...yapilan, ...planlanan].map((i) => ucretsizSatiri(hasta, i)));
  const planOzeti = document.getElementById("plan-ozeti");
  const planFiyatlari = planlanan.map(listeFiyati);
  planOzeti.hidden = !planlanan.length;
  planOzeti.textContent = `Planlanan ${planlanan.length} işlemin liste fiyatıyla tahmini tutarı: ${paraGoster(toplam(planFiyatlari, (f) => f || 0))}`
    + (planFiyatlari.some((f) => f === null) ? " (fiyatı olmayanlar hariç)" : "");

  hastaHatirlaticilariniCiz(hasta);

  tabloyuDoldur(document.getElementById("dokum-satirlari"), document.getElementById("dokum-bos"), dokumSatirlari(hasta));
}

function hesabiAc(id) {
  if (!hastaBul(id)) {
    bildir("Hasta bulunamadı.");
    location.hash = "";
    return false;
  }
  acikHesapId = id;
  hesabiCiz();
  return true;
}

document.getElementById("ucret-ekle").addEventListener("click", () => ucretPenceresiniAc({ hastaId: acikHesapId }));
document.getElementById("odeme-al").addEventListener("click", () => odemePenceresiniAc({ hastaId: acikHesapId }));
document.getElementById("hatirlatici-ekle").addEventListener("click", () => hatirlaticiPenceresiniAc({ hastaId: acikHesapId }));
document.getElementById("hesap-yazdir").addEventListener("click", () => window.print());
