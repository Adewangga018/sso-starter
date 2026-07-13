namespace SsoBackend.Services;

// An SPL may only be filed for today (H) or the previous day (H-1). Because nobody works the
// weekend, that "previous day" stretches back across it: filing on Monday reaches Friday, so
// Friday/Saturday/Sunday overtime can still be claimed. The allowed span is always contiguous,
// which lets the UI express it as a plain min/max on the date picker.
public static class SplWindow
{
    public static (DateOnly Min, DateOnly Max) For(DateOnly today)
    {
        var back = today.DayOfWeek == DayOfWeek.Monday ? 3 : 1;
        return (today.AddDays(-back), today);
    }

    public static bool Allows(DateOnly today, DateOnly date)
    {
        var (min, max) = For(today);
        return date >= min && date <= max;
    }
}
