using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GreenStore.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class ServiceTypes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A service can have several types (backend-contract.md 1.3): the one sub-category becomes a list that
            // starts with it; subcategory_id stays as the list's first element (and the foreign key).
            migrationBuilder.AddColumn<List<string>>(
                name: "subcategory_ids",
                table: "listings",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.Sql("UPDATE listings SET subcategory_ids = ARRAY[subcategory_id] WHERE subcategory_id IS NOT NULL;");

            migrationBuilder.AddCheckConstraint(
                name: "ck_listings_subcategory_ids",
                table: "listings",
                sql: "subcategory_ids[1] IS NOT DISTINCT FROM subcategory_id AND cardinality(subcategory_ids) <= 6 AND (kind = 'service' OR cardinality(subcategory_ids) <= 1)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Back to one sub-category: subcategory_id is already the first of the list; the other types are lost.
            migrationBuilder.DropCheckConstraint(
                name: "ck_listings_subcategory_ids",
                table: "listings");

            migrationBuilder.DropColumn(
                name: "subcategory_ids",
                table: "listings");
        }
    }
}
