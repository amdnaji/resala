using System.ComponentModel.DataAnnotations;

namespace Resala.Backend.Models
{
    public class LoginByPhoneRequest
    {
        [Required]
        public string PhoneNumber { get; set; } = string.Empty;

        [Required]
        public string CountryCode { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }
}
