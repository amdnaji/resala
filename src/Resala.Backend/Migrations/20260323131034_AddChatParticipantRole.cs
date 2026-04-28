using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Resala.Backend.Migrations
{
    /// <inheritdoc />
    public partial class AddChatParticipantRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "role",
                table: "chat_participant",
                type: "integer",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "role",
                table: "chat_participant");
        }
    }
}
