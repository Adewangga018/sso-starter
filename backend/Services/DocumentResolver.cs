namespace SsoBackend.Services;

// A validated physical file ready to be streamed.
public sealed record ResolvedFile(string PhysicalPath, string Filename, string ContentType);

// Resolves a relative path stored in MST_PEGAWAI (e.g. "uploads/karyawan/xxx.jpg") to a real
// file under LegacyFiles:Root (the WCP-GCS uploads folder / share). The files are streamed
// through an authenticated + authorized endpoint - never exposed as public URLs - so only the
// owning employee or an admin can read them (KTP/KK/ijazah are sensitive personal data).
public class DocumentResolver
{
    private readonly string? _root;

    public DocumentResolver(IConfiguration configuration)
    {
        _root = configuration["LegacyFiles:Root"];
    }

    // Returns null when the document is unavailable: no path stored, root not configured,
    // a path-traversal attempt, or the file simply doesn't exist on disk.
    public ResolvedFile? Resolve(string? relativePath)
    {
        var full = ToPhysicalPath(relativePath);
        if (full is null || !File.Exists(full))
        {
            return null;
        }

        return new ResolvedFile(full, Path.GetFileName(full), ContentTypeFor(full));
    }

    // Resolves a relative path to its physical location under the root WITHOUT requiring the
    // file to exist - used when writing an uploaded document to a (possibly new) path. Returns
    // null if the root isn't configured or the path escapes the root (traversal attempt).
    public string? ToPhysicalPath(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath) || string.IsNullOrWhiteSpace(_root))
        {
            return null;
        }

        var rootFull = Path.GetFullPath(_root);
        var rel = relativePath.Replace('\\', '/').TrimStart('/');
        var full = Path.GetFullPath(Path.Combine(rootFull, rel));

        // Guard against path traversal ("../"): the resolved path MUST stay under the root.
        var rootPrefix = rootFull.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase))
        {
            return null;
        }

        return full;
    }

    private static string ContentTypeFor(string path) => Path.GetExtension(path).ToLowerInvariant() switch
    {
        ".pdf" => "application/pdf",
        ".jpg" or ".jpeg" => "image/jpeg",
        ".png" => "image/png",
        ".gif" => "image/gif",
        ".webp" => "image/webp",
        ".bmp" => "image/bmp",
        ".tif" or ".tiff" => "image/tiff",
        _ => "application/octet-stream",
    };
}
