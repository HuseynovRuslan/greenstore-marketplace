using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace GreenStore.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddPromotions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_listings_feed",
                table: "listings");

            migrationBuilder.CreateSequence(
                name: "promotion_order_number_seq",
                startValue: 1001L);

            migrationBuilder.AddColumn<string>(
                name: "pending_promotion_option_id",
                table: "listings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "promoted_at",
                table: "listings",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "payment_events",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityAlwaysColumn),
                    provider = table.Column<string>(type: "text", nullable: false),
                    provider_ref = table.Column<string>(type: "text", nullable: true),
                    event_type = table.Column<string>(type: "text", nullable: true),
                    payload = table.Column<string>(type: "jsonb", nullable: false),
                    signature_ok = table.Column<bool>(type: "boolean", nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    processed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_payment_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "promotion_packages",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "jsonb", nullable: false),
                    summary = table.Column<string>(type: "jsonb", nullable: false),
                    benefits = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    sort_order = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_promotion_packages", x => x.id);
                    table.CheckConstraint("ck_promotion_packages_benefits", "jsonb_typeof(benefits) = 'array'");
                    table.CheckConstraint("ck_promotion_packages_id", "id IN ('one-cixar', 'ireli-cek', 'paket')");
                    table.CheckConstraint("ck_promotion_packages_name", "jsonb_typeof(name) = 'object' AND name ? 'az'");
                    table.CheckConstraint("ck_promotion_packages_summary", "jsonb_typeof(summary) = 'object' AND summary ? 'az'");
                });

            migrationBuilder.CreateTable(
                name: "promotion_options",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    package_id = table.Column<string>(type: "text", nullable: false),
                    label = table.Column<string>(type: "jsonb", nullable: false),
                    price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    days = table.Column<short>(type: "smallint", nullable: true),
                    bumps = table.Column<short>(type: "smallint", nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_promotion_options", x => x.id);
                    table.CheckConstraint("ck_promotion_options_bumps", "bumps > 0");
                    table.CheckConstraint("ck_promotion_options_days", "days > 0");
                    table.CheckConstraint("ck_promotion_options_id", "id ~ '^[a-z0-9-]{1,40}$'");
                    table.CheckConstraint("ck_promotion_options_label", "jsonb_typeof(label) = 'object' AND label ? 'az'");
                    table.CheckConstraint("ck_promotion_options_price", "price > 0");
                    table.CheckConstraint("ck_promotion_options_runs", "days IS NOT NULL OR bumps IS NOT NULL");
                    table.ForeignKey(
                        name: "fk_promotion_options_promotion_packages_package_id",
                        column: x => x.package_id,
                        principalTable: "promotion_packages",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "promotion_orders",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<long>(type: "bigint", nullable: false, defaultValueSql: "nextval('promotion_order_number_seq')"),
                    listing_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    option_id = table.Column<string>(type: "text", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    provider = table.Column<string>(type: "text", nullable: false),
                    provider_ref = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    paid_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_promotion_orders", x => x.id);
                    table.CheckConstraint("ck_promotion_orders_amount", "amount > 0");
                    table.CheckConstraint("ck_promotion_orders_paid_at", "status <> 'paid' OR paid_at IS NOT NULL");
                    table.CheckConstraint("ck_promotion_orders_status", "status IN ('pending', 'paid', 'failed', 'cancelled', 'refunded')");
                    table.ForeignKey(
                        name: "fk_promotion_orders_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "listings",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_promotion_orders_promotion_options_option_id",
                        column: x => x.option_id,
                        principalTable: "promotion_options",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_promotion_orders_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "listing_promotions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    listing_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    starts_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    ends_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    bumps_left = table.Column<short>(type: "smallint", nullable: false, defaultValue: (short)0),
                    next_bump_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_listing_promotions", x => x.id);
                    table.CheckConstraint("ck_listing_promotions_bumps_left", "bumps_left >= 0");
                    table.CheckConstraint("ck_listing_promotions_feature_has_no_bumps", "kind = 'bump' OR (bumps_left = 0 AND next_bump_at IS NULL)");
                    table.CheckConstraint("ck_listing_promotions_kind", "kind IN ('feature', 'bump')");
                    table.CheckConstraint("ck_listing_promotions_next_bump", "bumps_left = 0 OR next_bump_at IS NOT NULL");
                    table.CheckConstraint("ck_listing_promotions_period", "ends_at > starts_at");
                    table.ForeignKey(
                        name: "fk_listing_promotions_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "listings",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_listing_promotions_promotion_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "promotion_orders",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "ix_listings_feed",
                table: "listings",
                columns: new[] { "kind", "is_promoted", "promoted_at", "sort_at" },
                descending: new[] { false, true, true, true },
                filter: "status = 'active' AND deleted_at IS NULL");

            // Listings promoted before this column (the demo data): promoted since their publication, so the
            // «Önə çıxan» group keeps its order until someone pays.
            migrationBuilder.Sql("UPDATE listings SET promoted_at = coalesce(published_at, submitted_at, created_at) WHERE is_promoted;");

            migrationBuilder.AddCheckConstraint(
                name: "ck_listings_promoted_at",
                table: "listings",
                sql: "is_promoted = (promoted_at IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "ix_promotions_bump",
                table: "listing_promotions",
                column: "next_bump_at",
                filter: "bumps_left > 0");

            migrationBuilder.CreateIndex(
                name: "ix_promotions_listing",
                table: "listing_promotions",
                columns: new[] { "listing_id", "ends_at" });

            migrationBuilder.CreateIndex(
                name: "ux_listing_promotions_order_kind",
                table: "listing_promotions",
                columns: new[] { "order_id", "kind" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_orders_listing",
                table: "promotion_orders",
                column: "listing_id");

            migrationBuilder.CreateIndex(
                name: "ux_promotion_orders_number",
                table: "promotion_orders",
                column: "number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_promotion_orders_provider_ref",
                table: "promotion_orders",
                columns: new[] { "provider", "provider_ref" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_listings_promotion_options_pending_promotion_option_id",
                table: "listings",
                column: "pending_promotion_option_id",
                principalTable: "promotion_options",
                principalColumn: "id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_listings_promotion_options_pending_promotion_option_id",
                table: "listings");

            migrationBuilder.DropTable(
                name: "listing_promotions");

            migrationBuilder.DropTable(
                name: "payment_events");

            migrationBuilder.DropTable(
                name: "promotion_orders");

            migrationBuilder.DropTable(
                name: "promotion_options");

            migrationBuilder.DropTable(
                name: "promotion_packages");

            migrationBuilder.DropIndex(
                name: "ix_listings_feed",
                table: "listings");

            migrationBuilder.DropCheckConstraint(
                name: "ck_listings_promoted_at",
                table: "listings");

            migrationBuilder.DropColumn(
                name: "pending_promotion_option_id",
                table: "listings");

            migrationBuilder.DropColumn(
                name: "promoted_at",
                table: "listings");

            migrationBuilder.DropSequence(
                name: "promotion_order_number_seq");

            migrationBuilder.CreateIndex(
                name: "ix_listings_feed",
                table: "listings",
                columns: new[] { "kind", "is_promoted", "sort_at" },
                descending: new[] { false, true, true },
                filter: "status = 'active' AND deleted_at IS NULL");
        }
    }
}
