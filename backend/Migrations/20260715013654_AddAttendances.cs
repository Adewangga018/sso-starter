using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SsoBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddAttendances : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "attendances",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    KodePegawai = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    NamaPegawai = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Tanggal = table.Column<DateOnly>(type: "date", nullable: false),
                    NamaHari = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    CheckIn = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    CheckOut = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    CatatanMangkir = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    Foto = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    Lat = table.Column<decimal>(type: "decimal(10,7)", precision: 10, scale: 7, nullable: false),
                    Lng = table.Column<decimal>(type: "decimal(11,7)", precision: 11, scale: 7, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    Tempat = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_attendances", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_attendances_KodePegawai_Tanggal",
                table: "attendances",
                columns: new[] { "KodePegawai", "Tanggal" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "attendances");
        }
    }
}
