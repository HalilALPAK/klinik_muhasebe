# Muhasebe uygulaması → Alpotech klinik sunucusu

> **Bu belge sunucudaki Claude için yazıldı.** Laptoptaki Claude yazdı (2026-11-19).
> Klinik paneliyle ilgili sözleşme `Klinik_app/SUNUCU-BAGLANTISI.md`'dir. Bu belge yalnızca muhasebe için gereken **ek** kısmı anlatır; ikisi çelişirse panel belgesi geçerlidir.
> Depoya gerçek hasta verisi, tutar, şifre ya da anahtar yazılmaz.

## 0. Özet: sunucuda yapılacaklar

1. Yeni göç dosyası **`3_muhasebe.js`**: §2'deki dört tablo. Taslak §5'te. Var olan göçler değiştirilmez. Dosya adı sırası sunucudaki son göçten sonra gelecek biçimde ayarlanmalı.
2. **Yayınlama:** Bu klasör `pb_public/muhasebe/` altına kopyalanır, böylece uygulama `http://<sunucu>:8091/muhasebe/` adresinden açılır.
   - `7-klinik-pocketbase.ps1` `pb_public`'i silip yeniden kopyaladığı için `muhasebe/` da o betiğe eklenmeli.
   - Kopyalanacaklar: `index.html`, `stil.css`, tüm `*.js`, `vendor/`.
   - Logo, panelin `pb_public/logo.png` dosyasından `../logo.png` olarak kullanılır.
3. **Yedek:** Yeni tablolar `pb_data` içinde olduğu için gece yedeğine kendiliğinden girer. Yine de bir kez kontrol edilmeli.
4. §6'daki denemeler gerçek PocketBase ile yapılmalı.

## 1. Mimari

```
Klinik bilgisayarları ──Edge──► http://<sunucu>:8091/            panel (pb_public)
                     ──Edge──► http://<sunucu>:8091/muhasebe/   muhasebe (pb_public/muhasebe)
                                         │
                              Klinik PocketBase :8091
                    hastalar (yalnız okur) · tahakkuklar · odemeler · giderler · fiyatlar
```

- **Aynı adres, aynı oturum:** Muhasebe panelle aynı adresten açılır. Oturum anahtarı `pocketbase_auth` de aynıdır; panelde giriş yapan kullanıcı muhasebeye ayrıca giriş yapmaz.
- **Rol yok:** Kullanıcının isteğiyle muhasebede rol ayrımı yok; `doktor` ve `sekreter` her şeyi görür ve yapar.
- **`hastalar` yalnızca okunur:** Muhasebe bu tabloya hiç `PATCH`/`POST` atmaz; `beklenenGuncelleme` kuralı buraya girmez. Hastanın adı, Hasta No'su ve `islemler` dizisi (ücretlendirilecek işlemler) buradan okunur.
- **Anlık güncelleme:** Muhasebe beş tabloya abone olur: `hastalar`, `tahakkuklar`, `odemeler`, `giderler`, `fiyatlar` (`subscribe("*")`).
- **Veri boyutu:** Bir klinik için veri küçüktür. Açılışta beş tablo `getFullList` ile çekilir, toplamlar tarayıcıda hesaplanır. Sunucuda özel uç (`/api/klinik/...`) **gerekmez**.

## 2. Tablolar

**Para kuralı:** Tüm tutarlar **kuruş cinsinden tam sayı**dır (1.250,50 ₺ = `125050`); kayan nokta yok. **Tarih kuralı:** `tarih` alanları `YYYY-AA-GG` metnidir; panelde `dogumTarihi`/`yapilmaTarihi` ile aynı biçimdir.

**Ortak erişim kuralı:** Beş işlemin (liste, görüntüleme, oluşturma, güncelleme, silme) hepsi `@request.auth.id != ""`. Girişsiz istek liste için boş döner, diğerleri reddedilir. `created`/`updated` otomatik alanlardır.

