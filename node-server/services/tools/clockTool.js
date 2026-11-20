// node-server/services/tools/clockTool.js
// Returns current local time, or the time for a requested city/timezone.
// Zero external APIs — uses Node's built-in Intl.DateTimeFormat.

// Map of common city names → IANA timezone strings
const CITY_TZ_MAP = {
    // Americas
    "new york": "America/New_York",
    "new york city": "America/New_York",
    "nyc": "America/New_York",
    "los angeles": "America/Los_Angeles",
    "la": "America/Los_Angeles",
    "chicago": "America/Chicago",
    "toronto": "America/Toronto",
    "canada": "America/Toronto",
    "sao paulo": "America/Sao_Paulo",
    "brazil": "America/Sao_Paulo",
    "mexico city": "America/Mexico_City",
    "mexico": "America/Mexico_City",
    "buenos aires": "America/Argentina/Buenos_Aires",
    "argentina": "America/Argentina/Buenos_Aires",

    // Europe
    "london": "Europe/London",
    "uk": "Europe/London",
    "britain": "Europe/London",
    "england": "Europe/London",
    "paris": "Europe/Paris",
    "france": "Europe/Paris",
    "berlin": "Europe/Berlin",
    "germany": "Europe/Berlin",
    "madrid": "Europe/Madrid",
    "spain": "Europe/Madrid",
    "rome": "Europe/Rome",
    "italy": "Europe/Rome",
    "amsterdam": "Europe/Amsterdam",
    "netherlands": "Europe/Amsterdam",
    "moscow": "Europe/Moscow",
    "russia": "Europe/Moscow",
    "istanbul": "Europe/Istanbul",
    "turkey": "Europe/Istanbul",

    // Asia & Middle East
    "dubai": "Asia/Dubai",
    "uae": "Asia/Dubai",
    "mumbai": "Asia/Kolkata",
    "delhi": "Asia/Kolkata",
    "india": "Asia/Kolkata",
    "kolkata": "Asia/Kolkata",
    "bangalore": "Asia/Kolkata",
    "hyderabad": "Asia/Kolkata",
    "karachi": "Asia/Karachi",
    "pakistan": "Asia/Karachi",
    "dhaka": "Asia/Dhaka",
    "bangladesh": "Asia/Dhaka",
    "colombo": "Asia/Colombo",
    "sri lanka": "Asia/Colombo",
    "kathmandu": "Asia/Kathmandu",
    "nepal": "Asia/Kathmandu",
    "beijing": "Asia/Shanghai",
    "shanghai": "Asia/Shanghai",
    "china": "Asia/Shanghai",
    "hong kong": "Asia/Hong_Kong",
    "tokyo": "Asia/Tokyo",
    "japan": "Asia/Tokyo",
    "seoul": "Asia/Seoul",
    "korea": "Asia/Seoul",
    "singapore": "Asia/Singapore",
    "bangkok": "Asia/Bangkok",
    "thailand": "Asia/Bangkok",
    "jakarta": "Asia/Jakarta",
    "indonesia": "Asia/Jakarta",
    "tehran": "Asia/Tehran",
    "iran": "Asia/Tehran",
    "riyadh": "Asia/Riyadh",
    "saudi arabia": "Asia/Riyadh",
    "doha": "Asia/Qatar",
    "qatar": "Asia/Qatar",

    // Africa
    "cairo": "Africa/Cairo",
    "egypt": "Africa/Cairo",
    "nairobi": "Africa/Nairobi",
    "kenya": "Africa/Nairobi",
    "lagos": "Africa/Lagos",
    "nigeria": "Africa/Lagos",
    "johannesburg": "Africa/Johannesburg",
    "south africa": "Africa/Johannesburg",

    // Oceania
    "sydney": "Australia/Sydney",
    "australia": "Australia/Sydney",
    "melbourne": "Australia/Melbourne",
    "auckland": "Pacific/Auckland",
    "new zealand": "Pacific/Auckland",
};

function resolveTimezone(city) {
    if (!city) return null;
    const key = city.toLowerCase().trim();
    return CITY_TZ_MAP[key] || null;
}

function getClockData(timezone, city) {
    const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();

    const timeFmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    });

    const dateFmt = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
    });

    // Compute UTC offset string for the timezone
    const offsetMin = -new Date(
        new Date().toLocaleString("en-US", { timeZone: tz })
    ).getTimezoneOffset();

    // More reliable offset via date parts comparison
    const localParts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour: "numeric",
        hour12: false,
        minute: "numeric",
        timeZoneName: "short"
    }).formatToParts(now);

    const tzName = localParts.find(p => p.type === "timeZoneName")?.value || tz;

    // Calculate actual offset
    const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const tzDate = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const diffMs = tzDate - utcDate;
    const diffH = Math.floor(Math.abs(diffMs) / 3600000);
    const diffM = Math.floor((Math.abs(diffMs) % 3600000) / 60000);
    const sign = diffMs >= 0 ? "+" : "-";
    const offset = `GMT${sign}${String(diffH).padStart(2, "0")}:${String(diffM).padStart(2, "0")}`;

    return {
        city: city || "Local",
        timezone: tz,
        time: timeFmt.format(now),
        date: dateFmt.format(now),
        offset,
        tzName,
        isLocal: !city
    };
}

async function showClock(parameters = {}) {
    try {
        const { city, timezone } = parameters;

        let resolvedTz = timezone || null;

        // Try to resolve from city name if no explicit timezone provided
        if (city && !resolvedTz) {
            resolvedTz = resolveTimezone(city);
        }

        // If city given but not found in map, still try using city as tz string directly
        if (city && !resolvedTz) {
            // Check if it looks like an IANA zone (e.g. "Asia/Kolkata")
            if (city.includes("/")) {
                resolvedTz = city;
            }
        }

        const data = getClockData(resolvedTz, city || null);

        if (city && !resolvedTz) {
            // City not recognized — fall back gracefully with a note
            return {
                type: "tool_result",
                tool: "show_clock",
                ui: "clock-card",
                data: {
                    ...getClockData(null, null),
                    city: "Local (city not recognized)",
                    note: `Could not find timezone for "${city}". Showing local time.`
                }
            };
        }

        return {
            type: "tool_result",
            tool: "show_clock",
            ui: "clock-card",
            data
        };

    } catch (err) {
        return {
            type: "tool_result",
            tool: "show_clock",
            ui: "error-card",
            data: { message: "Clock tool error: " + err.message }
        };
    }
}

module.exports = { showClock };
