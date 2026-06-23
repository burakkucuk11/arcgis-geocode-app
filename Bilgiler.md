# Proje Bilgileri: ArcGIS JS SDK ile Geocoding Uygulaması

## Amaç

ArcGIS Maps SDK for JavaScript kullanılarak çalışan bir web uygulaması geliştirilecek. Uygulamanın amacı, kullanıcının yüklediği Excel veya CSV dosyasındaki adres verilerini Esri Geocoding servisi ile koordinata çevirmek, sonuçları haritada nokta olarak göstermek, tablo halinde listelemek ve çıktı olarak dışa aktarabilmektir.

## Kullanılacak Teknolojiler

* ArcGIS Maps SDK for JavaScript
* Esri Geocoding Service
* ArcGIS API Key / Developer Key
* JavaScript
* HTML / CSS
* Excel ve CSV okuma için uygun kütüphane

  * XLSX.js kullanılabilir
* Shapefile export için uygun JavaScript kütüphanesi

  * shp-write veya benzeri
* KML export için uygun JavaScript üretimi

## Temel Gereksinimler

Uygulamada kullanıcı Excel veya CSV dosyası yükleyebilmelidir.

Yüklenen dosyada adres alanı seçilebilmelidir. Örneğin:

* Mahalle
* Cadde / Sokak
* Kapı No
* İlçe
* İl
* Tam adres alanı

Eğer dosyada adres parçaları ayrı kolonlardaysa kullanıcı bu kolonları seçerek tek bir geocode adresi oluşturabilmelidir.

Örnek adres formatı:

Mahalle + Cadde/Sokak + Kapı No + İlçe + İl

## Geocoding İşlemi

Uygulama, seçilen adres bilgisini Esri Geocoding servisine göndermelidir.

Geocoding işlemi için benim Esri Developer API Key değerim kullanılacaktır.

API key kod içinde kolay değiştirilebilir bir değişken olarak tutulmalıdır.

Her satır için geocoding sonucu alınmalıdır.

Geocoding sonucunda şu bilgiler saklanmalıdır:

* X koordinatı
* Y koordinatı
* Match address
* Score
* Status
* Orijinal satırdaki tüm attribute bilgileri

Geocode başarısız olursa ilgili satır tabloda başarısız olarak işaretlenmelidir.

## Harita Gösterimi

Geocode edilen başarılı kayıtlar haritada point olarak gösterilmelidir.

Harita ArcGIS Maps SDK for JavaScript MapView ile oluşturulmalıdır.

Basemap olarak varsayılan olarak "streets-vector" veya "topo-vector" kullanılabilir.

Noktalar haritada anlaşılır bir semboloji ile gösterilmelidir.

Harita, geocode edilen noktaların extent'ine otomatik zoom yapmalıdır.

## Popup / Attribute Görüntüleme

Haritadaki herhangi bir noktaya tıklandığında popup açılmalıdır.

Popup içinde yüklenen Excel/CSV dosyasındaki tüm attribute bilgileri görüntülenmelidir.

Ayrıca geocoding sonucu gelen bilgiler de gösterilmelidir:

* Match address
* Score
* Latitude
* Longitude
* Status

## Tablo Görünümü

Haritanın altında veya yanında bir attribute table bulunmalıdır.

Bu tabloda yüklenen dosyadaki tüm kayıtlar listelenmelidir.

Tabloda şu bilgiler bulunmalıdır:

* Orijinal kolonlar
* Latitude
* Longitude
* Match address
* Score
* Geocode status

Tabloda bir satıra tıklanınca haritadaki ilgili nokta seçilmeli ve harita o noktaya zoom yapmalıdır.

Haritadaki noktaya tıklanınca tablodaki ilgili satır da vurgulanmalıdır.

Tablo arama ve filtreleme desteklemelidir.

Özellikle şu filtreler olmalıdır:

* Başarılı geocode edilenler
* Başarısız olanlar
* Düşük score değerine sahip olanlar

## Dışa Aktarma Özellikleri

Kullanıcı geocode edilmiş verileri dışa aktarabilmelidir.

Desteklenecek çıktı formatları:

* CSV
* KML
* Shapefile `.shp`

Shapefile çıktısında tüm attribute bilgileri korunmalıdır.

KML çıktısında her nokta placemark olarak oluşturulmalı ve attribute bilgileri description içinde yer almalıdır.

CSV çıktısında orijinal verilerle birlikte latitude, longitude, match address, score ve status alanları bulunmalıdır.

## Arayüz Beklentisi

Uygulama sade ama modern bir arayüze sahip olmalıdır.

Arayüzde şu bileşenler bulunmalıdır:

* Dosya yükleme alanı
* Adres kolonu seçme alanı
* Geocode başlat butonu
* İşlem ilerleme durumu
* Harita alanı
* Attribute table
* Export butonları

  * CSV indir
  * KML indir
  * SHP indir

## Hata Yönetimi

Uygulama aşağıdaki durumlarda kullanıcıya anlaşılır uyarı vermelidir:

* Dosya yüklenmemişse
* Adres kolonu seçilmemişse
* API key eksikse
* Geocoding servisi hata dönerse
* Dosyada uygun veri yoksa
* Export sırasında hata oluşursa

## Performans

Çok sayıda adres geocode edilirken uygulama donmamalıdır.

Geocoding işlemi satır satır ilerlemeli ve kullanıcıya yüzde veya sayaç olarak ilerleme gösterilmelidir.

Örnek:

125 / 500 adres işlendi

Mümkünse rate limit sorunlarını azaltmak için istekler kontrollü gönderilmelidir.

## Beklenen Çıktı

Bana bu proje için çalışan bir başlangıç uygulaması oluştur.

Kodlar temiz, okunabilir ve geliştirilebilir olsun.

Dosya yapısı önerisi:

* index.html
* src/main.js
* src/style.css
* package.json

Gerekirse Vite kullanılabilir.

Uygulama lokal ortamda npm install ve npm run dev ile çalıştırılabilir olmalıdır.

## Önemli Not

Bu proje ArcGIS Maps SDK for JavaScript üzerinden geliştirilecek. Leaflet, OpenLayers veya Google Maps kullanılmayacak.

Geocoding işlemi Esri servisleri üzerinden yapılacak.

Kod içerisinde API key için şu şekilde bir alan bırak:

const ESRI_API_KEY = "BURAYA_API_KEY_GELECEK";
