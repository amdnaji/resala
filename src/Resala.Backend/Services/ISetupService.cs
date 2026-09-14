using Resala.Backend.Models;
using System.Threading.Tasks;

namespace Resala.Backend.Services
{
    public interface ISetupService
    {
        Task<SetupStatusResponse> GetStatusAsync();
        Task<TestResultDTO> TestDatabaseAsync(TestDatabaseRequest request);
        Task<TestResultDTO> TestStorageAsync(TestStorageRequest request);
        Task<TestResultDTO> TestLdapAsync(TestLdapRequest request);
        Task<TestResultDTO> SaveSetupAsync(SaveSetupRequest request);
    }
}