### `fiyatlar`

| Alan | Tür | Kural |
|---|---|---|
| `tedavi` | metin | zorunlu, en çok 200 karakter, **benzersiz** |
| `fiyat` | sayı (tam) | zorunlu, ≥ 1. Diş başına fiyat |
| `aktif` | bool | Pasif fiyat ücretlendirirken önerilmez |

### `tahakkuklar` (hastaya yazılan ücret)

| Alan | Tür | Kural |
|---|---|---|
| `hasta` | ilişki → `hastalar` | zorunlu, tek kayıt, `cascadeDelete: false` |
| `islemId` | metin | Panelde `hastalar.islemler[].id`. Serbest ücrette boş |
| `aciklama` | metin | Uygulama zorunlu tutar |
| `disler` | JSON | FDI numaraları; ücretlendirme anındaki kopya |
| `doktor` | metin | |
| `tutar` | sayı (tam) | zorunlu, ≥ 1 |
| `indirim` | sayı (tam) | ≥ 0; uygulama `indirim < tutar` diye kontrol eder |
| `tarih` | metin `YYYY-AA-GG` | zorunlu |

- **Benzersiz indeks:** `(hasta, islemId)`, yalnızca `islemId != ''` olanlarda. Aynı işlem iki bilgisayardan aynı anda ücretlendirilirse biri **400** almalı.
  - Uygulama, cevabın `data` alanlarından herhangi birinde `code = "validation_not_unique"` arar ve "Bu işlem zaten ücretlendirilmiş" der. Bu yüzden 400 cevabında bu kod **olmalı**.
- **Bakiye saklanmaz:** `Σ(tutar − indirim) − Σ odemeler.tutar` ile hesaplanır.

### `odemeler`

| Alan | Tür | Kural |
|---|---|---|
| `hasta` | ilişki → `hastalar` | zorunlu, `cascadeDelete: false` |
| `tutar` | sayı (tam) | zorunlu, ≥ 1 |
| `yontem` | seçim | `nakit`, `kart`, `havale`; zorunlu |
| `tarih` | metin `YYYY-AA-GG` | zorunlu |
| `aciklama` | metin | |

### `giderler`

| Alan | Tür | Kural |
|---|---|---|
| `kategori` | seçim | `kira`, `malzeme`, `laboratuvar`, `maas`, `fatura`, `vergi`, `diger`; zorunlu |
| `tutar` | sayı (tam) | zorunlu, ≥ 1 |
| `yontem` | seçim | `nakit`, `kart`, `havale`; zorunlu |
| `tarih` | metin `YYYY-AA-GG` | zorunlu |
| `aciklama` | metin | |

## 3. Uygulamanın dayandığı ayrıntılar

- **Sıralama:** Liste istekleri `sort` ile gelir: `hastalar` → `hastaNo`; `tahakkuklar`, `odemeler`, `giderler` → `tarih,created`; `fiyatlar` → `tedavi`. Filtre kullanılmaz.
- **Silme:** Muhasebe kayıtları her kullanıcı tarafından düzeltilip silinebilir. Silinmiş kayda gelen istekte 404 beklenir; uygulama bunu "başka bilgisayarda silinmiş" sayar.
- **Hasta silme:** Yalnızca yönetici hasta siler. `cascadeDelete: false` olduğundan, ücret ya da ödemesi olan hasta silinemez. Bu bilerek böyle: muhasebe kaydı hastayla birlikte kaybolmamalı. Silmek gerekirse önce muhasebe kayıtları silinir.
- **Kim yaptı:** Kayıtlarda "kim girdi" alanı yok. KVKK ve denetim için değişiklik kaydı (audit) ileride sunucuda eklenecekse, muhasebe tabloları da kapsama alınmalı. Panelin buna hazırlık yapması gerekmiyor.
- **Eşzamanlı düzeltme:** Muhasebe kayıtları tek tek satırlar olduğu için `beklenenGuncelleme` kullanılmaz. Aynı ödemeyi iki kişi aynı anda düzeltirse son kaydeden geçerli olur; diğer ekran anlık güncellenir. Bu kabul edildi.

