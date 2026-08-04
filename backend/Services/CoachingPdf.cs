using QuestPDF.Fluent;
using QuestPDF.Helpers;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Membuat PDF transkrip percakapan coaching (sesi 1-on-1 / ruang tim).
public static class CoachingPdf
{
    public static byte[] Build(CoachingTranscript t)
    {
        return Document.Create(doc =>
        {
            doc.Page(page =>
            {
                page.Margin(36);
                page.Size(PageSizes.A4);
                page.DefaultTextStyle(x => x.FontSize(10));

                page.Header().Column(col =>
                {
                    col.Item().Text("Transkrip Coaching · MyGCS").FontSize(9).FontColor(Colors.Grey.Medium);
                    col.Item().Text(t.Judul).FontSize(15).SemiBold().FontColor(Colors.Green.Darken3);
                    foreach (var m in t.Meta)
                        col.Item().Text(m).FontSize(9).FontColor(Colors.Grey.Darken1);
                    col.Item().PaddingTop(6).LineHorizontal(1).LineColor(Colors.Grey.Lighten2);
                });

                page.Content().PaddingVertical(8).Column(col =>
                {
                    col.Spacing(9);
                    if (t.Pesan.Count == 0)
                    {
                        col.Item().Text("Belum ada pesan pada percakapan ini.").Italic().FontColor(Colors.Grey.Medium);
                        return;
                    }
                    foreach (var p in t.Pesan)
                    {
                        col.Item().Column(c =>
                        {
                            c.Item().Text(txt =>
                            {
                                txt.Span(p.Nama).SemiBold().FontColor(Colors.Green.Darken2);
                                txt.Span($"   {p.TglKirim:dd MMM yyyy HH:mm} WIB").FontSize(8).FontColor(Colors.Grey.Medium);
                            });
                            c.Item().Text(p.Isi).FontColor(Colors.Grey.Darken3);
                        });
                    }
                });

                page.Footer().AlignRight().Text(txt =>
                {
                    txt.DefaultTextStyle(x => x.FontSize(8).FontColor(Colors.Grey.Medium));
                    txt.Span("Halaman ");
                    txt.CurrentPageNumber();
                    txt.Span(" / ");
                    txt.TotalPages();
                });
            });
        }).GeneratePdf();
    }
}
