using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moq;
using Resala.Backend.Controllers;
using Resala.Backend.Data;
using Resala.Backend.Models;
using Resala.Backend.Services;
using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading.Tasks;
using Xunit;

namespace Resala.Tests
{
    public class FilesControllerTests
    {
        private AppDbContext CreateDbContext()
        {
            var options = new DbContextOptionsBuilder<AppDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            return new AppDbContext(options);
        }

        private FilesController CreateController(
            AppDbContext context, 
            IStorageService storageService, 
            IMemoryCache cache, 
            Guid currentUserId)
        {
            var controller = new FilesController(storageService, context, cache);

            var user = new ClaimsPrincipal(new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, currentUserId.ToString())
            }, "TestAuth"));

            controller.ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = user }
            };

            return controller;
        }

        [Fact]
        public async Task GetAttachment_ReturnsForbid_WhenUserIsNotParticipant()
        {
            using var context = CreateDbContext();
            var cache = new MemoryCache(new MemoryCacheOptions());
            var mockStorage = new Mock<IStorageService>();

            var participantId = Guid.NewGuid();
            var unauthorizedUserId = Guid.NewGuid();

            var chat = new Chat
            {
                Id = Guid.NewGuid(),
                Type = ChatType.Private
            };
            chat.Participants.Add(new ChatParticipant { ChatId = chat.Id, UserId = participantId });

            var message = new Message
            {
                Id = Guid.NewGuid(),
                ChatId = chat.Id,
                SenderId = participantId
            };
            var attachment = new Attachment
            {
                Id = Guid.NewGuid(),
                MessageId = message.Id,
                FileUrl = "/api/files/attachments/2026/09/07/secret.pdf"
            };
            message.Attachments.Add(attachment);

            context.Chats.Add(chat);
            context.Messages.Add(message);
            context.Attachments.Add(attachment);
            await context.SaveChangesAsync();

            var controller = CreateController(context, mockStorage.Object, cache, unauthorizedUserId);

            // Act
            var result = await controller.GetAttachment("2026", "09", "07", "secret.pdf");

            // Assert
            Assert.IsType<ForbidResult>(result);
        }

        [Fact]
        public async Task GetAttachment_ReturnsFileStream_WhenUserIsParticipant_ForAzureBlob()
        {
            using var context = CreateDbContext();
            var cache = new MemoryCache(new MemoryCacheOptions());
            var mockStorage = new Mock<IStorageService>();

            var participantId = Guid.NewGuid();

            var chat = new Chat
            {
                Id = Guid.NewGuid(),
                Type = ChatType.Private
            };
            chat.Participants.Add(new ChatParticipant { ChatId = chat.Id, UserId = participantId });

            var message = new Message
            {
                Id = Guid.NewGuid(),
                ChatId = chat.Id,
                SenderId = participantId
            };
            var attachment = new Attachment
            {
                Id = Guid.NewGuid(),
                MessageId = message.Id,
                FileUrl = "/api/files/attachments/2026/09/07/voice.mp3"
            };
            message.Attachments.Add(attachment);

            context.Chats.Add(chat);
            context.Messages.Add(message);
            context.Attachments.Add(attachment);
            await context.SaveChangesAsync();

            using var fakeStream = new System.IO.MemoryStream(System.Text.Encoding.UTF8.GetBytes("fake audio"));
            mockStorage
                .Setup(s => s.GetAttachmentFileAsync("attachments/2026/09/07/voice.mp3"))
                .ReturnsAsync(new StorageFileResult
                {
                    Stream = fakeStream,
                    ContentType = "audio/mpeg",
                    FileName = "voice.mp3"
                });

            var controller = CreateController(context, mockStorage.Object, cache, participantId);

            // Act
            var result = await controller.GetAttachment("2026", "09", "07", "voice.mp3");

            // Assert
            var fileStreamResult = Assert.IsType<FileStreamResult>(result);
            Assert.Equal("audio/mpeg", fileStreamResult.ContentType);
            Assert.True(fileStreamResult.EnableRangeProcessing);
        }

        [Fact]
        public async Task GetAttachment_AllowsPendingUpload_OnlyForUploader()
        {
            using var context = CreateDbContext();
            var cache = new MemoryCache(new MemoryCacheOptions());
            var mockStorage = new Mock<IStorageService>();

            var uploaderId = Guid.NewGuid();
            var anotherUserId = Guid.NewGuid();
            var fileName = "preview_pic.png";

            // Mark as pending upload in cache
            cache.Set($"pending_att_{fileName}", uploaderId, TimeSpan.FromHours(1));

            mockStorage
                .Setup(s => s.GetAttachmentFileAsync($"attachments/2026/09/07/{fileName}"))
                .ReturnsAsync(new StorageFileResult
                {
                    PhysicalPath = "C:\\fake\\preview_pic.png",
                    ContentType = "image/png"
                });

            // 1. Authorized for uploader
            var uploaderController = CreateController(context, mockStorage.Object, cache, uploaderId);
            var authorizedResult = await uploaderController.GetAttachment("2026", "09", "07", fileName);
            Assert.IsType<PhysicalFileResult>(authorizedResult);

            // 2. Forbidden for any other user
            var otherController = CreateController(context, mockStorage.Object, cache, anotherUserId);
            var forbiddenResult = await otherController.GetAttachment("2026", "09", "07", fileName);
            Assert.IsType<ForbidResult>(forbiddenResult);
        }
    }
}