## 4. Laptopta yapılan deneme

Laptopta PocketBase çalıştırılamadığı için uygulama, bu sözleşmeyi taklit eden bir Python test sunucusuna karşı Playwright ile iki tarayıcı oturumunda (doktor + sekreter) denendi: **60/60 kontrol geçti.** Denenenler:

- Giriş, yanlış şifre, "Beni hatırla" (işaretsizde yeni sekme giriş ister), panelle ortak oturum, çıkış.
- **Fiyat listesi:** fiyatı olmayan tedavilerin önerilmesi, ekleme, aynı adın büyük/küçük harf farkıyla reddedilmesi, geçersiz tutar.
- **Ücretlendirme:**
  - Liste fiyatı × diş sayısı önerisi; diğer bilgisayarda eklenen fiyat anlık geliyor.
  - İndirim kuralları.
  - Aynı işlemi iki bilgisayarın aynı anda ücretlendirmesi: ikincisi reddedildi, yazdığı formda kaldı. Sunucu da 400 `validation_not_unique` döndü.
- **Ödeme:** ekleme ve düzeltme, yürüyen bakiye, diğer ekranda anlık bakiye, borçlu süzgeci, TC ile arama.
- **Kasa:** günlük tahsilat ve gider, yönteme göre toplamlar, gün değiştirme, gider silme.
- **Raporlar:** dönem toplamları, doktora ve kategoriye göre dağılım, aylık özet, borçlu hastalar, özel aralık.
- **Panelden gelen işlem:** Panelde eklenen işlem muhasebede anlık göründü; küçük harfle yazılmış tedavi adı için de fiyat bulundu.
- **Sunucu kapanınca:** kırmızı bant çıktı, pencere açık kaldı, yazılan kaybolmadı; bağlantı gelince kaydedildi.
- Dar ekranda (390 px) yatay taşma yok.

## 5. `3_muhasebe.js` taslağı (PocketBase v0.40 JS göçü)

Gerçek PocketBase'de denenmedi. Sunucudaki Claude kendi göçlerinin biçimine uydurup `test-klinik.mjs` benzeri bir denemeyle sınamalı.

