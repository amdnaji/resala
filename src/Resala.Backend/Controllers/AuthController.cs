using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Resala.Backend.Models;
using Resala.Backend.Services;
using System.Threading.Tasks;

namespace Resala.Backend.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly UserManager<User> _userManager;
        private readonly SignInManager<User> _signInManager;
        private readonly ILdapService _ldapService;

        public AuthController(
            UserManager<User> userManager, 
            SignInManager<User> signInManager,
            ILdapService ldapService)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _ldapService = ldapService;
        }

        [HttpGet("settings")]
        public IActionResult GetSettings()
        {
            return Ok(new
            {
                isLdapEnabled = _ldapService.IsEnabled,
                authMode = _ldapService.AuthMode
            });
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login([FromBody] LoginRequest request)
        {
            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new { message = "Email and password are required." });
            }

            // 1. Try LDAP if mode is LDAP
            if (_ldapService.AuthMode == "LDAP" && _ldapService.IsEnabled)
            {
                var isLdapValid = await _ldapService.ValidateCredentialsAsync(request.Email, request.Password);
                if (isLdapValid)
                {
                    var user = await _userManager.FindByEmailAsync(request.Email);
                    if (user == null)
                    {
                        // Auto-provision user from AD
                        user = new User
                        {
                            UserName = request.Email,
                            Email = request.Email,
                            EmailConfirmed = true,
                            DisplayName = request.Email.Split('@')[0]
                        };
                        var createResult = await _userManager.CreateAsync(user);
                        if (!createResult.Succeeded)
                        {
                            return BadRequest(new { message = "Failed to create local user for AD account." });
                        }
                    }

                    await _signInManager.SignInAsync(user, isPersistent: true);
                    return Ok(new { message = "Login successful (LDAP)" });
                }
                
                return Unauthorized(new { message = "Invalid LDAP credentials." });
            }

            // 2. Standard Identity login for Standalone mode (or fallback if LDAP not enabled)
            var result = await _signInManager.PasswordSignInAsync(request.Email, request.Password, isPersistent: true, lockoutOnFailure: false);
            
            if (result.Succeeded)
            {
                return Ok(new { message = "Login successful" });
            }

            return Unauthorized(new { message = "Invalid email or password." });
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register([FromBody] RegisterRequest request)
        {
            if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
            {
                return BadRequest(new { message = "Email and password are required." });
            }

            var user = new User
            {
                UserName = request.Email,
                Email = request.Email,
                DisplayName = request.Email.Split('@')[0]
            };

            var result = await _userManager.CreateAsync(user, request.Password);
            if (result.Succeeded)
            {
                user.EmailConfirmed = true; // Auto-confirm for now as per Program.cs pattern
                await _userManager.UpdateAsync(user);
                return Ok(new { message = "User registered successfully" });
            }

            return BadRequest(new { errors = result.Errors });
        }

        public class LoginRequest
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }

        public class RegisterRequest
        {
            public string Email { get; set; } = string.Empty;
            public string Password { get; set; } = string.Empty;
        }
    }
}
