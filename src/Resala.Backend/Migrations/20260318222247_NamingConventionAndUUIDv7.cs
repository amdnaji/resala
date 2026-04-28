using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Resala.Backend.Migrations
{
    /// <inheritdoc />
    public partial class NamingConventionAndUUIDv7 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AspNetRoleClaims_AspNetRoles_RoleId",
                table: "AspNetRoleClaims");

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                table: "AspNetUserClaims");

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                table: "AspNetUserLogins");

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUserRoles_AspNetRoles_RoleId",
                table: "AspNetUserRoles");

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUserRoles_AspNetUsers_UserId",
                table: "AspNetUserRoles");

            migrationBuilder.DropForeignKey(
                name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                table: "AspNetUserTokens");

            migrationBuilder.DropForeignKey(
                name: "FK_ChatParticipants_AspNetUsers_UserId",
                table: "ChatParticipants");

            migrationBuilder.DropForeignKey(
                name: "FK_ChatParticipants_Chats_ChatId",
                table: "ChatParticipants");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_AspNetUsers_SenderId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Chats_ChatId",
                table: "Messages");

            migrationBuilder.DropForeignKey(
                name: "FK_Messages_Messages_ParentMessageId",
                table: "Messages");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Messages",
                table: "Messages");

            migrationBuilder.DropPrimaryKey(
                name: "PK_Chats",
                table: "Chats");

            migrationBuilder.DropPrimaryKey(
                name: "PK_ChatParticipants",
                table: "ChatParticipants");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AspNetUserTokens",
                table: "AspNetUserTokens");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AspNetUsers",
                table: "AspNetUsers");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AspNetUserRoles",
                table: "AspNetUserRoles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AspNetUserLogins",
                table: "AspNetUserLogins");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AspNetUserClaims",
                table: "AspNetUserClaims");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AspNetRoles",
                table: "AspNetRoles");

            migrationBuilder.DropPrimaryKey(
                name: "PK_AspNetRoleClaims",
                table: "AspNetRoleClaims");

            migrationBuilder.RenameTable(
                name: "Messages",
                newName: "message");

            migrationBuilder.RenameTable(
                name: "Chats",
                newName: "chat");

            migrationBuilder.RenameTable(
                name: "ChatParticipants",
                newName: "chat_participant");

            migrationBuilder.RenameTable(
                name: "AspNetUserTokens",
                newName: "user_token");

            migrationBuilder.RenameTable(
                name: "AspNetUsers",
                newName: "users");

            migrationBuilder.RenameTable(
                name: "AspNetUserRoles",
                newName: "user_role");

            migrationBuilder.RenameTable(
                name: "AspNetUserLogins",
                newName: "user_login");

            migrationBuilder.RenameTable(
                name: "AspNetUserClaims",
                newName: "user_claim");

            migrationBuilder.RenameTable(
                name: "AspNetRoles",
                newName: "role");

            migrationBuilder.RenameTable(
                name: "AspNetRoleClaims",
                newName: "role_claim");

            migrationBuilder.RenameColumn(
                name: "Content",
                table: "message",
                newName: "content");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "message",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "SenderId",
                table: "message",
                newName: "sender_id");

            migrationBuilder.RenameColumn(
                name: "ParentMessageId",
                table: "message",
                newName: "parent_message_id");

            migrationBuilder.RenameColumn(
                name: "IsRead",
                table: "message",
                newName: "is_read");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "message",
                newName: "created_at");

            migrationBuilder.RenameColumn(
                name: "ChatId",
                table: "message",
                newName: "chat_id");

            migrationBuilder.RenameIndex(
                name: "IX_Messages_SenderId",
                table: "message",
                newName: "ix_message_sender_id");

            migrationBuilder.RenameIndex(
                name: "IX_Messages_ParentMessageId",
                table: "message",
                newName: "ix_message_parent_message_id");

            migrationBuilder.RenameIndex(
                name: "IX_Messages_ChatId",
                table: "message",
                newName: "ix_message_chat_id");

            migrationBuilder.RenameColumn(
                name: "Type",
                table: "chat",
                newName: "type");

            migrationBuilder.RenameColumn(
                name: "Title",
                table: "chat",
                newName: "title");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "chat",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "chat",
                newName: "created_at");

            migrationBuilder.RenameColumn(
                name: "JoinedAt",
                table: "chat_participant",
                newName: "joined_at");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "chat_participant",
                newName: "user_id");

            migrationBuilder.RenameColumn(
                name: "ChatId",
                table: "chat_participant",
                newName: "chat_id");

            migrationBuilder.RenameIndex(
                name: "IX_ChatParticipants_UserId",
                table: "chat_participant",
                newName: "ix_chat_participant_user_id");

            migrationBuilder.RenameColumn(
                name: "Value",
                table: "user_token",
                newName: "value");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "user_token",
                newName: "name");

            migrationBuilder.RenameColumn(
                name: "LoginProvider",
                table: "user_token",
                newName: "login_provider");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "user_token",
                newName: "user_id");

            migrationBuilder.RenameColumn(
                name: "Email",
                table: "users",
                newName: "email");

            migrationBuilder.RenameColumn(
                name: "Bio",
                table: "users",
                newName: "bio");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "users",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UserName",
                table: "users",
                newName: "user_name");

            migrationBuilder.RenameColumn(
                name: "TwoFactorEnabled",
                table: "users",
                newName: "two_factor_enabled");

            migrationBuilder.RenameColumn(
                name: "SecurityStamp",
                table: "users",
                newName: "security_stamp");

            migrationBuilder.RenameColumn(
                name: "ProfilePictureUrl",
                table: "users",
                newName: "profile_picture_url");

            migrationBuilder.RenameColumn(
                name: "PhoneNumberConfirmed",
                table: "users",
                newName: "phone_number_confirmed");

            migrationBuilder.RenameColumn(
                name: "PhoneNumber",
                table: "users",
                newName: "phone_number");

            migrationBuilder.RenameColumn(
                name: "PasswordHash",
                table: "users",
                newName: "password_hash");

            migrationBuilder.RenameColumn(
                name: "NormalizedUserName",
                table: "users",
                newName: "normalized_user_name");

            migrationBuilder.RenameColumn(
                name: "NormalizedEmail",
                table: "users",
                newName: "normalized_email");

            migrationBuilder.RenameColumn(
                name: "LockoutEnd",
                table: "users",
                newName: "lockout_end");

            migrationBuilder.RenameColumn(
                name: "LockoutEnabled",
                table: "users",
                newName: "lockout_enabled");

            migrationBuilder.RenameColumn(
                name: "LastSeenAt",
                table: "users",
                newName: "last_seen_at");

            migrationBuilder.RenameColumn(
                name: "EmailConfirmed",
                table: "users",
                newName: "email_confirmed");

            migrationBuilder.RenameColumn(
                name: "DisplayName",
                table: "users",
                newName: "display_name");

            migrationBuilder.RenameColumn(
                name: "CreatedAt",
                table: "users",
                newName: "created_at");

            migrationBuilder.RenameColumn(
                name: "ConcurrencyStamp",
                table: "users",
                newName: "concurrency_stamp");

            migrationBuilder.RenameColumn(
                name: "AccessFailedCount",
                table: "users",
                newName: "access_failed_count");

            migrationBuilder.RenameColumn(
                name: "RoleId",
                table: "user_role",
                newName: "role_id");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "user_role",
                newName: "user_id");

            migrationBuilder.RenameIndex(
                name: "IX_AspNetUserRoles_RoleId",
                table: "user_role",
                newName: "ix_user_role_role_id");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "user_login",
                newName: "user_id");

            migrationBuilder.RenameColumn(
                name: "ProviderDisplayName",
                table: "user_login",
                newName: "provider_display_name");

            migrationBuilder.RenameColumn(
                name: "ProviderKey",
                table: "user_login",
                newName: "provider_key");

            migrationBuilder.RenameColumn(
                name: "LoginProvider",
                table: "user_login",
                newName: "login_provider");

            migrationBuilder.RenameIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "user_login",
                newName: "ix_user_login_user_id");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "user_claim",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "UserId",
                table: "user_claim",
                newName: "user_id");

            migrationBuilder.RenameColumn(
                name: "ClaimValue",
                table: "user_claim",
                newName: "claim_value");

            migrationBuilder.RenameColumn(
                name: "ClaimType",
                table: "user_claim",
                newName: "claim_type");

            migrationBuilder.RenameIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "user_claim",
                newName: "ix_user_claim_user_id");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "role",
                newName: "name");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "role",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "NormalizedName",
                table: "role",
                newName: "normalized_name");

            migrationBuilder.RenameColumn(
                name: "ConcurrencyStamp",
                table: "role",
                newName: "concurrency_stamp");

            migrationBuilder.RenameColumn(
                name: "Id",
                table: "role_claim",
                newName: "id");

            migrationBuilder.RenameColumn(
                name: "RoleId",
                table: "role_claim",
                newName: "role_id");

            migrationBuilder.RenameColumn(
                name: "ClaimValue",
                table: "role_claim",
                newName: "claim_value");

            migrationBuilder.RenameColumn(
                name: "ClaimType",
                table: "role_claim",
                newName: "claim_type");

            migrationBuilder.RenameIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "role_claim",
                newName: "ix_role_claim_role_id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_message",
                table: "message",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_chat",
                table: "chat",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_chat_participant",
                table: "chat_participant",
                columns: new[] { "chat_id", "user_id" });

            migrationBuilder.AddPrimaryKey(
                name: "pk_user_token",
                table: "user_token",
                columns: new[] { "user_id", "login_provider", "name" });

            migrationBuilder.AddPrimaryKey(
                name: "pk_users",
                table: "users",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_user_role",
                table: "user_role",
                columns: new[] { "user_id", "role_id" });

            migrationBuilder.AddPrimaryKey(
                name: "pk_user_login",
                table: "user_login",
                columns: new[] { "login_provider", "provider_key" });

            migrationBuilder.AddPrimaryKey(
                name: "pk_user_claim",
                table: "user_claim",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_role",
                table: "role",
                column: "id");

            migrationBuilder.AddPrimaryKey(
                name: "pk_role_claim",
                table: "role_claim",
                column: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_chat_participant_chat_chat_id",
                table: "chat_participant",
                column: "chat_id",
                principalTable: "chat",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_chat_participant_users_user_id",
                table: "chat_participant",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_message_chat_chat_id",
                table: "message",
                column: "chat_id",
                principalTable: "chat",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_message_message_parent_message_id",
                table: "message",
                column: "parent_message_id",
                principalTable: "message",
                principalColumn: "id");

            migrationBuilder.AddForeignKey(
                name: "fk_message_users_sender_id",
                table: "message",
                column: "sender_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_role_claim_role_role_id",
                table: "role_claim",
                column: "role_id",
                principalTable: "role",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_user_claim_users_user_id",
                table: "user_claim",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_user_login_users_user_id",
                table: "user_login",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_user_role_role_role_id",
                table: "user_role",
                column: "role_id",
                principalTable: "role",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_user_role_users_user_id",
                table: "user_role",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_user_token_users_user_id",
                table: "user_token",
                column: "user_id",
                principalTable: "users",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_chat_participant_chat_chat_id",
                table: "chat_participant");

            migrationBuilder.DropForeignKey(
                name: "fk_chat_participant_users_user_id",
                table: "chat_participant");

            migrationBuilder.DropForeignKey(
                name: "fk_message_chat_chat_id",
                table: "message");

            migrationBuilder.DropForeignKey(
                name: "fk_message_message_parent_message_id",
                table: "message");

            migrationBuilder.DropForeignKey(
                name: "fk_message_users_sender_id",
                table: "message");

            migrationBuilder.DropForeignKey(
                name: "fk_role_claim_role_role_id",
                table: "role_claim");

            migrationBuilder.DropForeignKey(
                name: "fk_user_claim_users_user_id",
                table: "user_claim");

            migrationBuilder.DropForeignKey(
                name: "fk_user_login_users_user_id",
                table: "user_login");

            migrationBuilder.DropForeignKey(
                name: "fk_user_role_role_role_id",
                table: "user_role");

            migrationBuilder.DropForeignKey(
                name: "fk_user_role_users_user_id",
                table: "user_role");

            migrationBuilder.DropForeignKey(
                name: "fk_user_token_users_user_id",
                table: "user_token");

            migrationBuilder.DropPrimaryKey(
                name: "pk_users",
                table: "users");

            migrationBuilder.DropPrimaryKey(
                name: "pk_user_token",
                table: "user_token");

            migrationBuilder.DropPrimaryKey(
                name: "pk_user_role",
                table: "user_role");

            migrationBuilder.DropPrimaryKey(
                name: "pk_user_login",
                table: "user_login");

            migrationBuilder.DropPrimaryKey(
                name: "pk_user_claim",
                table: "user_claim");

            migrationBuilder.DropPrimaryKey(
                name: "pk_role_claim",
                table: "role_claim");

            migrationBuilder.DropPrimaryKey(
                name: "pk_role",
                table: "role");

            migrationBuilder.DropPrimaryKey(
                name: "pk_message",
                table: "message");

            migrationBuilder.DropPrimaryKey(
                name: "pk_chat_participant",
                table: "chat_participant");

            migrationBuilder.DropPrimaryKey(
                name: "pk_chat",
                table: "chat");

            migrationBuilder.RenameTable(
                name: "users",
                newName: "AspNetUsers");

            migrationBuilder.RenameTable(
                name: "user_token",
                newName: "AspNetUserTokens");

            migrationBuilder.RenameTable(
                name: "user_role",
                newName: "AspNetUserRoles");

            migrationBuilder.RenameTable(
                name: "user_login",
                newName: "AspNetUserLogins");

            migrationBuilder.RenameTable(
                name: "user_claim",
                newName: "AspNetUserClaims");

            migrationBuilder.RenameTable(
                name: "role_claim",
                newName: "AspNetRoleClaims");

            migrationBuilder.RenameTable(
                name: "role",
                newName: "AspNetRoles");

            migrationBuilder.RenameTable(
                name: "message",
                newName: "Messages");

            migrationBuilder.RenameTable(
                name: "chat_participant",
                newName: "ChatParticipants");

            migrationBuilder.RenameTable(
                name: "chat",
                newName: "Chats");

            migrationBuilder.RenameColumn(
                name: "email",
                table: "AspNetUsers",
                newName: "Email");

            migrationBuilder.RenameColumn(
                name: "bio",
                table: "AspNetUsers",
                newName: "Bio");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "AspNetUsers",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "user_name",
                table: "AspNetUsers",
                newName: "UserName");

            migrationBuilder.RenameColumn(
                name: "two_factor_enabled",
                table: "AspNetUsers",
                newName: "TwoFactorEnabled");

            migrationBuilder.RenameColumn(
                name: "security_stamp",
                table: "AspNetUsers",
                newName: "SecurityStamp");

            migrationBuilder.RenameColumn(
                name: "profile_picture_url",
                table: "AspNetUsers",
                newName: "ProfilePictureUrl");

            migrationBuilder.RenameColumn(
                name: "phone_number_confirmed",
                table: "AspNetUsers",
                newName: "PhoneNumberConfirmed");

            migrationBuilder.RenameColumn(
                name: "phone_number",
                table: "AspNetUsers",
                newName: "PhoneNumber");

            migrationBuilder.RenameColumn(
                name: "password_hash",
                table: "AspNetUsers",
                newName: "PasswordHash");

            migrationBuilder.RenameColumn(
                name: "normalized_user_name",
                table: "AspNetUsers",
                newName: "NormalizedUserName");

            migrationBuilder.RenameColumn(
                name: "normalized_email",
                table: "AspNetUsers",
                newName: "NormalizedEmail");

            migrationBuilder.RenameColumn(
                name: "lockout_end",
                table: "AspNetUsers",
                newName: "LockoutEnd");

            migrationBuilder.RenameColumn(
                name: "lockout_enabled",
                table: "AspNetUsers",
                newName: "LockoutEnabled");

            migrationBuilder.RenameColumn(
                name: "last_seen_at",
                table: "AspNetUsers",
                newName: "LastSeenAt");

            migrationBuilder.RenameColumn(
                name: "email_confirmed",
                table: "AspNetUsers",
                newName: "EmailConfirmed");

            migrationBuilder.RenameColumn(
                name: "display_name",
                table: "AspNetUsers",
                newName: "DisplayName");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "AspNetUsers",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "concurrency_stamp",
                table: "AspNetUsers",
                newName: "ConcurrencyStamp");

            migrationBuilder.RenameColumn(
                name: "access_failed_count",
                table: "AspNetUsers",
                newName: "AccessFailedCount");

            migrationBuilder.RenameColumn(
                name: "value",
                table: "AspNetUserTokens",
                newName: "Value");

            migrationBuilder.RenameColumn(
                name: "name",
                table: "AspNetUserTokens",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "login_provider",
                table: "AspNetUserTokens",
                newName: "LoginProvider");

            migrationBuilder.RenameColumn(
                name: "user_id",
                table: "AspNetUserTokens",
                newName: "UserId");

            migrationBuilder.RenameColumn(
                name: "role_id",
                table: "AspNetUserRoles",
                newName: "RoleId");

            migrationBuilder.RenameColumn(
                name: "user_id",
                table: "AspNetUserRoles",
                newName: "UserId");

            migrationBuilder.RenameIndex(
                name: "ix_user_role_role_id",
                table: "AspNetUserRoles",
                newName: "IX_AspNetUserRoles_RoleId");

            migrationBuilder.RenameColumn(
                name: "user_id",
                table: "AspNetUserLogins",
                newName: "UserId");

            migrationBuilder.RenameColumn(
                name: "provider_display_name",
                table: "AspNetUserLogins",
                newName: "ProviderDisplayName");

            migrationBuilder.RenameColumn(
                name: "provider_key",
                table: "AspNetUserLogins",
                newName: "ProviderKey");

            migrationBuilder.RenameColumn(
                name: "login_provider",
                table: "AspNetUserLogins",
                newName: "LoginProvider");

            migrationBuilder.RenameIndex(
                name: "ix_user_login_user_id",
                table: "AspNetUserLogins",
                newName: "IX_AspNetUserLogins_UserId");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "AspNetUserClaims",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "user_id",
                table: "AspNetUserClaims",
                newName: "UserId");

            migrationBuilder.RenameColumn(
                name: "claim_value",
                table: "AspNetUserClaims",
                newName: "ClaimValue");

            migrationBuilder.RenameColumn(
                name: "claim_type",
                table: "AspNetUserClaims",
                newName: "ClaimType");

            migrationBuilder.RenameIndex(
                name: "ix_user_claim_user_id",
                table: "AspNetUserClaims",
                newName: "IX_AspNetUserClaims_UserId");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "AspNetRoleClaims",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "role_id",
                table: "AspNetRoleClaims",
                newName: "RoleId");

            migrationBuilder.RenameColumn(
                name: "claim_value",
                table: "AspNetRoleClaims",
                newName: "ClaimValue");

            migrationBuilder.RenameColumn(
                name: "claim_type",
                table: "AspNetRoleClaims",
                newName: "ClaimType");

            migrationBuilder.RenameIndex(
                name: "ix_role_claim_role_id",
                table: "AspNetRoleClaims",
                newName: "IX_AspNetRoleClaims_RoleId");

            migrationBuilder.RenameColumn(
                name: "name",
                table: "AspNetRoles",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "AspNetRoles",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "normalized_name",
                table: "AspNetRoles",
                newName: "NormalizedName");

            migrationBuilder.RenameColumn(
                name: "concurrency_stamp",
                table: "AspNetRoles",
                newName: "ConcurrencyStamp");

            migrationBuilder.RenameColumn(
                name: "content",
                table: "Messages",
                newName: "Content");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "Messages",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "sender_id",
                table: "Messages",
                newName: "SenderId");

            migrationBuilder.RenameColumn(
                name: "parent_message_id",
                table: "Messages",
                newName: "ParentMessageId");

            migrationBuilder.RenameColumn(
                name: "is_read",
                table: "Messages",
                newName: "IsRead");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "Messages",
                newName: "CreatedAt");

            migrationBuilder.RenameColumn(
                name: "chat_id",
                table: "Messages",
                newName: "ChatId");

            migrationBuilder.RenameIndex(
                name: "ix_message_sender_id",
                table: "Messages",
                newName: "IX_Messages_SenderId");

            migrationBuilder.RenameIndex(
                name: "ix_message_parent_message_id",
                table: "Messages",
                newName: "IX_Messages_ParentMessageId");

            migrationBuilder.RenameIndex(
                name: "ix_message_chat_id",
                table: "Messages",
                newName: "IX_Messages_ChatId");

            migrationBuilder.RenameColumn(
                name: "joined_at",
                table: "ChatParticipants",
                newName: "JoinedAt");

            migrationBuilder.RenameColumn(
                name: "user_id",
                table: "ChatParticipants",
                newName: "UserId");

            migrationBuilder.RenameColumn(
                name: "chat_id",
                table: "ChatParticipants",
                newName: "ChatId");

            migrationBuilder.RenameIndex(
                name: "ix_chat_participant_user_id",
                table: "ChatParticipants",
                newName: "IX_ChatParticipants_UserId");

            migrationBuilder.RenameColumn(
                name: "type",
                table: "Chats",
                newName: "Type");

            migrationBuilder.RenameColumn(
                name: "title",
                table: "Chats",
                newName: "Title");

            migrationBuilder.RenameColumn(
                name: "id",
                table: "Chats",
                newName: "Id");

            migrationBuilder.RenameColumn(
                name: "created_at",
                table: "Chats",
                newName: "CreatedAt");

            migrationBuilder.AddPrimaryKey(
                name: "PK_AspNetUsers",
                table: "AspNetUsers",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_AspNetUserTokens",
                table: "AspNetUserTokens",
                columns: new[] { "UserId", "LoginProvider", "Name" });

            migrationBuilder.AddPrimaryKey(
                name: "PK_AspNetUserRoles",
                table: "AspNetUserRoles",
                columns: new[] { "UserId", "RoleId" });

            migrationBuilder.AddPrimaryKey(
                name: "PK_AspNetUserLogins",
                table: "AspNetUserLogins",
                columns: new[] { "LoginProvider", "ProviderKey" });

            migrationBuilder.AddPrimaryKey(
                name: "PK_AspNetUserClaims",
                table: "AspNetUserClaims",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_AspNetRoleClaims",
                table: "AspNetRoleClaims",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_AspNetRoles",
                table: "AspNetRoles",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_Messages",
                table: "Messages",
                column: "Id");

            migrationBuilder.AddPrimaryKey(
                name: "PK_ChatParticipants",
                table: "ChatParticipants",
                columns: new[] { "ChatId", "UserId" });

            migrationBuilder.AddPrimaryKey(
                name: "PK_Chats",
                table: "Chats",
                column: "Id");

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetRoleClaims_AspNetRoles_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId",
                principalTable: "AspNetRoles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                table: "AspNetUserClaims",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                table: "AspNetUserLogins",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserRoles_AspNetRoles_RoleId",
                table: "AspNetUserRoles",
                column: "RoleId",
                principalTable: "AspNetRoles",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserRoles_AspNetUsers_UserId",
                table: "AspNetUserRoles",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                table: "AspNetUserTokens",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ChatParticipants_AspNetUsers_UserId",
                table: "ChatParticipants",
                column: "UserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ChatParticipants_Chats_ChatId",
                table: "ChatParticipants",
                column: "ChatId",
                principalTable: "Chats",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_AspNetUsers_SenderId",
                table: "Messages",
                column: "SenderId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Chats_ChatId",
                table: "Messages",
                column: "ChatId",
                principalTable: "Chats",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_Messages_Messages_ParentMessageId",
                table: "Messages",
                column: "ParentMessageId",
                principalTable: "Messages",
                principalColumn: "Id");
        }
    }
}