```js
/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const girisli = '@request.auth.id != ""';
  const kurallar = { listRule: girisli, viewRule: girisli, createRule: girisli, updateRule: girisli, deleteRule: girisli };
  const hastalar = app.findCollectionByNameOrId("hastalar");
  const zaman = [
    { type: "autodate", name: "created", onCreate: true, onUpdate: false },
    { type: "autodate", name: "updated", onCreate: true, onUpdate: true },
  ];
  const tarih = { type: "text", name: "tarih", required: true, pattern: "^\\d{4}-\\d{2}-\\d{2}$" };
  const tutar = { type: "number", name: "tutar", required: true, onlyInt: true, min: 1 };
  const yontem = { type: "select", name: "yontem", required: true, maxSelect: 1, values: ["nakit", "kart", "havale"] };
  const hasta = { type: "relation", name: "hasta", required: true, collectionId: hastalar.id, maxSelect: 1, cascadeDelete: false };

  app.save(new Collection({
    type: "base", name: "fiyatlar", ...kurallar,
    fields: [
      { type: "text", name: "tedavi", required: true, max: 200 },
      { type: "number", name: "fiyat", required: true, onlyInt: true, min: 1 },
      { type: "bool", name: "aktif" },
      ...zaman,
    ],
    indexes: ["CREATE UNIQUE INDEX idx_fiyatlar_tedavi ON fiyatlar (tedavi)"],
  }));

  app.save(new Collection({
    type: "base", name: "tahakkuklar", ...kurallar,
    fields: [
      hasta,
      { type: "text", name: "islemId", max: 64 },
      { type: "text", name: "aciklama", max: 500 },
      { type: "json", name: "disler", maxSize: 2000 },
      { type: "text", name: "doktor", max: 200 },
      tutar,
      { type: "number", name: "indirim", onlyInt: true, min: 0 },
      tarih,
      ...zaman,
    ],
    indexes: [
      "CREATE UNIQUE INDEX idx_tahakkuk_islem ON tahakkuklar (hasta, islemId) WHERE islemId != ''",
      "CREATE INDEX idx_tahakkuk_hasta ON tahakkuklar (hasta)",
      "CREATE INDEX idx_tahakkuk_tarih ON tahakkuklar (tarih)",
    ],
  }));

  app.save(new Collection({
    type: "base", name: "odemeler", ...kurallar,
    fields: [hasta, tutar, yontem, tarih, { type: "text", name: "aciklama", max: 500 }, ...zaman],
    indexes: [
      "CREATE INDEX idx_odeme_hasta ON odemeler (hasta)",
      "CREATE INDEX idx_odeme_tarih ON odemeler (tarih)",
    ],
  }));

  app.save(new Collection({
    type: "base", name: "giderler", ...kurallar,
    fields: [
      { type: "select", name: "kategori", required: true, maxSelect: 1,
        values: ["kira", "malzeme", "laboratuvar", "maas", "fatura", "vergi", "diger"] },
      tutar, yontem, tarih, { type: "text", name: "aciklama", max: 500 }, ...zaman,
    ],
    indexes: ["CREATE INDEX idx_gider_tarih ON giderler (tarih)"],
  }));
}, (app) => {
  for (const ad of ["giderler", "odemeler", "tahakkuklar", "fiyatlar"]) {
    app.delete(app.findCollectionByNameOrId(ad));
  }
});
```

**Dikkat edilecekler:**
- `(hasta, islemId)` kısmi benzersiz indeksi ihlal edilince PocketBase'in 400 cevabında `data` içinde `validation_not_unique` kodunun geldiği doğrulanmalı (§2).
  - Gelmezse, `onRecordCreateRequest` kancasında aynı kontrol yapılıp `BadRequestError` ile `{ islemId: { code: "validation_not_unique" } }` döndürülmeli.
- `number` alanında `required: true`, 0 değerini de reddeder. `indirim` bu yüzden zorunlu değildir.

## 6. Gerçek sunucuda denenecekler

1. Panelde giriş yapıp `/muhasebe/` adresini açınca yeniden giriş istenmemeli.
2. Fiyat ekleme; aynı tedavi adı ikinci kez → 400 `validation_not_unique`.
3. Bir işlemi ücretlendirme. Aynı `hasta` + `islemId` ile ikinci `POST` → 400 `validation_not_unique`. `islemId` boşken iki serbest ücret → ikisi de kabul edilmeli.
4. Ödeme ekleme, düzeltme, silme; iki pencerede anlık güncelleme.
5. Gider ekleme, silme.
6. `tutar: 0`, `tutar: 12.5`, geçersiz `yontem`, `tarih: "19.11.2026"` → 400.
7. Girişsiz `GET /api/collections/odemeler/records` → boş liste; girişsiz `POST` → reddedilmeli.
8. Ücreti olan bir hastayı yönetici panelinden silmeye çalışınca → reddedilmeli (`cascadeDelete: false`).
9. Gece yedeğinde yeni tabloların bulunduğu.

## 7. Laptop tarafında bekleyenler

- Kullanıcı isterse klinik paneline "Muhasebe" bağlantısı (`/muhasebe/`) eklenecek. Bu, `Klinik_app` deposunda ayrı bir değişikliktir.
- Kullanıcı isterse kurulum betiğine ikinci bir masaüstü simgesi (Alpotech Muhasebe) eklenecek.
