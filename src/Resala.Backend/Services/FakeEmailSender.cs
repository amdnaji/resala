using Microsoft.AspNetCore.Identity;
using Resala.Backend.Models;
using System.Threading.Tasks;
using System;

namespace Resala.Backend.Services;

public class FakeEmailSender : IEmailSender<User>
{
    // A static property to hold the most recently generated reset link
    public static string? LastResetLink { get; private set; }

    public Task SendConfirmationLinkAsync(User user, string email, string confirmationLink)
    {
        Console.WriteLine($"\n[FAKE EMAIL] Confirmation for {email}: {confirmationLink}\n");
        return Task.CompletedTask;
    }

    public Task SendPasswordResetCodeAsync(User user, string email, string resetCode)
    {
        var encodedCode = Uri.EscapeDataString(resetCode);
        var encodedEmail = Uri.EscapeDataString(email);
        
        LastResetLink = $"http://localhost:5174/reset-password?email={encodedEmail}&resetCode={encodedCode}";
        
        Console.WriteLine($"\n[FAKE EMAIL] Reset Link for {email}:\n{LastResetLink}\n");
        return Task.CompletedTask;
    }

    public Task SendPasswordResetLinkAsync(User user, string email, string resetLink)
    {
        // Identity API might use SendPasswordResetLinkAsync sometimes and pass an auto-generated link 
        // to our backend URL (e.g. https://localhost:5001/resetPassword?code=xyz)
        string code = "";
        try {
            var uri = new Uri(resetLink);
            var queryIndex = uri.Query.IndexOf("code=");
            if (queryIndex != -1) {
                var ampersandIndex = uri.Query.IndexOf("&", queryIndex);
                if (ampersandIndex != -1)
                    code = uri.Query.Substring(queryIndex + 5, ampersandIndex - queryIndex - 5);
                else
                    code = uri.Query.Substring(queryIndex + 5);
            }
        } catch { }

        var encodedCode = Uri.EscapeDataString(code);
        var encodedEmail = Uri.EscapeDataString(email);
        
        LastResetLink = $"http://localhost:5174/reset-password?email={encodedEmail}&resetCode={encodedCode}";
        Console.WriteLine($"\n[FAKE EMAIL DYNAMIC] Reset Link for {email}:\n{LastResetLink}\n");
        return Task.CompletedTask;
    }
}
