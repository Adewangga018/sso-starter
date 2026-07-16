using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SsoBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddLocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "Accuracy",
                table: "attendances",
                type: "decimal(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "locations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Nama = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Lat = table.Column<decimal>(type: "decimal(10,7)", precision: 10, scale: 7, nullable: false),
                    Lng = table.Column<decimal>(type: "decimal(11,7)", precision: 11, scale: 7, nullable: false),
                    RadiusMeters = table.Column<double>(type: "float", nullable: false),
                    Aktif = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_locations", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_locations_Aktif",
                table: "locations",
                column: "Aktif");

            // Kantor pusat: satu-satunya titik geofence sebelumnya (hardcode di
            // PersonalController/AbsensiKamera). Diseed di sini supaya HQ tidak pernah
            // "hilang" begitu hardcode dicabut; lokasi lain ditambahkan lewat panel admin.
            migrationBuilder.InsertData(
                table: "locations",
                columns: new[] { "Nama", "Lat", "Lng", "RadiusMeters", "Aktif", "CreatedAt", "UpdatedAt" },
                values: new object[]
                {
                    "Kantor Pusat PT. Gresik Cipta Sejahtera",
                    -7.160356123699222m,
                    112.63249083138189m,
                    150.0,
                    true,
                    DateTime.UtcNow,
                    DateTime.UtcNow,
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "locations");

            migrationBuilder.DropColumn(
                name: "Accuracy",
                table: "attendances");
        }
    }
}
