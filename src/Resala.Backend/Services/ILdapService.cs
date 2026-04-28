namespace Resala.Backend.Services
{
    public interface ILdapService
    {
        bool IsEnabled { get; }
        string AuthMode { get; }
        Task<bool> ValidateCredentialsAsync(string email, string password);
    }
}
