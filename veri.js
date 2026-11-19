"use strict";

/*
 * Sunucudaki tabloların bellekteki kopyası. Bir klinik için veri küçük olduğu için
 * açılışta hepsi çekilir, sonra anlık olaylarla güncel tutulur; toplamlar burada hesaplanır.
 * hastalar tablosu yalnızca okunur: hasta ekleme/düzeltme klinik panelindedir.
 */

const veri = { hastalar: [], tahakkuklar: [], odemeler: [], giderler: [], fiyatlar: [] };
const KOLEKSIYONLAR = Object.keys(veri);
const SIRALAMA = {
  hastalar: "hastaNo",
  tahakkuklar: "tarih,created",
  odemeler: "tarih,created",
  giderler: "tarih,created",
  fiyatlar: "tedavi",
};

const YONTEMLER = { nakit: "Nakit", kart: "Kart", havale: "Havale / EFT" };
const KATEGORILER = {
  kira: "Kira",
  malzeme: "Malzeme",
  laboratuvar: "Laboratuvar",
  maas: "Maaş / SGK",
  fatura: "Fatura (elektrik, su, internet)",
  vergi: "Vergi / muhasebeci",
  diger: "Diğer",
};

// Ekranı yeniden çizen işlev (uygulama.js atar)
let veriDegistiIsleyicisi = () => {};

async function veriyiYukle() {
  const sonuclar = await Promise.all(KOLEKSIYONLAR.map((k) => (
    istek(() => pb.collection(k).getFullList({ sort: SIRALAMA[k] }))
  )));
  KOLEKSIYONLAR.forEach((k, i) => {
    veri[k] = sonuclar[i];
  });
}

function veriyiBosalt() {
  KOLEKSIYONLAR.forEach((k) => {
    veri[k] = [];
  });
}

// Daha eski bir sürüm (geç gelen anlık olay) yenisinin üstüne yazılmaz
function onbellegeKoy(koleksiyon, kayit) {
  const liste = veri[koleksiyon];
  const sira = liste.findIndex((x) => x.id === kayit.id);
  if (sira < 0) liste.push(kayit);
  else if (liste[sira].updated <= kayit.updated) liste[sira] = kayit;
  else return false;
  return true;
}

function onbellektenSil(koleksiyon, id) {
  const once = veri[koleksiyon].length;
  veri[koleksiyon] = veri[koleksiyon].filter((x) => x.id !== id);
  return veri[koleksiyon].length !== once;
}

function anlikOlay(koleksiyon, { action, record }) {
  const degisti = action === "delete" ? onbellektenSil(koleksiyon, record.id) : onbellegeKoy(koleksiyon, record);
  if (degisti) veriDegistiIsleyicisi(koleksiyon);
}

/* Kaydetme: sunucuya yazar, cevabı hemen önbelleğe koyar (anlık olay da gelir, ikisi çakışmaz) */

async function kaydet(koleksiyon, id, alanlar) {
  const kayit = await istek(() => (id
    ? pb.collection(koleksiyon).update(id, alanlar)
    : pb.collection(koleksiyon).create(alanlar)));
  onbellegeKoy(koleksiyon, kayit);
  veriDegistiIsleyicisi(koleksiyon);
  return kayit;
}

async function sil(koleksiyon, id) {
  try {
    await istek(() => pb.collection(koleksiyon).delete(id));
  } catch (hata) {
    if (hata.status !== 404) throw hata; // başka bilgisayarda zaten silinmiş
  }
  onbellektenSil(koleksiyon, id);
  veriDegistiIsleyicisi(koleksiyon);
}

/* Sorgular */

const hastaBul = (id) => veri.hastalar.find((h) => h.id === id);
const hastaninIslemleri = (hasta) => (hasta && hasta.islemler) || [];
const netTutar = (t) => t.tutar - (t.indirim || 0);
const tarihAraliginda = (kayit, bas, bit) => kayit.tarih >= bas && kayit.tarih <= bit;

// Kayıtları tarih, aynı günde oluşturulma sırasıyla dizer
const tarihSirasi = (a, b) => a.tarih.localeCompare(b.tarih) || (a.created || "").localeCompare(b.created || "");

// hastaId → { ucret, odenen, kalan, sonOdeme }
function hesapOzetleri() {
  const ozet = new Map();
  const al = (id) => {
    if (!ozet.has(id)) ozet.set(id, { ucret: 0, odenen: 0, kalan: 0, sonOdeme: "" });
    return ozet.get(id);
  };
  for (const t of veri.tahakkuklar) al(t.hasta).ucret += netTutar(t);
  for (const o of veri.odemeler) {
    const h = al(o.hasta);
    h.odenen += o.tutar;
    if (o.tarih > h.sonOdeme) h.sonOdeme = o.tarih;
  }
  for (const h of ozet.values()) h.kalan = h.ucret - h.odenen;
  return ozet;
}

const BOS_OZET = { ucret: 0, odenen: 0, kalan: 0, sonOdeme: "" };

// Tedavi adıyla fiyat bulur (Türkçe küçük harf, ı = i); yalnızca aktif fiyatlar
function fiyatBul(tedavi) {
  const aranan = kucult(tedavi);
  return veri.fiyatlar.find((f) => f.aktif && kucult(f.tedavi) === aranan) || null;
}

// Paneldeki işlemlerden ve fiyat listesinden bilinen tedavi adları (tekrarsız)
function bilinenTedaviler() {
  const adlar = new Map();
  for (const f of veri.fiyatlar) adlar.set(kucult(f.tedavi), f.tedavi);
  for (const h of veri.hastalar) {
    for (const i of hastaninIslemleri(h)) if (i.tedavi && !adlar.has(kucult(i.tedavi))) adlar.set(kucult(i.tedavi), i.tedavi);
  }
  return [...adlar.values()].sort((a, b) => a.localeCompare(b, "tr"));
}

function bilinenDoktorlar() {
  const adlar = new Set();
  for (const h of veri.hastalar) for (const i of hastaninIslemleri(h)) if (i.doktor) adlar.add(i.doktor);
  for (const t of veri.tahakkuklar) if (t.doktor) adlar.add(t.doktor);
  return [...adlar].sort((a, b) => a.localeCompare(b, "tr"));
}
