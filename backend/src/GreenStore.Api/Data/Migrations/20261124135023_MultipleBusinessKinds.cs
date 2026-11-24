using System.Collections.Generic;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GreenStore.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class MultipleBusinessKinds : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A business can be a nursery and a garden centre at once (docs/handoff/multi-business-kind.md): the one
            // kind becomes a list that starts with it.
            migrationBuilder.AddColumn<List<string>>(
                name: "business_kinds",
                table: "sellers",
                type: "text[]",
                nullable: true);

            migrationBuilder.Sql("UPDATE sellers SET business_kinds = ARRAY[business_kind];");

            migrationBuilder.AlterColumn<List<string>>(
                name: "business_kinds",
                table: "sellers",
                type: "text[]",
                nullable: false,
                oldClrType: typeof(List<string>),
                oldType: "text[]",
                oldNullable: true);

            migrationBuilder.DropCheckConstraint(
                name: "ck_sellers_business_kind",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "business_kind",
                table: "sellers");

            migrationBuilder.AddCheckConstraint(
                name: "ck_sellers_business_kinds",
                table: "sellers",
                sql: "cardinality(business_kinds) >= 1 AND business_kinds <@ ARRAY['nursery', 'garden-centre', 'landscaping']::text[]");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Back to one kind: the first of the list (the list is kept in the order nursery, garden-centre, landscaping).
            migrationBuilder.AddColumn<string>(
                name: "business_kind",
                table: "sellers",
                type: "text",
                nullable: true);

            migrationBuilder.Sql("UPDATE sellers SET business_kind = business_kinds[1];");

            migrationBuilder.AlterColumn<string>(
                name: "business_kind",
                table: "sellers",
                type: "text",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "text",
                oldNullable: true);

            migrationBuilder.DropCheckConstraint(
                name: "ck_sellers_business_kinds",
                table: "sellers");

            migrationBuilder.DropColumn(
                name: "business_kinds",
                table: "sellers");

            migrationBuilder.AddCheckConstraint(
                name: "ck_sellers_business_kind",
                table: "sellers",
                sql: "business_kind IN ('nursery', 'garden-centre', 'landscaping')");
        }
    }
}
