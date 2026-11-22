using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GreenStore.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddReportsRequestsSupport : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "service_request_number_seq",
                startValue: 3001L);

            migrationBuilder.CreateSequence(
                name: "support_ticket_seq",
                startValue: 1001L);

            migrationBuilder.CreateTable(
                name: "reports",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_kind = table.Column<string>(type: "text", nullable: false),
                    listing_id = table.Column<Guid>(type: "uuid", nullable: true),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reason_code = table.Column<string>(type: "text", nullable: false),
                    comment = table.Column<string>(type: "text", nullable: true),
                    reporter_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    reporter_ip_hash = table.Column<byte[]>(type: "bytea", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'open'"),
                    resolution = table.Column<string>(type: "text", nullable: true),
                    handled_by = table.Column<Guid>(type: "uuid", nullable: true),
                    handled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reports", x => x.id);
                    table.CheckConstraint("ck_reports_comment", "char_length(comment) <= 500");
                    table.CheckConstraint("ck_reports_one_target", "num_nonnulls(listing_id, seller_id) = 1");
                    table.CheckConstraint("ck_reports_other_has_comment", "reason_code <> 'other' OR comment IS NOT NULL");
                    table.CheckConstraint("ck_reports_reason_code", "reason_code IN ('sold', 'wrong-price', 'wrong-photos', 'wrong-info', 'unreachable', 'duplicate', 'fraud', 'misconduct', 'not-provided', 'stolen-photos', 'other')");
                    table.CheckConstraint("ck_reports_resolution", "resolution IN ('action-taken', 'no-violation')");
                    table.CheckConstraint("ck_reports_resolved_has_resolution", "status <> 'resolved' OR resolution IS NOT NULL");
                    table.CheckConstraint("ck_reports_seller_target", "(target_kind = 'seller') = (seller_id IS NOT NULL)");
                    table.CheckConstraint("ck_reports_status", "status IN ('open', 'investigating', 'resolved')");
                    table.CheckConstraint("ck_reports_target_kind", "target_kind IN ('listing', 'seller', 'service')");
                    table.ForeignKey(
                        name: "fk_reports_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "listings",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_reports_sellers_seller_id",
                        column: x => x.seller_id,
                        principalTable: "sellers",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_reports_users_handled_by",
                        column: x => x.handled_by,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_reports_users_reporter_user_id",
                        column: x => x.reporter_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "service_requests",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<long>(type: "bigint", nullable: false, defaultValueSql: "nextval('service_request_number_seq')"),
                    listing_id = table.Column<Guid>(type: "uuid", nullable: true),
                    category_id = table.Column<string>(type: "text", nullable: false),
                    city_id = table.Column<string>(type: "text", nullable: false),
                    area = table.Column<string>(type: "text", nullable: true),
                    preferred_date = table.Column<DateOnly>(type: "date", nullable: true),
                    size = table.Column<string>(type: "text", nullable: true),
                    description = table.Column<string>(type: "text", nullable: false),
                    customer_name = table.Column<string>(type: "text", nullable: false),
                    customer_phone = table.Column<string>(type: "text", nullable: false),
                    customer_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'new'"),
                    ip_hash = table.Column<byte[]>(type: "bytea", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
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
                name: "support_messages",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    ticket = table.Column<long>(type: "bigint", nullable: false, defaultValueSql: "nextval('support_ticket_seq')"),
                    topic = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    contact = table.Column<string>(type: "text", nullable: false),
                    message = table.Column<string>(type: "text", nullable: false),
                    listing_number = table.Column<long>(type: "bigint", nullable: true),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'new'"),
                    ip_hash = table.Column<byte[]>(type: "bytea", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_support_messages", x => x.id);
                    table.CheckConstraint("ck_support_messages_contact", "char_length(contact) <= 254");
                    table.CheckConstraint("ck_support_messages_message", "char_length(message) <= 2000");
                    table.CheckConstraint("ck_support_messages_name", "char_length(name) <= 60");
                    table.CheckConstraint("ck_support_messages_status", "status IN ('new', 'answered', 'closed')");
                    table.CheckConstraint("ck_support_messages_topic", "topic IN ('listing', 'account', 'payment', 'complaint', 'other')");
                    table.ForeignKey(
                        name: "fk_support_messages_users_user_id",
                        column: x => x.user_id,
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
                name: "ix_reports_listing",
                table: "reports",
                column: "listing_id",
                filter: "listing_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_reports_open",
                table: "reports",
                column: "created_at",
                filter: "status <> 'resolved'");

            migrationBuilder.CreateIndex(
                name: "ux_service_requests_number",
                table: "service_requests",
                column: "number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_support_messages_ticket",
                table: "support_messages",
                column: "ticket",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "reports");

            migrationBuilder.DropTable(
                name: "service_request_recipients");

            migrationBuilder.DropTable(
                name: "support_messages");

            migrationBuilder.DropTable(
                name: "service_requests");

            migrationBuilder.DropSequence(
                name: "service_request_number_seq");

            migrationBuilder.DropSequence(
                name: "support_ticket_seq");
        }
    }
}
