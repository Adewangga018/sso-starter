using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SsoBackend.Data;
using SsoBackend.Models.Dto;
using SsoBackend.Services;

namespace SsoBackend.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly GcsDbContext _db;
    private readonly TokenService _tokenService;

    public AuthController(GcsDbContext db, TokenService tokenService)
    {
        _db = db;
        _tokenService = tokenService;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Email dan kata sandi wajib diisi." });
        }

        var email = request.Email.Trim().ToLower();
        var user = await _db.EasyUsers.FirstOrDefaultAsync(u => u.Email.ToLower() == email);

        if (user is null || !BCrypt.Net.BCrypt.Verify(request.Password, user.Password))
        {
            return Unauthorized(new { message = "Email atau kata sandi salah." });
        }

        if (!string.Equals(user.Status, "Aktif", StringComparison.OrdinalIgnoreCase))
        {
            return Unauthorized(new { message = "Akun tidak aktif. Hubungi HR/SDM." });
        }

        var token = _tokenService.CreateToken(user);
        return Ok(new LoginResponse(token, new AuthUserDto(user.Name, user.Email)));
    }
}
