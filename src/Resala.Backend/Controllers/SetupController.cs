using Microsoft.AspNetCore.Mvc;
using Resala.Backend.Models;
using Resala.Backend.Services;
using System.Threading.Tasks;

namespace Resala.Backend.Controllers
{
    [ApiController]
    [Route("api/setup")]
    public class SetupController : ControllerBase
    {
        private readonly ISetupService _setupService;
        private readonly IConfigurationInspectorService _inspectorService;

        public SetupController(
            ISetupService setupService,
            IConfigurationInspectorService inspectorService)
        {
            _setupService = setupService;
            _inspectorService = inspectorService;
        }

        [HttpGet("status")]
        public async Task<IActionResult> GetStatus()
        {
            var status = await _setupService.GetStatusAsync();
            return Ok(status);
        }

        [HttpGet("sources")]
        public IActionResult GetConfigurationSources()
        {
            var sources = _inspectorService.GetAppConfigurationSources();
            return Ok(sources);
        }

        [HttpPost("test-db")]
        public async Task<IActionResult> TestDatabase([FromBody] TestDatabaseRequest request)
        {
            var result = await _setupService.TestDatabaseAsync(request);
            if (!result.Success)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        [HttpPost("test-storage")]
        public async Task<IActionResult> TestStorage([FromBody] TestStorageRequest request)
        {
            var result = await _setupService.TestStorageAsync(request);
            if (!result.Success)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        [HttpPost("test-ldap")]
        public async Task<IActionResult> TestLdap([FromBody] TestLdapRequest request)
        {
            var result = await _setupService.TestLdapAsync(request);
            if (!result.Success)
            {
                return BadRequest(result);
            }
            return Ok(result);
        }

        [HttpPost("save")]
        public async Task<IActionResult> Save([FromBody] SaveSetupRequest request)
        {
            var currentStatus = await _setupService.GetStatusAsync();
            // If setup was already completed, protect against unauthorized reconfiguration
            if (currentStatus.IsSetupCompleted && !User.Identity?.IsAuthenticated == true)
            {
                return StatusCode(403, new TestResultDTO
                {
                    Success = false,
                    Message = "Setup has already been completed and locked. Modifying configuration requires administrative authorization."
                });
            }

            var result = await _setupService.SaveSetupAsync(request);
            if (!result.Success)
            {
                return BadRequest(result);
            }

            return Ok(result);
        }
    }
}
