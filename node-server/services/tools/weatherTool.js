// // const axios = require("axios");

// // async function getWeather(location = "Dhanbad") {
// //     // For now simulate
// //     return {
// //         type: "tool_result",
// //         tool: "weather",
// //         ui: "weather-card",
// //         data: {
// //             location,
// //             temperature: 32,
// //             condition: "Clear",
// //             humidity: 60
// //         }
// //     };
// // }

// // module.exports = { getWeather };
// const axios = require("axios");

// async function getWeather(params = {}) {

//     const apiKey = process.env.OPENWEATHER_API_KEY;
//     let location = params.location;



//     try {
//         const response = await axios.get(
//             "https://api.openweathermap.org/data/2.5/weather",
//             {
//                 params: {
//                     q: location,
//                     appid: apiKey,
//                     units: "metric"
//                 }
//             }
//         );

//         const data = response.data;

//         return {
//             type: "tool_result",
//             tool: "get_weather",
//             ui: "weather-card",
//             data: {
//                 location: data.name,
//                 temperature: data.main.temp,
//                 condition: data.weather[0].main,
//                 description: data.weather[0].description,
//                 humidity: data.main.humidity,
//                 wind: data.wind.speed
//             }
//         };

//     } catch (error) {

//         return {
//             type: "tool_result",
//             tool: "get_weather",
//             ui: "weather-card",
//             data: {
//                 location,
//                 error: "Unable to fetch weather data."
//             }
//         };
//     }
// }

// module.exports = { getWeather };



//======new type to be checked=========================
const axios = require("axios");

async function getWeather(params = {}) {

    const apiKey = process.env.OPENWEATHER_API_KEY;

    let location = params.location;

    try {

        let lat, lon;

        // ===============================
        // 1️⃣ AUTO LOCATION (if no city)
        // ===============================
        if (!location) {

            const ipRes = await axios.get("http://ip-api.com/json/");
            lat = ipRes.data.lat;
            lon = ipRes.data.lon;

        } else {

            // Get coordinates for city
            const geoRes = await axios.get(
                "https://api.openweathermap.org/data/2.5/weather",
                {
                    params: {
                        q: location,
                        appid: apiKey,
                        units: "metric"
                    }
                }
            );

            lat = geoRes.data.coord.lat;
            lon = geoRes.data.coord.lon;
        }

        // ===============================
        // 2️⃣ WEATHER DATA
        // ===============================
        const weatherRes = await axios.get(
            "https://api.openweathermap.org/data/2.5/weather",
            {
                params: {
                    lat,
                    lon,
                    appid: apiKey,
                    units: "metric"
                }
            }
        );

        // ===============================
        // 3️⃣ AQI DATA
        // ===============================
        const aqiRes = await axios.get(
            "https://api.openweathermap.org/data/2.5/air_pollution",
            {
                params: {
                    lat,
                    lon,
                    appid: apiKey
                }
            }
        );

        const w = weatherRes.data;
        const aqi = aqiRes.data.list[0].main.aqi;

        return {
            type: "tool_result",
            tool: "get_weather",
            ui: "weather-card",
            data: {
                location: w.name,
                temperature: w.main.temp,
                minTemp: w.main.temp_min,
                maxTemp: w.main.temp_max,
                humidity: w.main.humidity,
                pressure: w.main.pressure,
                wind: w.wind.speed,
                condition: w.weather[0].main,
                description: w.weather[0].description,
                icon: w.weather[0].icon,
                aqi,
                isNight: w.weather[0].icon.includes("n")
            }
        };

    } catch (error) {

        console.error("Weather tool error:", error.message);

        return {
            type: "tool_result",
            tool: "get_weather",
            ui: "error-card",
            data: {
                message: "Unable to fetch weather data."
            }
        };
    }
}

module.exports = { getWeather };
