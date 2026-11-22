using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GreenStore.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOtpCreatedIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_otp_created",
                table: "otp_challenges",
                column: "created_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_otp_created",
                table: "otp_challenges");
        }
    }
}
