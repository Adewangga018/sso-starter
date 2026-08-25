using ClosedXML.Excel;
using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Export daftar Inventaris (hasil GetErpExportRowsAsync) ke .xlsx - read-only, tidak
// menyentuh database sama sekali, murni format ulang data yang sudah diambil.
public class AsetExportService
{
    public byte[] BuildExcel(IReadOnlyList<AsetErpDto> rows)
    {
        using var wb = new XLWorkbook();
        var ws = wb.Worksheets.Add("Inventaris Aset");

        string[] header = ["Kode", "No. Internal", "Nama", "Kategori", "Kelompok", "Lokasi", "PIC",
            "Qty", "Satuan", "Nilai Perolehan", "Nilai Buku", "Status", "Klasifikasi"];
        for (var i = 0; i < header.Length; i++) ws.Cell(1, i + 1).Value = header[i];
        ws.Row(1).Style.Font.Bold = true;
        ws.SheetView.FreezeRows(1);

        var r = 2;
        foreach (var a in rows)
        {
            ws.Cell(r, 1).Value = a.ObjectId;
            ws.Cell(r, 2).Value = a.NomorAset ?? "";
            ws.Cell(r, 3).Value = a.Nama ?? "";
            ws.Cell(r, 4).Value = a.Kategori ?? "";
            ws.Cell(r, 5).Value = a.Kelompok ?? "";
            ws.Cell(r, 6).Value = a.Lokasi ?? "";
            ws.Cell(r, 7).Value = a.PicSaatIni ?? "";
            if (a.Qty.HasValue) ws.Cell(r, 8).Value = a.Qty.Value;
            ws.Cell(r, 9).Value = a.Satuan ?? "";
            if (a.NilaiPerolehan.HasValue) ws.Cell(r, 10).Value = a.NilaiPerolehan.Value;
            if (a.NilaiBuku.HasValue) ws.Cell(r, 11).Value = a.NilaiBuku.Value;
            ws.Cell(r, 12).Value = a.Status ?? "";
            ws.Cell(r, 13).Value = a.Klasifikasi ?? "";
            r++;
        }
        ws.Range(2, 10, Math.Max(r - 1, 2), 11).Style.NumberFormat.Format = "#,##0";
        ws.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        wb.SaveAs(stream);
        return stream.ToArray();
    }
}
