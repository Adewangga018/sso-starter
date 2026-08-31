using System.Text.Json;
using System.Text.Json.Serialization;

namespace SsoBackend.Services;

// Ubah koordinat (lat,lng) jadi alamat terbaca ("Jalan, Kec. X, Kota Y, Provinsi Z") lewat
// OpenStreetMap Nominatim - gratis, tanpa API key/billing (beda dari Google Maps Geocoding
// API yang wajib akun berbayar). Dipanggil SEKALI saat karyawan mengajukan/Admin SDM
// menetapkan titik absen (bukan tiap kali halaman "Kelola Lokasi Absensi" dibuka) - selain
// lebih cepat, ini juga menghormati batas pemakaian gratis Nominatim (maks ~1 request/detik,
// wajib User-Agent yang jelas - lihat https://operations.osmfoundation.org/policies/nominatim/).
public class ReverseGeocodingService
{
    private readonly HttpClient _http;
    private readonly ILogger<ReverseGeocodingService> _logger;

    public ReverseGeocodingService(HttpClient http, ILogger<ReverseGeocodingService> logger)
    {
        _http = http;
        _logger = logger;
    }

    public async Task<string?> ResolveAsync(decimal lat, decimal lng)
    {
        try
        {
            var url = $"reverse?format=jsonv2&lat={lat}&lon={lng}&zoom=18&addressdetails=1&accept-language=id";
            using var res = await _http.GetAsync(url);
            if (!res.IsSuccessStatusCode) return null;

            var json = await res.Content.ReadFromJsonAsync<NominatimResponse>();
            var a = json?.Address;
            if (a is null) return null;

            // Jalan -> Kelurahan/Desa -> Kecamatan -> Kota/Kabupaten -> Provinsi. Penandaan
            // level administratif OSM utk Indonesia tidak selalu lengkap (mis. field
            // city_district sering kosong) - tiap bagian yang kosong otomatis dilewati.
            var jalan = a.Road ?? a.Neighbourhood;
            var kelurahan = a.Village ?? a.Suburb ?? a.Hamlet;
            var kecamatan = a.CityDistrict;
            var kota = a.City ?? a.Town ?? a.Regency ?? a.County;
            var provinsi = a.State;

            var bagian = new[]
            {
                jalan,
                kelurahan,
                string.IsNullOrWhiteSpace(kecamatan) ? null : $"Kec. {kecamatan}",
                kota,
                provinsi,
            }.Where(s => !string.IsNullOrWhiteSpace(s));

            var hasil = string.Join(", ", bagian);
            return string.IsNullOrWhiteSpace(hasil) ? json?.DisplayName : hasil;
        }
        catch (Exception ex)
        {
            // Non-fatal - pengajuan/penetapan titik tetap jalan tanpa alamat otomatis kalau
            // Nominatim sedang tidak bisa diakses.
            _logger.LogWarning(ex, "Reverse geocoding gagal untuk {Lat},{Lng}", lat, lng);
            return null;
        }
    }

    private class NominatimResponse
    {
        [JsonPropertyName("display_name")]
        public string? DisplayName { get; set; }

        [JsonPropertyName("address")]
        public NominatimAddress? Address { get; set; }
    }

    private class NominatimAddress
    {
        [JsonPropertyName("road")]
        public string? Road { get; set; }

        [JsonPropertyName("neighbourhood")]
        public string? Neighbourhood { get; set; }

        [JsonPropertyName("suburb")]
        public string? Suburb { get; set; }

        [JsonPropertyName("village")]
        public string? Village { get; set; }

        [JsonPropertyName("hamlet")]
        public string? Hamlet { get; set; }

        [JsonPropertyName("city_district")]
        public string? CityDistrict { get; set; }

        [JsonPropertyName("city")]
        public string? City { get; set; }

        [JsonPropertyName("town")]
        public string? Town { get; set; }

        [JsonPropertyName("regency")]
        public string? Regency { get; set; }

        [JsonPropertyName("county")]
        public string? County { get; set; }

        [JsonPropertyName("state")]
        public string? State { get; set; }
    }
}
