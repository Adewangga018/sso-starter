using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SsoBackend.Migrations
{
    /// <inheritdoc />
    public partial class AddModuleCustomFieldsAndLogo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "module_access",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "CreatedBy",
                table: "module_access",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Icon",
                table: "module_access",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsCustom",
                table: "module_access",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Label",
                table: "module_access",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LogoPath",
                table: "module_access",
                type: "nvarchar(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Subtitle",
                table: "module_access",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "module_access");

            migrationBuilder.DropColumn(
                name: "CreatedBy",
                table: "module_access");

            migrationBuilder.DropColumn(
                name: "Icon",
                table: "module_access");

            migrationBuilder.DropColumn(
                name: "IsCustom",
                table: "module_access");

            migrationBuilder.DropColumn(
                name: "Label",
                table: "module_access");

            migrationBuilder.DropColumn(
                name: "LogoPath",
                table: "module_access");

            migrationBuilder.DropColumn(
                name: "Subtitle",
                table: "module_access");
        }
    }
}
