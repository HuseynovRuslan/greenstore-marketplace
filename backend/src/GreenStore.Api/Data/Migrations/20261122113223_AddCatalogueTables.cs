using System;
using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GreenStore.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCatalogueTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateSequence(
                name: "listing_number_seq",
                startValue: 10001L);

            migrationBuilder.CreateTable(
                name: "categories",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    parent_id = table.Column<string>(type: "text", nullable: true),
                    kind = table.Column<string>(type: "text", nullable: false),
                    form = table.Column<string>(type: "text", nullable: true),
                    name = table.Column<string>(type: "jsonb", nullable: false),
                    description = table.Column<string>(type: "jsonb", nullable: true),
                    icon = table.Column<string>(type: "text", nullable: true),
                    filters = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'[]'::jsonb"),
                    sort_order = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_categories", x => x.id);
                    table.CheckConstraint("ck_categories_form", "form IN ('plant', 'pack', 'goods', 'grass', 'service')");
                    table.CheckConstraint("ck_categories_form_on_categories_only", "(parent_id IS NULL) = (form IS NOT NULL)");
                    table.CheckConstraint("ck_categories_id", "id ~ '^[a-z0-9-]{1,80}$'");
                    table.CheckConstraint("ck_categories_kind", "kind IN ('product', 'service')");
                    table.CheckConstraint("ck_categories_name", "jsonb_typeof(name) = 'object' AND name ? 'az'");
                    table.ForeignKey(
                        name: "fk_categories_categories_parent_id",
                        column: x => x.parent_id,
                        principalTable: "categories",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "cities",
                columns: table => new
                {
                    id = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "jsonb", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    is_active = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cities", x => x.id);
                    table.CheckConstraint("ck_cities_id", "id ~ '^[a-z0-9-]{1,40}$'");
                    table.CheckConstraint("ck_cities_name", "jsonb_typeof(name) = 'object' AND name ? 'az'");
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    phone = table.Column<string>(type: "text", nullable: true),
                    email = table.Column<string>(type: "text", nullable: true),
                    email_verified_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    password_hash = table.Column<string>(type: "text", nullable: true),
                    full_name = table.Column<string>(type: "text", nullable: false),
                    account_type = table.Column<string>(type: "text", nullable: false),
                    role = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'user'"),
                    status = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'active'"),
                    locale = table.Column<string>(type: "text", nullable: false, defaultValueSql: "'az'"),
                    failed_logins = table.Column<short>(type: "smallint", nullable: false, defaultValue: (short)0),
                    locked_until = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                    table.CheckConstraint("ck_users_account_type", "account_type IN ('individual', 'business')");
                    table.CheckConstraint("ck_users_credentials", "status = 'deleted' OR (phone IS NOT NULL AND password_hash IS NOT NULL)");
                    table.CheckConstraint("ck_users_email", "char_length(email) <= 254");
                    table.CheckConstraint("ck_users_full_name", "char_length(full_name) BETWEEN 1 AND 60");
                    table.CheckConstraint("ck_users_locale", "locale IN ('az', 'ru', 'en')");
                    table.CheckConstraint("ck_users_phone", "phone ~ '^\\+994[0-9]{9}$'");
                    table.CheckConstraint("ck_users_role", "role IN ('user', 'moderator', 'admin')");
                    table.CheckConstraint("ck_users_status", "status IN ('active', 'blocked', 'deleted')");
                });

            migrationBuilder.CreateTable(
                name: "photos",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    purpose = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    upload_token_hash = table.Column<byte[]>(type: "bytea", nullable: true),
                    upload_expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    content_type = table.Column<string>(type: "text", nullable: true),
                    bytes = table.Column<int>(type: "integer", nullable: true),
                    width = table.Column<int>(type: "integer", nullable: true),
                    height = table.Column<int>(type: "integer", nullable: true),
                    storage_key = table.Column<string>(type: "text", nullable: true),
                    variants = table.Column<string>(type: "jsonb", nullable: true),
                    error = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    attached_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_photos", x => x.id);
                    table.CheckConstraint("ck_photos_bytes", "bytes <= 10485760");
                    table.CheckConstraint("ck_photos_purpose", "purpose IN ('listing', 'seller-logo', 'seller-cover')");
                    table.CheckConstraint("ck_photos_status", "status IN ('awaiting-upload', 'processing', 'ready', 'failed')");
                    table.ForeignKey(
                        name: "fk_photos_users_owner_user_id",
                        column: x => x.owner_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "sellers",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    slug = table.Column<string>(type: "text", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    business_kind = table.Column<string>(type: "text", nullable: false),
                    city_id = table.Column<string>(type: "text", nullable: false),
                    address = table.Column<string>(type: "text", nullable: true),
                    lat = table.Column<decimal>(type: "numeric(8,6)", precision: 8, scale: 6, nullable: true),
                    lng = table.Column<decimal>(type: "numeric(9,6)", precision: 9, scale: 6, nullable: true),
                    about = table.Column<string>(type: "text", nullable: true),
                    terms = table.Column<string>(type: "text", nullable: true),
                    hours = table.Column<string>(type: "jsonb", nullable: true),
                    offers = table.Column<List<string>>(type: "text[]", nullable: false, defaultValueSql: "'{}'::text[]"),
                    phone = table.Column<string>(type: "text", nullable: true),
                    whatsapp = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    email = table.Column<string>(type: "text", nullable: true),
                    contact_person = table.Column<string>(type: "text", nullable: true),
                    instagram = table.Column<string>(type: "text", nullable: true),
                    website = table.Column<string>(type: "text", nullable: true),
                    response_minutes = table.Column<int>(type: "integer", nullable: true),
                    logo_photo_id = table.Column<Guid>(type: "uuid", nullable: true),
                    cover_photo_id = table.Column<Guid>(type: "uuid", nullable: true),
                    verified_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    verified_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sellers", x => x.id);
                    table.CheckConstraint("ck_sellers_about", "char_length(about) <= 2000");
                    table.CheckConstraint("ck_sellers_address", "char_length(address) <= 200");
                    table.CheckConstraint("ck_sellers_business_kind", "business_kind IN ('nursery', 'garden-centre', 'landscaping')");
                    table.CheckConstraint("ck_sellers_location", "(lat IS NULL) = (lng IS NULL)");
                    table.CheckConstraint("ck_sellers_name", "char_length(name) BETWEEN 2 AND 80");
                    table.CheckConstraint("ck_sellers_offers", "offers <@ ARRAY['delivery', 'planting', 'design', 'wholesale', 'care']::text[]");
                    table.CheckConstraint("ck_sellers_phone", "phone ~ '^\\+994[0-9]{9}$'");
                    table.CheckConstraint("ck_sellers_response_minutes", "response_minutes > 0");
                    table.CheckConstraint("ck_sellers_slug", "slug ~ '^[a-z0-9-]{1,80}$'");
                    table.CheckConstraint("ck_sellers_terms", "char_length(terms) <= 1000");
                    table.ForeignKey(
                        name: "fk_sellers_cities_city_id",
                        column: x => x.city_id,
                        principalTable: "cities",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_sellers_photos_cover_photo_id",
                        column: x => x.cover_photo_id,
                        principalTable: "photos",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_sellers_photos_logo_photo_id",
                        column: x => x.logo_photo_id,
                        principalTable: "photos",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_sellers_users_owner_user_id",
                        column: x => x.owner_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_sellers_users_verified_by",
                        column: x => x.verified_by,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "listings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    number = table.Column<long>(type: "bigint", nullable: false, defaultValueSql: "nextval('listing_number_seq')"),
                    slug = table.Column<string>(type: "text", nullable: false),
                    kind = table.Column<string>(type: "text", nullable: false),
                    owner_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    seller_id = table.Column<Guid>(type: "uuid", nullable: true),
                    category_id = table.Column<string>(type: "text", nullable: false),
                    subcategory_id = table.Column<string>(type: "text", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    title = table.Column<string>(type: "text", nullable: false),
                    description = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    price_type = table.Column<string>(type: "text", nullable: false),
                    price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    price_unit = table.Column<string>(type: "text", nullable: true),
                    wholesale_price = table.Column<decimal>(type: "numeric(10,2)", precision: 10, scale: 2, nullable: true),
                    wholesale_min_qty = table.Column<int>(type: "integer", nullable: true),
                    quantity_available = table.Column<int>(type: "integer", nullable: true),
                    availability = table.Column<string>(type: "text", nullable: true),
                    city_id = table.Column<string>(type: "text", nullable: false),
                    area = table.Column<string>(type: "text", nullable: true),
                    delivery_available = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    delivery_areas = table.Column<string>(type: "text", nullable: true),
                    planting_available = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    contact_name = table.Column<string>(type: "text", nullable: false),
                    contact_phone = table.Column<string>(type: "text", nullable: false),
                    contact_phone_verified = table.Column<bool>(type: "boolean", nullable: false),
                    whatsapp = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    phone_hidden = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    species = table.Column<string>(type: "text", nullable: true),
                    height_min_cm = table.Column<int>(type: "integer", nullable: true),
                    height_max_cm = table.Column<int>(type: "integer", nullable: true),
                    age_years = table.Column<short>(type: "smallint", nullable: true),
                    root_system = table.Column<string>(type: "text", nullable: true),
                    plant = table.Column<string>(type: "jsonb", nullable: true),
                    attributes = table.Column<string>(type: "jsonb", nullable: false, defaultValueSql: "'{}'::jsonb"),
                    care_tips = table.Column<List<string>>(type: "text[]", nullable: false, defaultValueSql: "'{}'::text[]"),
                    service_city_ids = table.Column<List<string>>(type: "text[]", nullable: false, defaultValueSql: "'{}'::text[]"),
                    includes = table.Column<List<string>>(type: "text[]", nullable: false, defaultValueSql: "'{}'::text[]"),
                    search_text = table.Column<string>(type: "text", nullable: false, defaultValue: ""),
                    is_promoted = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    promoted_until = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    sort_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    rejection_reason_code = table.Column<string>(type: "text", nullable: true),
                    rejection_note = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    edited_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    submitted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    published_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    bumped_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_listings", x => x.id);
                    table.CheckConstraint("ck_listings_active_dates", "status <> 'active' OR (published_at IS NOT NULL AND expires_at IS NOT NULL AND sort_at IS NOT NULL)");
                    table.CheckConstraint("ck_listings_age_years", "age_years >= 0");
                    table.CheckConstraint("ck_listings_agreement_has_no_price", "price_type <> 'agreement' OR price IS NULL");
                    table.CheckConstraint("ck_listings_area", "char_length(area) <= 80");
                    table.CheckConstraint("ck_listings_availability", "availability IN ('in-stock', 'on-order')");
                    table.CheckConstraint("ck_listings_contact_name", "char_length(contact_name) BETWEEN 1 AND 60");
                    table.CheckConstraint("ck_listings_contact_phone", "contact_phone ~ '^\\+994[0-9]{9}$'");
                    table.CheckConstraint("ck_listings_delivery_areas", "char_length(delivery_areas) <= 120");
                    table.CheckConstraint("ck_listings_description", "char_length(description) <= 3000");
                    table.CheckConstraint("ck_listings_height_min_cm", "height_min_cm > 0");
                    table.CheckConstraint("ck_listings_height_range", "height_max_cm IS NULL OR height_max_cm >= height_min_cm");
                    table.CheckConstraint("ck_listings_hidden_phone_has_whatsapp", "NOT phone_hidden OR whatsapp");
                    table.CheckConstraint("ck_listings_kind", "kind IN ('product', 'service')");
                    table.CheckConstraint("ck_listings_price", "price >= 0");
                    table.CheckConstraint("ck_listings_price_given", "price_type = 'agreement' OR price IS NOT NULL");
                    table.CheckConstraint("ck_listings_price_type", "price_type IN ('fixed', 'negotiable', 'agreement')");
                    table.CheckConstraint("ck_listings_price_unit", "price_unit IN ('piece', 'kg', 'litre', 'sqm', 'bag', 'set', 'metre', 'hour', 'job')");
                    table.CheckConstraint("ck_listings_quantity_available", "quantity_available >= 0");
                    table.CheckConstraint("ck_listings_rejected_reason", "status <> 'rejected' OR rejection_reason_code IS NOT NULL");
                    table.CheckConstraint("ck_listings_rejection_note", "char_length(rejection_note) <= 500");
                    table.CheckConstraint("ck_listings_rejection_reason_code", "rejection_reason_code IN ('wrong-category', 'wrong-price', 'unverified-contact', 'bad-photos', 'duplicate', 'other')");
                    table.CheckConstraint("ck_listings_root_system", "root_system IN ('container', 'rootball', 'bare-root')");
                    table.CheckConstraint("ck_listings_service_fields", "kind = 'service' OR (cardinality(service_city_ids) = 0 AND cardinality(includes) = 0)");
                    table.CheckConstraint("ck_listings_species", "char_length(species) <= 60");
                    table.CheckConstraint("ck_listings_status", "status IN ('pending', 'active', 'rejected', 'expired', 'inactive')");
                    table.CheckConstraint("ck_listings_title", "char_length(title) BETWEEN 3 AND 80");
                    table.CheckConstraint("ck_listings_wholesale_min_qty", "wholesale_min_qty >= 2");
                    table.CheckConstraint("ck_listings_wholesale_pair", "(wholesale_price IS NULL) = (wholesale_min_qty IS NULL)");
                    table.CheckConstraint("ck_listings_wholesale_price", "wholesale_price > 0");
                    table.ForeignKey(
                        name: "fk_listings_categories_category_id",
                        column: x => x.category_id,
                        principalTable: "categories",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_listings_categories_subcategory_id",
                        column: x => x.subcategory_id,
                        principalTable: "categories",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_listings_cities_city_id",
                        column: x => x.city_id,
                        principalTable: "cities",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_listings_sellers_seller_id",
                        column: x => x.seller_id,
                        principalTable: "sellers",
                        principalColumn: "id");
                    table.ForeignKey(
                        name: "fk_listings_users_owner_user_id",
                        column: x => x.owner_user_id,
                        principalTable: "users",
                        principalColumn: "id");
                });

            migrationBuilder.CreateTable(
                name: "listing_counters",
                columns: table => new
                {
                    listing_id = table.Column<Guid>(type: "uuid", nullable: false),
                    views = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    phone_reveals = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    favourites = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_listing_counters", x => x.listing_id);
                    table.ForeignKey(
                        name: "fk_listing_counters_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "listings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "listing_photos",
                columns: table => new
                {
                    listing_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<short>(type: "smallint", nullable: false),
                    photo_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_listing_photos", x => new { x.listing_id, x.position });
                    table.CheckConstraint("ck_listing_photos_position", "position BETWEEN 0 AND 11");
                    table.ForeignKey(
                        name: "fk_listing_photos_listings_listing_id",
                        column: x => x.listing_id,
                        principalTable: "listings",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_listing_photos_photos_photo_id",
                        column: x => x.photo_id,
                        principalTable: "photos",
                        principalColumn: "id");
                });

            migrationBuilder.CreateIndex(
                name: "ux_listing_photos_photo_id",
                table: "listing_photos",
                column: "photo_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_listings_category",
                table: "listings",
                columns: new[] { "category_id", "sort_at" },
                descending: new[] { false, true },
                filter: "status = 'active' AND deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_listings_expiry",
                table: "listings",
                column: "expires_at",
                filter: "status = 'active' AND deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_listings_feed",
                table: "listings",
                columns: new[] { "kind", "is_promoted", "sort_at" },
                descending: new[] { false, true, true },
                filter: "status = 'active' AND deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_listings_moderation",
                table: "listings",
                column: "submitted_at",
                filter: "status = 'pending' AND deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_listings_owner",
                table: "listings",
                columns: new[] { "owner_user_id", "status" },
                filter: "deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_listings_search",
                table: "listings",
                column: "search_text",
                filter: "status = 'active' AND deleted_at IS NULL")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "ix_listings_seller",
                table: "listings",
                column: "seller_id",
                filter: "seller_id IS NOT NULL AND deleted_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ux_listings_number",
                table: "listings",
                column: "number",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_listings_slug",
                table: "listings",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_photos_unattached",
                table: "photos",
                column: "created_at",
                filter: "attached_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ux_sellers_owner_user_id",
                table: "sellers",
                column: "owner_user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_sellers_slug",
                table: "sellers",
                column: "slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ux_users_phone",
                table: "users",
                column: "phone",
                unique: true);

            // An expression index, which EF cannot model (DATABASE.md §3.2): e-mail addresses are unique ignoring case.
            migrationBuilder.Sql("CREATE UNIQUE INDEX ux_users_email ON users (lower(email)) WHERE email IS NOT NULL;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ux_users_email;");

            migrationBuilder.DropTable(
                name: "listing_counters");

            migrationBuilder.DropTable(
                name: "listing_photos");

            migrationBuilder.DropTable(
                name: "listings");

            migrationBuilder.DropTable(
                name: "categories");

            migrationBuilder.DropTable(
                name: "sellers");

            migrationBuilder.DropTable(
                name: "cities");

            migrationBuilder.DropTable(
                name: "photos");

            migrationBuilder.DropTable(
                name: "users");

            migrationBuilder.DropSequence(
                name: "listing_number_seq");
        }
    }
}
