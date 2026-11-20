// unitConverterTool.js — pure math, no external API
// Supports: length, weight, temperature, area, volume, speed, data, time

const UNITS = {
    length: {
        label: "Length",
        base: "m",
        units: {
            mm: { name: "Millimeter", factor: 0.001 },
            cm: { name: "Centimeter", factor: 0.01 },
            m:  { name: "Meter",      factor: 1 },
            km: { name: "Kilometer",  factor: 1000 },
            in: { name: "Inch",       factor: 0.0254 },
            ft: { name: "Foot",       factor: 0.3048 },
            yd: { name: "Yard",       factor: 0.9144 },
            mi: { name: "Mile",       factor: 1609.344 },
            nmi:{ name: "Nautical mi",factor: 1852 }
        }
    },
    weight: {
        label: "Weight / Mass",
        base: "kg",
        units: {
            mg:  { name: "Milligram", factor: 0.000001 },
            g:   { name: "Gram",      factor: 0.001 },
            kg:  { name: "Kilogram",  factor: 1 },
            t:   { name: "Tonne",     factor: 1000 },
            oz:  { name: "Ounce",     factor: 0.0283495 },
            lb:  { name: "Pound",     factor: 0.453592 },
            st:  { name: "Stone",     factor: 6.35029 },
            ton: { name: "US Ton",    factor: 907.185 }
        }
    },
    temperature: {
        label: "Temperature",
        special: true,
        units: {
            C: { name: "Celsius" },
            F: { name: "Fahrenheit" },
            K: { name: "Kelvin" },
            R: { name: "Rankine" }
        }
    },
    area: {
        label: "Area",
        base: "m2",
        units: {
            mm2: { name: "mm²",       factor: 0.000001 },
            cm2: { name: "cm²",       factor: 0.0001 },
            m2:  { name: "m²",        factor: 1 },
            km2: { name: "km²",       factor: 1e6 },
            in2: { name: "in²",       factor: 0.00064516 },
            ft2: { name: "ft²",       factor: 0.092903 },
            ac:  { name: "Acre",      factor: 4046.86 },
            ha:  { name: "Hectare",   factor: 10000 }
        }
    },
    volume: {
        label: "Volume",
        base: "l",
        units: {
            ml:   { name: "Milliliter", factor: 0.001 },
            cl:   { name: "Centiliter", factor: 0.01 },
            l:    { name: "Liter",      factor: 1 },
            m3:   { name: "m³",         factor: 1000 },
            floz: { name: "Fl oz (US)", factor: 0.0295735 },
            cup:  { name: "Cup (US)",   factor: 0.236588 },
            pt:   { name: "Pint (US)",  factor: 0.473176 },
            qt:   { name: "Quart (US)", factor: 0.946353 },
            gal:  { name: "Gallon (US)",factor: 3.78541 }
        }
    },
    speed: {
        label: "Speed",
        base: "m/s",
        units: {
            "m/s":  { name: "m/s",        factor: 1 },
            "km/h": { name: "km/h",        factor: 0.277778 },
            "mi/h": { name: "mph",         factor: 0.44704 },
            kn:     { name: "Knot",        factor: 0.514444 },
            "ft/s": { name: "ft/s",        factor: 0.3048 }
        }
    },
    data: {
        label: "Data Storage",
        base: "B",
        units: {
            B:   { name: "Byte",      factor: 1 },
            KB:  { name: "Kilobyte",  factor: 1024 },
            MB:  { name: "Megabyte",  factor: 1048576 },
            GB:  { name: "Gigabyte",  factor: 1073741824 },
            TB:  { name: "Terabyte",  factor: 1099511627776 },
            Kib: { name: "Kibibyte",  factor: 1024 },
            Mib: { name: "Mebibyte",  factor: 1048576 },
            Gib: { name: "Gibibyte",  factor: 1073741824 }
        }
    },
    time: {
        label: "Time",
        base: "s",
        units: {
            ms:  { name: "Millisecond", factor: 0.001 },
            s:   { name: "Second",      factor: 1 },
            min: { name: "Minute",      factor: 60 },
            h:   { name: "Hour",        factor: 3600 },
            d:   { name: "Day",         factor: 86400 },
            wk:  { name: "Week",        factor: 604800 },
            mo:  { name: "Month (avg)", factor: 2628000 },
            yr:  { name: "Year",        factor: 31536000 }
        }
    }
};

