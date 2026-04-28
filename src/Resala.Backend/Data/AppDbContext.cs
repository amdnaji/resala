using System;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Resala.Backend.Models;

namespace Resala.Backend.Data
{
    // Inherit from IdentityDbContext to include AspNetUsers tables
    public class AppDbContext : IdentityDbContext<User, IdentityRole<Guid>, Guid>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

        // Note: Users DbSet is provided by IdentityDbContext, but we can still access it.
        public DbSet<Chat> Chats { get; set; }
        public DbSet<ChatParticipant> ChatParticipants { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<MessageReaction> MessageReactions { get; set; }
        public DbSet<Attachment> Attachments { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Rename Identity Tables (Remove AspNet prefix and make singular except users)
            modelBuilder.Entity<User>().ToTable("users");
            modelBuilder.Entity<IdentityRole<Guid>>().ToTable("role");
            modelBuilder.Entity<IdentityUserRole<Guid>>().ToTable("user_role");
            modelBuilder.Entity<IdentityUserClaim<Guid>>().ToTable("user_claim");
            modelBuilder.Entity<IdentityUserLogin<Guid>>().ToTable("user_login");
            modelBuilder.Entity<IdentityRoleClaim<Guid>>().ToTable("role_claim");
            modelBuilder.Entity<IdentityUserToken<Guid>>().ToTable("user_token");

            // Rename Application Tables
            modelBuilder.Entity<Chat>().ToTable("chat");
            modelBuilder.Entity<ChatParticipant>().ToTable("chat_participant");
            modelBuilder.Entity<Message>().ToTable("message");
            modelBuilder.Entity<MessageReaction>().ToTable("message_reaction");
            modelBuilder.Entity<Attachment>().ToTable("attachment");

            // Configure Composite Key for ChatParticipant
            modelBuilder.Entity<ChatParticipant>()
                .HasKey(cp => new { cp.ChatId, cp.UserId });

            // Note: Email and Username unique constraints are already handled by IdentityDbContext

            modelBuilder.Entity<Message>()
                .HasOne(m => m.Chat)
                .WithMany(c => c.Messages)
                .HasForeignKey(m => m.ChatId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Attachment>()
                .HasOne(a => a.Message)
                .WithMany(m => m.Attachments)
                .HasForeignKey(a => a.MessageId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
