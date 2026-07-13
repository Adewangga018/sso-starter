using SsoBackend.Models.Dto;

namespace SsoBackend.Services;

// Resolves a relative path stored in the legacy DB (e.g. "uploads/karyawan/xxx.pdf")
// into a URL the frontend can open. The physical host for these files isn't confirmed
// yet, so until LegacyFiles:BaseUrl is configured this always reports "unavailable"
// rather than guessing/fabricating a URL.
public class DocumentResolver
{
    private readonly string? _baseUrl;

    public DocumentResolver(IConfiguration configuration)
    {
        _baseUrl = configuration["LegacyFiles:BaseUrl"];
    }

    public DocumentInfo Resolve(string? path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return new DocumentInfo(false, null, null);
        }

        var filename = path.Contains('/') ? path[(path.LastIndexOf('/') + 1)..] : path;

        if (string.IsNullOrWhiteSpace(_baseUrl))
        {
            return new DocumentInfo(false, null, filename);
        }

        var url = $"{_baseUrl.TrimEnd('/')}/{path.TrimStart('/')}";
        return new DocumentInfo(true, url, filename);
    }
}
