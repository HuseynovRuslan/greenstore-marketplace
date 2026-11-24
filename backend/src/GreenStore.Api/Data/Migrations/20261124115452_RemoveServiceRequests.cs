using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GreenStore.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveServiceRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // «Usta çağır» is removed (docs/handoff/remove-usta-cagir.md). Its SMS notices were the only "sms-notice"
            // outbox messages; the dispatcher no longer knows the type, so unsent ones go with the tables.
            migrationBuilder.Sql("DELETE FROM outbox WHERE type = 'sms-notice';");

            migrationBuilder.DropTable(
                name: "service_request_recipients");

            migrationBuilder.DropTable(
                name: "service_requests");

            migrationBuilder.DropSequence(
                name: "service_request_number_seq");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "service_request_number_seq",
                startValue: 3001L);

            migrationBuilder.CreateTable(
                name: "service_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    category_id = table.Column<string>(type: "text", nullable: false),
                    city_id = table.Column<string>(type: "text", nullable: false),
                    listing_id = table.Column<Guid>(type: "uuid", nullable: true),
                    area = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    customer_name = table.Column<string>(type: "text", nullable: false),
                    customer_phone = table.Column<string>(type: "text", nullable: false),
                    customer_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    description = table.Column<string>(type: "text", nullable: false),
                    ip_hash = table.Column<byte[]>(type: "bytea", nullable: true),
                    number = table.Column<long>(type: "bigint", nullable: false, defaultValueSql: "nextval('service_request_number_seq')"),
                    preferred_date = table.Column<DateOnly>(type: "date", nullable: true),
                    size = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'new'")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_service_requests", x => x.id);
                    table.CheckConstraint("ck_service_requests_area", "char_length(area) <= 80");
                    table.CheckConstraint("ck_service_requests_customer_name", "char_length(customer_name) <= 60");
                    table.CheckConstraint("ck_service_requests_customer_phone", "customer_phone ~ '^\\+994[0-9]{9}$'");
                    table.CheckConstraint("ck_service_requests_description", "char_length(description) <= 1000");
                    table.CheckConstraint("ck_service_requests_size", "char_length(size) <= 40");
                    table.CheckConstraint("ck_service_requests_status", "status IN ('new', 'sent', 'closed', 'spam')");
                    table.ForeignKey(
                        name: "fk_service_requests_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_service_requests_cities_city_id",
                        column: x => x.city_id,
                        principalTable: "cities",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_service_requests_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "listings",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_service_requests_users_customer_user_id",
                        column: x => x.customer_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "service_request_recipients",
                columns: table => new
                {
                    request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    provider_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    notified_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_service_request_recipients", x => new { x.request_id, x.provider_user_id });
                    table.ForeignKey(
                        name: "fk_service_request_recipients_service_requests_request_id",
                        column: x => x.request_id,
                        principalTable: "service_requests",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_service_request_recipients_users_provider_user_id",
                        column: x => x.provider_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "ux_service_requests_number",
                table: "service_requests",
                column: "number",
                unique: true);
        }
    }
}
