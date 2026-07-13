using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SsoBackend.Migrations
{
    /// <inheritdoc />
    public partial class AuditLogsImmutability : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Enforce append-only at the database level (SRS KF-D-03): block any UPDATE or
            // DELETE against AuditLogs, even from the application account. Rows can only be
            // inserted, so the trail is tamper-evident regardless of app-layer bugs.
            migrationBuilder.Sql(
                "IF OBJECT_ID('dbo.TR_AuditLogs_AppendOnly', 'TR') IS NOT NULL DROP TRIGGER dbo.TR_AuditLogs_AppendOnly;");
            migrationBuilder.Sql(@"
CREATE TRIGGER TR_AuditLogs_AppendOnly
ON AuditLogs
INSTEAD OF UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    RAISERROR('AuditLogs bersifat append-only: UPDATE/DELETE tidak diizinkan.', 16, 1);
END;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP TRIGGER IF EXISTS TR_AuditLogs_AppendOnly;");
        }
    }
}