// Temperature conversions (special — not factor-based)
function convertTemp(value, from, to) {
    let celsius;
    switch (from) {
        case "C": celsius = value; break;
        case "F": celsius = (value - 32) * 5 / 9; break;
        case "K": celsius = value - 273.15; break;
        case "R": celsius = (value - 491.67) * 5 / 9; break;
        default:  throw new Error(`Unknown temp unit: ${from}`);
    }
    switch (to) {
        case "C": return celsius;
        case "F": return celsius * 9 / 5 + 32;
        case "K": return celsius + 273.15;
        case "R": return (celsius + 273.15) * 9 / 5;
        default:  throw new Error(`Unknown temp unit: ${to}`);
    }
}

// Normalise common aliases before lookup
const ALIASES = {
    meter: "m", meters: "m", metre: "m", metres: "m",
    kilometer: "km", kilometers: "km", kilometre: "km",
    centimeter: "cm", centimeters: "cm", centimetre: "cm",
    millimeter: "mm", millimeters: "mm", millimetre: "mm",
    inch: "in", inches: "in",
    foot: "ft", feet: "ft",
    yard: "yd", yards: "yd",
    mile: "mi", miles: "mi",
    kilogram: "kg", kilograms: "kg", kilo: "kg",
    gram: "g", grams: "g",
    pound: "lb", pounds: "lb", lbs: "lb",
    ounce: "oz", ounces: "oz",
    celsius: "C", fahrenheit: "F", kelvin: "K",
    liter: "l", litre: "l", liters: "l", litres: "l",
    milliliter: "ml", millilitre: "ml",
    gallon: "gal", gallons: "gal",
    byte: "B", bytes: "B",
    kilobyte: "KB", megabyte: "MB", gigabyte: "GB", terabyte: "TB",
    second: "s", seconds: "s",
    minute: "min", minutes: "min",
    hour: "h", hours: "h",
    day: "d", days: "d",
    week: "wk", weeks: "wk",
    year: "yr", years: "yr",
    mph: "mi/h", kph: "km/h",
    hectare: "ha", acre: "ac", acres: "ac"
};

function normaliseUnit(u) {
    if (!u) return u;
    const lc = u.toLowerCase().trim().replace(/\s+/g, "");
    return ALIASES[lc] || u.trim();
}

// Find which category a unit belongs to
function findCategory(unit) {
    for (const [catKey, cat] of Object.entries(UNITS)) {
        if (cat.units[unit]) return catKey;
    }
    return null;
}

function round(n, decimals = 6) {
    return parseFloat(n.toFixed(decimals));
}

async function convertUnits(parameters = {}) {
    try {
        let { value, from, to, category } = parameters;

        const numVal = parseFloat(value);
        if (isNaN(numVal)) throw new Error("Invalid value — must be a number.");

        const fromUnit = normaliseUnit(from);
        const toUnit = normaliseUnit(to);

        if (!fromUnit || !toUnit) throw new Error("from and to units are required.");

        // Auto-detect category if not given
        if (!category) {
            const detected = findCategory(fromUnit);
            if (!detected) throw new Error(`Unknown unit: ${fromUnit}`);
            category = detected;
        }

        const cat = UNITS[category];
        if (!cat) throw new Error(`Unknown category: ${category}`);

        let result;

        if (cat.special && category === "temperature") {
            result = convertTemp(numVal, fromUnit, toUnit);
        } else {
            const fromDef = cat.units[fromUnit];
            const toDef   = cat.units[toUnit];
            if (!fromDef) throw new Error(`"${fromUnit}" not in ${cat.label}`);
            if (!toDef)   throw new Error(`"${toUnit}" not in ${cat.label}`);
            const base = numVal * fromDef.factor;
            result = base / toDef.factor;
        }

        const fromName = cat.units[fromUnit]?.name || fromUnit;
        const toName   = cat.units[toUnit]?.name   || toUnit;

        // Build all conversions for this category
        const allConversions = {};
        if (cat.special) {
            for (const [key] of Object.entries(cat.units)) {
                allConversions[key] = round(convertTemp(numVal, fromUnit, key), 4);
            }
        } else {
            const base = numVal * cat.units[fromUnit].factor;
            for (const [key, def] of Object.entries(cat.units)) {
                allConversions[key] = round(base / def.factor, 6);
            }
        }

        return {
            type: "tool_result",
            tool: "convert_units",
            ui: "unit-converter-card",
            data: {
                value: numVal,
                from: fromUnit,
                to: toUnit,
                fromName,
                toName,
                result: round(result, 6),
                category,
                categoryLabel: cat.label,
                allConversions,
                units: Object.entries(cat.units).map(([k, v]) => ({ key: k, name: v.name }))
            }
        };

    } catch (err) {
        return {
            type: "tool_result",
            tool: "convert_units",
            ui: "error-card",
            data: { message: err.message }
        };
    }
}

module.exports = { convertUnits };
