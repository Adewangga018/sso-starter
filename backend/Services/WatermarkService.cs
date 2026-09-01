using SixLabors.Fonts;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Drawing;
using SixLabors.ImageSharp.Drawing.Processing;
using SixLabors.ImageSharp.Formats.Jpeg;
using SixLabors.ImageSharp.PixelFormats;
using SixLabors.ImageSharp.Processing;

namespace SsoBackend.Services;

// Membubuhkan watermark tanggal/jam ke foto bukti absen - dibubuhkan DI SERVER, BUKAN
// di app mobile, justru karena app/perangkat adalah pihak yang TIDAK dipercaya (bisa
// direkayasa dengan mengubah jam HP sebelum jepret). Teks watermark HARUS disusun
// caller dari data server (DateTime.UtcNow, bukan apa pun dari request klien) - lihat
// PersonalController.PostAbsensi. Diminta manajemen 2026-08-31: "watermark ... sesuai
// tanggal dan jam server", pelengkap deteksi mock-location yang sudah ada.
public class WatermarkService
{
    public byte[] Bubuhkan(byte[] fotoBytes, string baris1, string baris2)
    {
        using var image = Image.Load<Rgba32>(fotoBytes);

        var font = ResolveFont().CreateFont(Math.Max(16f, image.Width / 30f), FontStyle.Bold);
        var padding = Math.Max(10f, image.Width * 0.03f);
        var lineHeight = font.Size * 1.25f;
        var barHeight = lineHeight * 2 + padding;

        image.Mutate(ctx =>
        {
            ctx.Fill(
                Color.Black.WithAlpha(0.55f),
                new RectangularPolygon(0, image.Height - barHeight, image.Width, barHeight));

            var options = new RichTextOptions(font)
            {
                Origin = new PointF(padding, image.Height - barHeight + padding / 2),
                WrappingLength = image.Width - padding * 2,
                LineSpacing = 1.1f,
            };
            ctx.DrawText(options, $"{baris1}\n{baris2}", Color.White);
        });

        using var ms = new MemoryStream();
        image.SaveAsJpeg(ms, new JpegEncoder { Quality = 88 });
        return ms.ToArray();
    }

    // Beberapa font Windows umum, dengan fallback ke font pertama yang tersedia di
    // sistem - server produksi (IIS/Windows) maupun mesin dev sama-sama Windows,
    // tapi tetap dijaga agar tidak crash kalau nama font tak persis cocok.
    private static FontFamily ResolveFont()
    {
        foreach (var nama in new[] { "Segoe UI", "Arial", "Tahoma" })
        {
            if (SystemFonts.TryGet(nama, out var family)) return family;
        }
        return SystemFonts.Collection.Families.First();
    }
}
